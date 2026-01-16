import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const driveFileValidator = v.object({
  id: v.string(),
  name: v.string(),
  mimeType: v.string(),
  size: v.optional(v.number()),
  webViewLink: v.optional(v.string()),
});

const driveFolderValidator = v.object({
  id: v.string(),
  name: v.string(),
});

const jobStatusValidator = v.union(
  v.literal("pending"),
  v.literal("transcribing"),
  v.literal("extracting"),
  v.literal("synthesizing"),
  v.literal("generating"),
  v.literal("reviewing"),
  v.literal("assembling"),
  v.literal("uploading"),
  v.literal("completed"),
  v.literal("failed")
);

const projectStatusValidator = v.union(
  v.literal("active"),
  v.literal("archived")
);

const documentStatusValidator = v.union(
  v.literal("draft"),
  v.literal("generating"),
  v.literal("complete")
);

const sectionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("generating"),
  v.literal("reviewing"),
  v.literal("complete"),
  v.literal("skipped")
);

const transcriptStatusValidator = v.union(
  v.literal("pending"),
  v.literal("transcribing"),
  v.literal("completed"),
  v.literal("failed")
);

const extractionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("extracting"),
  v.literal("completed"),
  v.literal("failed")
);

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    googleAccessToken: v.optional(v.string()),
    googleRefreshToken: v.optional(v.string()),
    googleTokenExpiresAt: v.optional(v.number()),
  })
    .index("email", ["email"]),

  projects: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    driveFolders: v.optional(v.array(driveFolderValidator)),
    schemaType: v.string(),
    modelConfig: v.optional(v.any()),
    status: projectStatusValidator,
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  jobs: defineTable({
    projectId: v.id("projects"),
    status: jobStatusValidator,
    videoFiles: v.array(driveFileValidator),
    supportingFiles: v.optional(v.array(driveFileValidator)),
    currentStage: v.optional(v.string()),
    stageProgress: v.optional(v.object({
      stage: v.string(),
      progress: v.number(),
      message: v.optional(v.string()),
      filesCompleted: v.optional(v.number()),
      totalFiles: v.optional(v.number()),
    })),
    errorMessage: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_status", ["status"])
    .index("by_project_status", ["projectId", "status"]),

  transcripts: defineTable({
    jobId: v.id("jobs"),
    projectId: v.id("projects"),
    fileId: v.string(),
    fileName: v.string(),
    fileSize: v.optional(v.number()),
    status: transcriptStatusValidator,
    assemblyAiTranscriptId: v.optional(v.string()),
    publicUrl: v.optional(v.string()),
    gcsFileName: v.optional(v.string()),
    text: v.optional(v.string()),
    utterances: v.optional(v.array(v.object({
      speaker: v.string(),
      text: v.string(),
      start: v.number(),
      end: v.number(),
    }))),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_job", ["jobId"])
    .index("by_project", ["projectId"])
    .index("by_file", ["fileId"])
    .index("by_assemblyai_id", ["assemblyAiTranscriptId"]),

  keyIdeas: defineTable({
    jobId: v.id("jobs"),
    projectId: v.id("projects"),
    transcriptId: v.id("transcripts"),
    fileId: v.string(),
    fileName: v.string(),
    status: extractionStatusValidator,
    extraction: v.optional(v.any()),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_job", ["jobId"])
    .index("by_project", ["projectId"])
    .index("by_transcript", ["transcriptId"]),

  documents: defineTable({
    projectId: v.id("projects"),
    jobId: v.optional(v.id("jobs")),
    title: v.string(),
    schemaType: v.string(),
    content: v.optional(v.any()),
    markdownContent: v.optional(v.string()),
    driveFileId: v.optional(v.string()),
    driveFileUrl: v.optional(v.string()),
    version: v.number(),
    status: documentStatusValidator,
  })
    .index("by_project", ["projectId"])
    .index("by_job", ["jobId"]),

  documentSections: defineTable({
    documentId: v.id("documents"),
    sectionId: v.string(),
    sectionTitle: v.string(),
    content: v.optional(v.string()),
    status: sectionStatusValidator,
    generationHistory: v.array(v.object({
      draftNumber: v.number(),
      content: v.string(),
      generatedAt: v.string(),
      model: v.string(),
      feedback: v.optional(v.string()),
    })),
    reviewCount: v.number(),
    finalDraftNumber: v.optional(v.number()),
  })
    .index("by_document", ["documentId"])
    .index("by_document_section", ["documentId", "sectionId"]),
});
