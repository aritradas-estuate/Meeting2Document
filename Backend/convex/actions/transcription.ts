"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { AssemblyAI } from "assemblyai";

const getClient = () => {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY not configured");
  return new AssemblyAI({ apiKey });
};

export const startTranscription = internalAction({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.jobs.getByIdInternal, { jobId: args.jobId });
    if (!job) throw new Error("Job not found");

    const project = await ctx.runQuery(internal.projects.getByIdInternal, {
      projectId: job.projectId,
    });
    if (!project) throw new Error("Project not found");

    const user = await ctx.runQuery(internal.users.getById, { userId: project.userId });
    if (!user) throw new Error("User not found");

    const transcripts = await ctx.runQuery(internal.transcripts.listByJobInternal, {
      jobId: args.jobId,
    });

    const client = getClient();
    const webhookUrl = process.env.CONVEX_SITE_URL
      ? `${process.env.CONVEX_SITE_URL}/webhooks/assemblyai`
      : null;

    await ctx.runMutation(internal.jobs.updateStatus, {
      jobId: args.jobId,
      status: "transcribing",
      currentStage: "transcribing",
      stageProgress: {
        stage: "transcribing",
        progress: 0,
        message: `Starting transcription for ${transcripts.length} file(s)...`,
        filesCompleted: 0,
        totalFiles: transcripts.length,
      },
    });

    const processTranscript = async (transcript: any) => {
      try {
        await ctx.runMutation(internal.transcripts.updateStatusInternal, {
          transcriptId: transcript._id,
          status: "transcribing",
        });

        const publicUrl = await ctx.runAction(internal.actions.drive.makeFilePublic, {
          fileId: transcript.fileId,
          userId: user._id,
        });

        await ctx.runMutation(internal.transcripts.updateStatusInternal, {
          transcriptId: transcript._id,
          status: "transcribing",
          publicUrl,
        });

        const transcriptParams: any = {
          audio_url: publicUrl,
          speaker_labels: true,
        };

        if (webhookUrl) {
          transcriptParams.webhook_url = webhookUrl;
          transcriptParams.webhook_auth_header_name = "X-Webhook-Secret";
          transcriptParams.webhook_auth_header_value = process.env.WEBHOOK_SECRET;
        }

        const assemblyAiTranscript = await client.transcripts.submit(transcriptParams);

        await ctx.runMutation(internal.transcripts.updateStatusInternal, {
          transcriptId: transcript._id,
          status: "transcribing",
          assemblyAiTranscriptId: assemblyAiTranscript.id,
        });

        const fallbackDelayMs = 15 * 60 * 1000;
        await ctx.scheduler.runAfter(
          fallbackDelayMs,
          internal.actions.transcription.checkTranscriptStatus,
          {
            transcriptId: transcript._id,
            assemblyAiTranscriptId: assemblyAiTranscript.id,
          }
        );

        return { success: true, transcriptId: transcript._id };
      } catch (error: any) {
        console.error(`Failed to start transcription for ${transcript.fileName}:`, error);

        try {
          await ctx.runAction(internal.actions.drive.revokeFilePublicAccess, {
            fileId: transcript.fileId,
            userId: user._id,
          });
        } catch {}

        await ctx.runMutation(internal.transcripts.updateStatusInternal, {
          transcriptId: transcript._id,
          status: "failed",
          error: error.message,
        });

        const keyIdea = await ctx.runQuery(internal.keyIdeas.getByTranscriptInternal, {
          transcriptId: transcript._id,
        });
        if (keyIdea) {
          await ctx.runMutation(internal.keyIdeas.updateStatusInternal, {
            keyIdeaId: keyIdea._id,
            status: "failed",
            error: "Transcription failed",
          });
        }

        await ctx.runMutation(internal.jobs.checkCompletion, { jobId: args.jobId });

        return { success: false, transcriptId: transcript._id, error: error.message };
      }
    };

    await Promise.all(transcripts.map(processTranscript));

    await ctx.runMutation(internal.jobs.updateStatus, {
      jobId: args.jobId,
      status: "transcribing",
      stageProgress: {
        stage: "transcribing",
        progress: 50,
        message: "Waiting for transcriptions to complete...",
        filesCompleted: 0,
        totalFiles: transcripts.length,
      },
    });
  },
});

