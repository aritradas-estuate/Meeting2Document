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
  v.literal("failed"),
);

const projectStatusValidator = v.union(
  v.literal("active"),
  v.literal("archived"),
);

const documentStatusValidator = v.union(
  v.literal("draft"),
  v.literal("generating"),
  v.literal("complete"),
);

const sectionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("generating"),
  v.literal("reviewing"),
  v.literal("complete"),
  v.literal("skipped"),
);

const transcriptStatusValidator = v.union(
  v.literal("pending"),
  v.literal("transcribing"),
  v.literal("completed"),
  v.literal("failed"),
);

const extractionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("extracting"),
  v.literal("completed"),
  v.literal("failed"),
);

const generationStatusValidator = v.union(
  v.literal("selecting"),
  v.literal("analyzing"),
  v.literal("recommending"),
  v.literal("generating"),
  v.literal("completed"),
  v.literal("failed"),
);

const confidenceLevelValidator = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
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
  }).index("email", ["email"]),

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
    stageProgress: v.optional(
      v.object({
        stage: v.string(),
        progress: v.number(),
        message: v.optional(v.string()),
        filesCompleted: v.optional(v.number()),
        totalFiles: v.optional(v.number()),
      }),
    ),
    errorMessage: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
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
    utterances: v.optional(
      v.array(
        v.object({
          speaker: v.string(),
          text: v.string(),
          start: v.number(),
          end: v.number(),
        }),
      ),
    ),
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
    generationId: v.optional(v.id("documentGenerations")),
    sectionId: v.string(),
    sectionTitle: v.string(),
    content: v.optional(v.string()),
    status: sectionStatusValidator,
    sourceFileNames: v.optional(v.array(v.string())),
    generationHistory: v.array(
      v.object({
        draftNumber: v.number(),
        content: v.string(),
        generatedAt: v.number(),
        writerModel: v.string(),
        reviewerModel: v.optional(v.string()),
        reviewerFeedback: v.optional(v.string()),
        approved: v.boolean(),
      }),
    ),
    reviewCount: v.number(),
    finalDraftNumber: v.optional(v.number()),
  })
    .index("by_document", ["documentId"])
    .index("by_document_section", ["documentId", "sectionId"])
    .index("by_generation", ["generationId"]),

  documentGenerations: defineTable({
    projectId: v.id("projects"),
    status: generationStatusValidator,
    selectedSources: v.array(
      v.object({
        transcriptId: v.id("transcripts"),
        keyIdeaId: v.id("keyIdeas"),
        fileName: v.string(),
      }),
    ),
    recommendations: v.optional(
      v.array(
        v.object({
          sectionId: v.string(),
          sectionTitle: v.string(),
          confidence: confidenceLevelValidator,
          summary: v.string(),
          sourceFileNames: v.array(v.string()),
        }),
      ),
    ),
    selectedSectionIds: v.optional(v.array(v.string())),
    documentId: v.optional(v.id("documents")),
    errorMessage: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_status", ["status"]),
});
