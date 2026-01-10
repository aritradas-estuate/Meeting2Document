import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

const driveFileValidator = v.object({
  id: v.string(),
  name: v.string(),
  mimeType: v.string(),
  size: v.optional(v.number()),
  webViewLink: v.optional(v.string()),
});

async function getCurrentUserId(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

async function verifyProjectAccess(ctx: any, projectId: Id<"projects">) {
  const userId = await getCurrentUserId(ctx);
  const project = await ctx.db.get(projectId);

  if (!project) throw new Error("Project not found");
  if (project.userId !== userId) throw new Error("Unauthorized");

  return { userId, project };
}

export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    if (args.projectId) {
      await verifyProjectAccess(ctx, args.projectId);

      let jobs = await ctx.db
        .query("jobs")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
        .order("desc")
        .collect();

      if (args.status) {
        jobs = jobs.filter((j) => j.status === args.status);
      }

      return jobs;
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const projectIds = new Set(projects.map((p) => p._id));

    let jobs = await ctx.db.query("jobs").order("desc").collect();
    jobs = jobs.filter((j) => projectIds.has(j.projectId));

    if (args.status) {
      jobs = jobs.filter((j) => j.status === args.status);
    }

    return jobs;
  },
});

export const get = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    await verifyProjectAccess(ctx, job.projectId);
    return job;
  },
});

export const getWithResults = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    await verifyProjectAccess(ctx, job.projectId);
    return job;
  },
});

export const getProgress = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    await verifyProjectAccess(ctx, job.projectId);

    return {
      jobId: job._id,
      status: job.status,
      currentStage: job.currentStage,
      stageProgress: job.stageProgress,
      errorMessage: job.errorMessage,
    };
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    videoFiles: v.array(driveFileValidator),
    supportingFiles: v.optional(v.array(driveFileValidator)),
  },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);

    if (!args.videoFiles.length) {
      throw new Error("At least one video file is required");
    }

    const jobId = await ctx.db.insert("jobs", {
      projectId: args.projectId,
      status: "pending",
      videoFiles: args.videoFiles,
      supportingFiles: args.supportingFiles,
      currentStage: undefined,
      stageProgress: undefined,
      transcripts: [],
      extractionResult: undefined,
      synthesisResult: undefined,
      errorMessage: undefined,
      startedAt: undefined,
      completedAt: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.jobs.startProcessing, { jobId });

    return jobId;
  },
});

export const cancel = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    await verifyProjectAccess(ctx, job.projectId);

    if (job.status === "completed" || job.status === "failed") {
      throw new Error(`Cannot cancel job with status: ${job.status}`);
    }

    await ctx.db.patch(args.jobId, {
      status: "failed",
      errorMessage: "Cancelled by user",
      completedAt: Date.now(),
    });

    return { success: true };
  },
});

export const retry = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    await verifyProjectAccess(ctx, job.projectId);

    if (job.status !== "failed") {
      throw new Error("Can only retry failed jobs");
    }

    await ctx.db.patch(args.jobId, {
      status: "pending",
      errorMessage: undefined,
      currentStage: undefined,
      stageProgress: undefined,
      transcripts: [],
      extractionResult: undefined,
      startedAt: undefined,
      completedAt: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.jobs.startProcessing, { jobId: args.jobId });

    return args.jobId;
  },
});

export const startProcessing = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    await ctx.db.patch(args.jobId, {
      status: "transcribing",
      startedAt: Date.now(),
      currentStage: "transcribing",
      stageProgress: {
        stage: "transcribing",
        progress: 0,
        message: "Starting transcription...",
        filesCompleted: 0,
        totalFiles: job.videoFiles.length,
      },
    });

    await ctx.scheduler.runAfter(0, internal.actions.transcription.startTranscription, {
      jobId: args.jobId,
    });
  },
});

export const updateStatus = internalMutation({
  args: {
    jobId: v.id("jobs"),
    status: v.string(),
    currentStage: v.optional(v.string()),
    stageProgress: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = { status: args.status };

    if (args.currentStage !== undefined) updates.currentStage = args.currentStage;
    if (args.stageProgress !== undefined) updates.stageProgress = args.stageProgress;
    if (args.errorMessage !== undefined) updates.errorMessage = args.errorMessage;

    if (args.status === "completed" || args.status === "failed") {
      updates.completedAt = Date.now();
    }

    await ctx.db.patch(args.jobId, updates);
  },
});

export const addTranscriptId = internalMutation({
  args: {
    jobId: v.id("jobs"),
    fileId: v.string(),
    fileName: v.string(),
    transcriptId: v.string(),
    publicUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    const transcripts = job.transcripts || [];
    transcripts.push({
      fileId: args.fileId,
      fileName: args.fileName,
      transcriptId: args.transcriptId,
      status: "queued",
      publicUrl: args.publicUrl,
    });

    await ctx.db.patch(args.jobId, { transcripts });
  },
});

export const updateTranscriptStatus = internalMutation({
  args: {
    jobId: v.id("jobs"),
    transcriptId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    const transcripts = (job.transcripts || []).map((t) =>
      t.transcriptId === args.transcriptId ? { ...t, status: args.status } : t
    );

    await ctx.db.patch(args.jobId, { transcripts });
  },
});

export const saveExtractionResult = internalMutation({
  args: {
    jobId: v.id("jobs"),
    extractionResult: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      extractionResult: args.extractionResult,
      status: "completed",
      currentStage: "completed",
      completedAt: Date.now(),
      stageProgress: {
        stage: "completed",
        progress: 100,
        message: "Processing complete!",
      },
    });
  },
});

export const getByIdInternal = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const findByTranscriptId = internalQuery({
  args: { transcriptId: v.string() },
  handler: async (ctx, args) => {
    const jobs = await ctx.db.query("jobs").collect();

    for (const job of jobs) {
      const transcript = (job.transcripts || []).find(
        (t) => t.transcriptId === args.transcriptId
      );
      if (transcript) {
        return { job, transcript };
      }
    }

    return null;
  },
});
