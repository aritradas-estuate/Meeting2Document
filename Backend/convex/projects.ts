import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const driveFolderValidator = v.object({
  id: v.string(),
  name: v.string(),
  source: v.optional(v.union(v.literal("my_drive"), v.literal("shared_drive"))),
  driveId: v.optional(v.string()),
});

async function getCurrentUserId(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export const list = query({
  args: {
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    let projects;
    if (args.status) {
      projects = await ctx.db
        .query("projects")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    } else {
      projects = await ctx.db
        .query("projects")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect();
    }

    return projects;
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const project = await ctx.db.get(args.projectId);

    if (!project) throw new Error("Project not found");
    if (project.userId !== userId) throw new Error("Unauthorized");

    return project;
  },
});

export const getWithStats = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const project = await ctx.db.get(args.projectId);

    if (!project) throw new Error("Project not found");
    if (project.userId !== userId) throw new Error("Unauthorized");

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const latestJob = jobs.sort((a, b) => 
      (b._creationTime || 0) - (a._creationTime || 0)
    )[0];

    return {
      ...project,
      jobCount: jobs.length,
      documentCount: documents.length,
      latestJobStatus: latestJob?.status ?? null,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    driveFolders: v.optional(v.array(driveFolderValidator)),
    schemaType: v.optional(v.string()),
    modelConfig: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const projectId = await ctx.db.insert("projects", {
      userId,
      name: args.name,
      description: args.description,
      driveFolders: args.driveFolders,
      schemaType: args.schemaType ?? "zuora_q2r",
      modelConfig: args.modelConfig,
      status: "active",
    });

    return projectId;
  },
});

export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    driveFolders: v.optional(v.array(driveFolderValidator)),
    schemaType: v.optional(v.string()),
    modelConfig: v.optional(v.any()),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const project = await ctx.db.get(args.projectId);

    if (!project) throw new Error("Project not found");
    if (project.userId !== userId) throw new Error("Unauthorized");

    const { projectId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    await ctx.db.patch(args.projectId, filteredUpdates);
    return args.projectId;
  },
});

export const archive = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const project = await ctx.db.get(args.projectId);

    if (!project) throw new Error("Project not found");
    if (project.userId !== userId) throw new Error("Unauthorized");

    await ctx.db.patch(args.projectId, { status: "archived" });
    return { success: true };
  },
});

export const restore = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const project = await ctx.db.get(args.projectId);

    if (!project) throw new Error("Project not found");
    if (project.userId !== userId) throw new Error("Unauthorized");
    if (project.status !== "archived") {
      throw new Error("Only archived projects can be restored");
    }

    await ctx.db.patch(args.projectId, { status: "active" });
    return args.projectId;
  },
});

export const permanentDelete = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const project = await ctx.db.get(args.projectId);

    if (!project) throw new Error("Project not found");
    if (project.userId !== userId) throw new Error("Unauthorized");

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const doc of documents) {
      const sections = await ctx.db
        .query("documentSections")
        .withIndex("by_document", (q) => q.eq("documentId", doc._id))
        .collect();

      for (const section of sections) {
        await ctx.db.delete(section._id);
      }
      await ctx.db.delete(doc._id);
    }

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const job of jobs) {
      await ctx.db.delete(job._id);
    }

    await ctx.db.delete(args.projectId);
    return { success: true };
  },
});

export const getByIdInternal = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});
