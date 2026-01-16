import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
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

async function verifyGenerationAccess(
  ctx: any,
  generationId: Id<"documentGenerations">,
) {
  const generation = await ctx.db.get(generationId);
  if (!generation) throw new Error("Generation not found");

  await verifyProjectAccess(ctx, generation.projectId);
  return generation;
}

const selectedSourceValidator = v.object({
  transcriptId: v.id("transcripts"),
  keyIdeaId: v.id("keyIdeas"),
  fileName: v.string(),
});

const recommendationValidator = v.object({
  sectionId: v.string(),
  sectionTitle: v.string(),
  confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
  summary: v.string(),
  sourceFileNames: v.array(v.string()),
});

export const list = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);

    return await ctx.db
      .query("documentGenerations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { generationId: v.id("documentGenerations") },
  handler: async (ctx, args) => {
    return await verifyGenerationAccess(ctx, args.generationId);
  },
});

export const getLatest = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);

    return await ctx.db
      .query("documentGenerations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .first();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    selectedSources: v.array(selectedSourceValidator),
  },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);

    const generationId = await ctx.db.insert("documentGenerations", {
      projectId: args.projectId,
      status: "selecting",
      selectedSources: args.selectedSources,
      startedAt: Date.now(),
    });

    return generationId;
  },
});

export const updateStatus = mutation({
  args: {
    generationId: v.id("documentGenerations"),
    status: v.union(
      v.literal("selecting"),
      v.literal("analyzing"),
      v.literal("recommending"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyGenerationAccess(ctx, args.generationId);

    const updates: any = { status: args.status };
    if (args.errorMessage) updates.errorMessage = args.errorMessage;
    if (args.status === "completed") updates.completedAt = Date.now();

    await ctx.db.patch(args.generationId, updates);
    return args.generationId;
  },
});

export const updateStatusInternal = internalMutation({
  args: {
    generationId: v.id("documentGenerations"),
    status: v.union(
      v.literal("selecting"),
      v.literal("analyzing"),
      v.literal("recommending"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = { status: args.status };
    if (args.errorMessage) updates.errorMessage = args.errorMessage;
    if (args.status === "completed") updates.completedAt = Date.now();

    await ctx.db.patch(args.generationId, updates);
  },
});

export const saveRecommendations = mutation({
  args: {
    generationId: v.id("documentGenerations"),
    recommendations: v.array(recommendationValidator),
  },
  handler: async (ctx, args) => {
    await verifyGenerationAccess(ctx, args.generationId);

    await ctx.db.patch(args.generationId, {
      recommendations: args.recommendations,
      status: "recommending",
    });

    return args.generationId;
  },
});

export const saveRecommendationsInternal = internalMutation({
  args: {
    generationId: v.id("documentGenerations"),
    recommendations: v.array(recommendationValidator),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.generationId, {
      recommendations: args.recommendations,
      status: "recommending",
    });
  },
});

export const selectSections = mutation({
  args: {
    generationId: v.id("documentGenerations"),
    selectedSectionIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyGenerationAccess(ctx, args.generationId);

    await ctx.db.patch(args.generationId, {
      selectedSectionIds: args.selectedSectionIds,
      status: "generating",
    });

    return args.generationId;
  },
});

export const linkDocument = mutation({
  args: {
    generationId: v.id("documentGenerations"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    await verifyGenerationAccess(ctx, args.generationId);

    await ctx.db.patch(args.generationId, {
      documentId: args.documentId,
    });

    return args.generationId;
  },
});

export const linkDocumentInternal = internalMutation({
  args: {
    generationId: v.id("documentGenerations"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.generationId, {
      documentId: args.documentId,
    });
  },
});

export const remove = mutation({
  args: { generationId: v.id("documentGenerations") },
  handler: async (ctx, args) => {
    await verifyGenerationAccess(ctx, args.generationId);
    await ctx.db.delete(args.generationId);
    return { success: true };
  },
});

export const getByIdInternal = internalQuery({
  args: { generationId: v.id("documentGenerations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.generationId);
  },
});
