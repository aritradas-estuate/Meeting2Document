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

async function verifyDocumentAccess(ctx: any, documentId: Id<"documents">) {
  const document = await ctx.db.get(documentId);
  if (!document) throw new Error("Document not found");

  await verifyProjectAccess(ctx, document.projectId);
  return document;
}

export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("generating"),
        v.literal("complete"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    if (args.projectId) {
      await verifyProjectAccess(ctx, args.projectId);

      let documents = await ctx.db
        .query("documents")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
        .order("desc")
        .collect();

      if (args.status) {
        documents = documents.filter((d) => d.status === args.status);
      }

      return documents;
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const projectIds = new Set(projects.map((p) => p._id));

    let documents = await ctx.db.query("documents").order("desc").collect();
    documents = documents.filter((d) => projectIds.has(d.projectId));

    if (args.status) {
      documents = documents.filter((d) => d.status === args.status);
    }

    return documents;
  },
});

export const get = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await verifyDocumentAccess(ctx, args.documentId);
  },
});

export const getWithSections = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const document = await verifyDocumentAccess(ctx, args.documentId);

    const sections = await ctx.db
      .query("documentSections")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    return {
      ...document,
      sections,
    };
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    jobId: v.optional(v.id("jobs")),
    title: v.string(),
    schemaType: v.string(),
    content: v.optional(v.any()),
    markdownContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);

    const documentId = await ctx.db.insert("documents", {
      projectId: args.projectId,
      jobId: args.jobId,
      title: args.title,
      schemaType: args.schemaType,
      content: args.content,
      markdownContent: args.markdownContent,
      version: 1,
      status: "draft",
    });

    return documentId;
  },
});

export const update = mutation({
  args: {
    documentId: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.any()),
    markdownContent: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("generating"),
        v.literal("complete"),
      ),
    ),
    driveFileId: v.optional(v.string()),
    driveFileUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const document = await verifyDocumentAccess(ctx, args.documentId);

    const { documentId, ...updates } = args;
    const filteredUpdates: any = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    if (
      filteredUpdates.content !== undefined ||
      filteredUpdates.markdownContent !== undefined
    ) {
      filteredUpdates.version = document.version + 1;
    }

    await ctx.db.patch(args.documentId, filteredUpdates);
    return args.documentId;
  },
});

export const remove = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    await verifyDocumentAccess(ctx, args.documentId);

    const sections = await ctx.db
      .query("documentSections")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    for (const section of sections) {
      await ctx.db.delete(section._id);
    }

    await ctx.db.delete(args.documentId);
    return { success: true };
  },
});

export const getSection = query({
  args: {
    documentId: v.id("documents"),
    sectionId: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyDocumentAccess(ctx, args.documentId);

    const section = await ctx.db
      .query("documentSections")
      .withIndex("by_document_section", (q) =>
        q.eq("documentId", args.documentId).eq("sectionId", args.sectionId),
      )
      .first();

    if (!section) throw new Error("Section not found");
    return section;
  },
});

export const updateSection = mutation({
  args: {
    documentId: v.id("documents"),
    sectionId: v.string(),
    content: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("generating"),
        v.literal("reviewing"),
        v.literal("complete"),
        v.literal("skipped"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await verifyDocumentAccess(ctx, args.documentId);

    const section = await ctx.db
      .query("documentSections")
      .withIndex("by_document_section", (q) =>
        q.eq("documentId", args.documentId).eq("sectionId", args.sectionId),
      )
      .first();

    if (!section) throw new Error("Section not found");

    const updates: any = {};
    if (args.content !== undefined) updates.content = args.content;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(section._id, updates);
    return section._id;
  },
});

export const createSection = mutation({
  args: {
    documentId: v.id("documents"),
    sectionId: v.string(),
    sectionTitle: v.string(),
    content: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("generating"),
        v.literal("reviewing"),
        v.literal("complete"),
        v.literal("skipped"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await verifyDocumentAccess(ctx, args.documentId);

    const sectionId = await ctx.db.insert("documentSections", {
      documentId: args.documentId,
      sectionId: args.sectionId,
      sectionTitle: args.sectionTitle,
      content: args.content,
      status: args.status ?? "pending",
      generationHistory: [],
      reviewCount: 0,
    });

    return sectionId;
  },
});

export const exportMarkdown = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const document = await verifyDocumentAccess(ctx, args.documentId);

    if (!document.markdownContent) {
      throw new Error("Document has no markdown content");
    }

    return {
      format: "markdown",
      content: document.markdownContent,
    };
  },
});

export const createInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    schemaType: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", {
      projectId: args.projectId,
      title: args.title,
      schemaType: args.schemaType,
      version: 1,
      status: "generating",
    });
  },
});

export const createSectionInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
    sectionId: v.string(),
    sectionTitle: v.string(),
    sourceFileNames: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documentSections", {
      documentId: args.documentId,
      sectionId: args.sectionId,
      sectionTitle: args.sectionTitle,
      status: "pending",
      sourceFileNames: args.sourceFileNames,
      generationHistory: [],
      reviewCount: 0,
    });
  },
});

export const updateSectionStatusInternal = internalMutation({
  args: {
    documentSectionId: v.id("documentSections"),
    status: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("reviewing"),
      v.literal("complete"),
      v.literal("skipped"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentSectionId, { status: args.status });
  },
});

const generationHistoryEntryValidator = v.object({
  draftNumber: v.number(),
  content: v.string(),
  generatedAt: v.number(),
  writerModel: v.string(),
  reviewerModel: v.optional(v.string()),
  reviewerFeedback: v.optional(v.string()),
  approved: v.boolean(),
});

export const saveSectionContentInternal = internalMutation({
  args: {
    documentSectionId: v.id("documentSections"),
    content: v.string(),
    generationHistory: v.array(generationHistoryEntryValidator),
    finalDraftNumber: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentSectionId, {
      content: args.content,
      status: "complete",
      generationHistory: args.generationHistory,
      finalDraftNumber: args.finalDraftNumber,
      reviewCount: args.generationHistory.length,
    });
  },
});

export const getWithSectionsInternal = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) return null;

    const sections = await ctx.db
      .query("documentSections")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    return { ...document, sections };
  },
});

export const updateMarkdownContentInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
    markdownContent: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");

    await ctx.db.patch(args.documentId, {
      markdownContent: args.markdownContent,
      status: "complete",
      version: doc.version + 1,
    });
  },
});

export const getByIdInternal = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.documentId);
  },
});

export const updateDriveFileInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
    driveFileId: v.string(),
    driveFileUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      driveFileId: args.driveFileId,
      driveFileUrl: args.driveFileUrl,
    });
  },
});
