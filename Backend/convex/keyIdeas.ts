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
        .query("keyIdeas")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
        .order("desc")
        .collect();
    }

    if (args.jobId) {
      const job = await ctx.db.get(args.jobId);
      if (!job) throw new Error("Job not found");
      await verifyProjectAccess(ctx, job.projectId);
      return await ctx.db
        .query("keyIdeas")
        .withIndex("by_job", (q) => q.eq("jobId", args.jobId!))
        .order("desc")
        .collect();
    }

    throw new Error("Either projectId or jobId is required");
  },
});

export const get = query({
  args: { keyIdeaId: v.id("keyIdeas") },
  handler: async (ctx, args) => {
    const keyIdea = await ctx.db.get(args.keyIdeaId);
    if (!keyIdea) throw new Error("Key idea not found");

    await verifyProjectAccess(ctx, keyIdea.projectId);
    return keyIdea;
  },
});

export const getByTranscript = query({
  args: { transcriptId: v.id("transcripts") },
  handler: async (ctx, args) => {
    const transcript = await ctx.db.get(args.transcriptId);
    if (!transcript) throw new Error("Transcript not found");
    await verifyProjectAccess(ctx, transcript.projectId);

    const keyIdeas = await ctx.db
      .query("keyIdeas")
      .withIndex("by_transcript", (q) => q.eq("transcriptId", args.transcriptId))
      .collect();

    return keyIdeas[0] || null;
  },
});

export const createInternal = internalMutation({
  args: {
    jobId: v.id("jobs"),
    projectId: v.id("projects"),
    transcriptId: v.id("transcripts"),
    fileId: v.string(),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("keyIdeas", {
      jobId: args.jobId,
      projectId: args.projectId,
      transcriptId: args.transcriptId,
      fileId: args.fileId,
      fileName: args.fileName,
      status: "pending",
    });
  },
});

export const updateStatusInternal = internalMutation({
  args: {
    keyIdeaId: v.id("keyIdeas"),
    status: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = { status: args.status };

    if (args.error !== undefined) {
      updates.error = args.error;
    }
    if (args.status === "extracting") {
      updates.startedAt = Date.now();
    }
    if (args.status === "completed" || args.status === "failed") {
      updates.completedAt = Date.now();
    }

    await ctx.db.patch(args.keyIdeaId, updates);
  },
});

export const saveResultInternal = internalMutation({
  args: {
    keyIdeaId: v.id("keyIdeas"),
    extraction: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyIdeaId, {
      status: "completed",
      extraction: args.extraction,
      completedAt: Date.now(),
    });
  },
});

export const getByIdInternal = internalQuery({
  args: { keyIdeaId: v.id("keyIdeas") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.keyIdeaId);
  },
});

export const listByJobInternal = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("keyIdeas")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
  },
});

export const getByTranscriptInternal = internalQuery({
  args: { transcriptId: v.id("transcripts") },
  handler: async (ctx, args) => {
    const keyIdeas = await ctx.db
      .query("keyIdeas")
      .withIndex("by_transcript", (q) => q.eq("transcriptId", args.transcriptId))
      .collect();

    return keyIdeas[0] || null;
  },
});