export const checkTranscriptStatus = internalAction({
  args: {
    transcriptId: v.id("transcripts"),
    assemblyAiTranscriptId: v.string(),
  },
  handler: async (ctx, args) => {
    const transcript = await ctx.runQuery(internal.transcripts.getByIdInternal, {
      transcriptId: args.transcriptId,
    });
    if (!transcript) return;

    if (transcript.status === "completed" || transcript.status === "failed") return;

    const job = await ctx.runQuery(internal.jobs.getByIdInternal, { jobId: transcript.jobId });
    if (!job || job.status === "completed" || job.status === "failed") return;

    const client = getClient();

    try {
      const result = await client.transcripts.get(args.assemblyAiTranscriptId);

      if (result.status === "completed") {
        await handleTranscriptCompleted(ctx, transcript, result);
      } else if (result.status === "error") {
        await handleTranscriptError(ctx, transcript, result.error || "Unknown error");
      } else {
        await ctx.scheduler.runAfter(
          60 * 1000,
          internal.actions.transcription.checkTranscriptStatus,
          args
        );
      }
    } catch (error: any) {
      console.error("Failed to check transcript status:", error);
      await ctx.scheduler.runAfter(
        60 * 1000,
        internal.actions.transcription.checkTranscriptStatus,
        args
      );
    }
  },
});

export const handleWebhook = internalAction({
  args: {
    transcriptId: v.string(),
    status: v.string(),
    text: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const transcript = await ctx.runQuery(internal.transcripts.findByAssemblyAiId, {
      assemblyAiTranscriptId: args.transcriptId,
    });

    if (!transcript) {
      console.error("No transcript found for AssemblyAI ID:", args.transcriptId);
      return;
    }

    if (args.status === "completed") {
      const client = getClient();
      const fullTranscript = await client.transcripts.get(args.transcriptId);
      await handleTranscriptCompleted(ctx, transcript, fullTranscript);
    } else if (args.status === "error") {
      await handleTranscriptError(ctx, transcript, args.error || "Unknown error");
    }
  },
});

async function handleTranscriptCompleted(ctx: any, transcript: any, assemblyAiResult: any) {
  if (transcript.status === "completed") {
    console.log(`Transcript ${transcript._id} already completed, skipping`);
    return;
  }

  const text = assemblyAiResult.text || "";
  const utterances = assemblyAiResult.utterances?.map((u: any) => ({
    speaker: u.speaker,
    text: u.text,
    start: u.start,
    end: u.end,
  }));

  await ctx.runMutation(internal.transcripts.saveResultInternal, {
    transcriptId: transcript._id,
    text,
    utterances,
  });

  if (transcript.publicUrl) {
    const job = await ctx.runQuery(internal.jobs.getByIdInternal, { jobId: transcript.jobId });
    if (job) {
      const project = await ctx.runQuery(internal.projects.getByIdInternal, {
        projectId: job.projectId,
      });
      if (project) {
        try {
          await ctx.runAction(internal.actions.drive.revokeFilePublicAccess, {
            fileId: transcript.fileId,
            userId: project.userId,
          });
        } catch {}
      }
    }
  }

  const keyIdea = await ctx.runQuery(internal.keyIdeas.getByTranscriptInternal, {
    transcriptId: transcript._id,
  });

  if (keyIdea && keyIdea.status === "pending") {
    await ctx.runAction(internal.actions.extraction.extractSingle, {
      transcriptId: transcript._id,
      keyIdeaId: keyIdea._id,
    });
  }
}

async function handleTranscriptError(ctx: any, transcript: any, error: string) {
  await ctx.runMutation(internal.transcripts.updateStatusInternal, {
    transcriptId: transcript._id,
    status: "failed",
    error,
  });

  const keyIdea = await ctx.runQuery(internal.keyIdeas.getByTranscriptInternal, {
    transcriptId: transcript._id,
  });
  if (keyIdea) {
    await ctx.runMutation(internal.keyIdeas.updateStatusInternal, {
      keyIdeaId: keyIdea._id,
      status: "failed",
      error: "Transcription failed",
    });
  }

  if (transcript.publicUrl) {
    const job = await ctx.runQuery(internal.jobs.getByIdInternal, { jobId: transcript.jobId });
    if (job) {
      const project = await ctx.runQuery(internal.projects.getByIdInternal, {
        projectId: job.projectId,
      });
      if (project) {
        try {
          await ctx.runAction(internal.actions.drive.revokeFilePublicAccess, {
            fileId: transcript.fileId,
            userId: project.userId,
          });
        } catch {}
      }
    }
  }

  await ctx.runMutation(internal.jobs.checkCompletion, { jobId: transcript.jobId });
}
