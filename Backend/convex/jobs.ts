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
    includeArchived: v.optional(v.boolean()),
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

      if (!args.includeArchived) {
        jobs = jobs.filter((j) => !j.archivedAt);
      }

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

    if (!args.includeArchived) {
      jobs = jobs.filter((j) => !j.archivedAt);
    }

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

    const transcripts = await ctx.db
      .query("transcripts")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    for (const transcript of transcripts) {
      await ctx.db.delete(transcript._id);
    }

    const keyIdeas = await ctx.db
      .query("keyIdeas")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    for (const keyIdea of keyIdeas) {
      await ctx.db.delete(keyIdea._id);
    }

    await ctx.db.patch(args.jobId, {
      status: "pending",
      errorMessage: undefined,
      currentStage: undefined,
      stageProgress: undefined,
      startedAt: undefined,
      completedAt: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.jobs.startProcessing, { jobId: args.jobId });

    return args.jobId;
  },
});

export const archive = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    await verifyProjectAccess(ctx, job.projectId);

    await ctx.db.patch(args.jobId, {
      archivedAt: Date.now(),
    });

    return { success: true };
  },
});

export const unarchive = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    await verifyProjectAccess(ctx, job.projectId);

    await ctx.db.patch(args.jobId, {
      archivedAt: undefined,
    });

    return { success: true };
  },
});

export const listArchived = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();

    return jobs.filter((job) => job.archivedAt);
  },
});

export const startProcessing = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    for (const file of job.videoFiles) {
      const transcriptId = await ctx.db.insert("transcripts", {
        jobId: args.jobId,
        projectId: job.projectId,
        fileId: file.id,
        fileName: file.name,
        fileSize: file.size,
        status: "pending",
      });

      await ctx.db.insert("keyIdeas", {
        jobId: args.jobId,
        projectId: job.projectId,
        transcriptId,
        fileId: file.id,
        fileName: file.name,
        status: "pending",
      });
    }

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

export const getByIdInternal = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const checkCompletion = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const keyIdeas = await ctx.db
      .query("keyIdeas")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    if (keyIdeas.length === 0) return;

    const allDone = keyIdeas.every(
      (k) => k.status === "completed" || k.status === "failed"
    );

    if (!allDone) return;

    const transcripts = await ctx.db
      .query("transcripts")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    const failedKeyIdeas = keyIdeas.filter((k) => k.status === "failed").length;
    const failedTranscripts = transcripts.filter((t) => t.status === "failed").length;
    const totalItems = keyIdeas.length;

    const allFailed = failedKeyIdeas === totalItems;
    const someFailed = failedKeyIdeas > 0 || failedTranscripts > 0;

    let finalStatus: "completed" | "failed";
    let message: string;

    if (allFailed) {
      finalStatus = "failed";
      message = "All extractions failed";
    } else if (someFailed) {
      finalStatus = "completed";
      message = `Completed with ${failedKeyIdeas} of ${totalItems} failed`;
    } else {
      finalStatus = "completed";
      message = "Processing complete!";
    }

    await ctx.db.patch(args.jobId, {
      status: finalStatus,
      completedAt: Date.now(),
      currentStage: finalStatus,
      stageProgress: {
        stage: finalStatus,
        progress: 100,
        message,
      },
    });
  },
});
