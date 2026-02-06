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
        .query("sourceContent")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
        .order("desc")
        .collect();
    }

    if (args.jobId) {
      const job = await ctx.db.get(args.jobId);
      if (!job) throw new Error("Job not found");
      await verifyProjectAccess(ctx, job.projectId);
      return await ctx.db
        .query("sourceContent")
        .withIndex("by_job", (q) => q.eq("jobId", args.jobId!))
        .order("desc")
        .collect();
    }

    throw new Error("Either projectId or jobId is required");
  },
});

export const getByIdInternal = internalQuery({
  args: { sourceContentId: v.id("sourceContent") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sourceContentId);
  },
});

export const create = internalMutation({
  args: {
    jobId: v.id("jobs"),
    projectId: v.id("projects"),
    fileId: v.string(),
    fileName: v.string(),
    fileSize: v.optional(v.number()),
    mimeType: v.string(),
    sourceType: v.union(
      v.literal("google_doc"),
      v.literal("google_slides"),
      v.literal("google_sheets"),
      v.literal("pdf"),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sourceContent", {
      jobId: args.jobId,
      projectId: args.projectId,
      fileId: args.fileId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      sourceType: args.sourceType,
      status: "pending",
    });
  },
});

export const updateStatus = internalMutation({
  args: {
    sourceContentId: v.id("sourceContent"),
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

    await ctx.db.patch(args.sourceContentId, updates);
  },
});

export const saveContent = internalMutation({
  args: {
    sourceContentId: v.id("sourceContent"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sourceContentId, {
      status: "completed",
      text: args.text,
      completedAt: Date.now(),
    });
  },
});

export const listByJobInternal = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sourceContent")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
  },
});
