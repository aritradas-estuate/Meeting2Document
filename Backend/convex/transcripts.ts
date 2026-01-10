import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

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
    jobId: v.optional(v.id("jobs")),
  },
  handler: async (ctx, args) => {
    if (args.projectId) {
      await verifyProjectAccess(ctx, args.projectId);
      return await ctx.db
        .query("transcripts")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
        .order("desc")
        .collect();
    }

    if (args.jobId) {
      const job = await ctx.db.get(args.jobId);
      if (!job) throw new Error("Job not found");
      await verifyProjectAccess(ctx, job.projectId);
      return await ctx.db
        .query("transcripts")
        .withIndex("by_job", (q) => q.eq("jobId", args.jobId!))
        .order("desc")
        .collect();
    }

    throw new Error("Either projectId or jobId is required");
  },
});

export const get = query({
  args: { transcriptId: v.id("transcripts") },
  handler: async (ctx, args) => {
    const transcript = await ctx.db.get(args.transcriptId);
    if (!transcript) throw new Error("Transcript not found");

    await verifyProjectAccess(ctx, transcript.projectId);
    return transcript;
  },
});

export const getByFileId = query({
  args: { 
    jobId: v.id("jobs"),
    fileId: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    await verifyProjectAccess(ctx, job.projectId);

    const transcripts = await ctx.db
      .query("transcripts")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    return transcripts.find((t) => t.fileId === args.fileId) || null;
  },
});

export const createInternal = internalMutation({
  args: {
    jobId: v.id("jobs"),
    projectId: v.id("projects"),
    fileId: v.string(),
    fileName: v.string(),
    fileSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("transcripts", {
      jobId: args.jobId,
      projectId: args.projectId,
      fileId: args.fileId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      status: "pending",
    });
  },
});

export const updateStatusInternal = internalMutation({
  args: {
    transcriptId: v.id("transcripts"),
    status: v.string(),
    assemblyAiTranscriptId: v.optional(v.string()),
    publicUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = { status: args.status };

    if (args.assemblyAiTranscriptId !== undefined) {
      updates.assemblyAiTranscriptId = args.assemblyAiTranscriptId;
    }
    if (args.publicUrl !== undefined) {
      updates.publicUrl = args.publicUrl;
    }
    if (args.error !== undefined) {
      updates.error = args.error;
    }
    if (args.status === "transcribing") {
      updates.startedAt = Date.now();
    }
    if (args.status === "completed" || args.status === "failed") {
      updates.completedAt = Date.now();
    }

    await ctx.db.patch(args.transcriptId, updates);
  },
});

export const saveResultInternal = internalMutation({
  args: {
    transcriptId: v.id("transcripts"),
    text: v.string(),
    utterances: v.optional(v.array(v.object({
      speaker: v.string(),
      text: v.string(),
      start: v.number(),
      end: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.transcriptId, {
      status: "completed",
      text: args.text,
      utterances: args.utterances,
      completedAt: Date.now(),
    });
  },
});

export const getByIdInternal = internalQuery({
  args: { transcriptId: v.id("transcripts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.transcriptId);
  },
});

export const findByAssemblyAiId = internalQuery({
  args: { assemblyAiTranscriptId: v.string() },
  handler: async (ctx, args) => {
    const transcripts = await ctx.db
      .query("transcripts")
      .withIndex("by_assemblyai_id", (q) => 
        q.eq("assemblyAiTranscriptId", args.assemblyAiTranscriptId)
      )
      .collect();

    return transcripts[0] || null;
  },
});

export const listByJobInternal = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transcripts")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
  },
});
