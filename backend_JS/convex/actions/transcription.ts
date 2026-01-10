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

    const client = getClient();
    const webhookUrl = process.env.CONVEX_SITE_URL
      ? `${process.env.CONVEX_SITE_URL}/webhooks/assemblyai`
      : null;

    for (let i = 0; i < job.videoFiles.length; i++) {
      const file = job.videoFiles[i]!;

      try {
        await ctx.runMutation(internal.jobs.updateStatus, {
          jobId: args.jobId,
          status: "transcribing",
          currentStage: "transcribing",
          stageProgress: {
            stage: "transcribing",
            progress: Math.round((i / job.videoFiles.length) * 50),
            message: `Making file public: ${file.name}`,
            filesCompleted: i,
            totalFiles: job.videoFiles.length,
          },
        });

        const publicUrl = await ctx.runAction(internal.actions.drive.makeFilePublic, {
          fileId: file.id,
          userId: user._id,
        });

        await ctx.runMutation(internal.jobs.updateStatus, {
          jobId: args.jobId,
          status: "transcribing",
          stageProgress: {
            stage: "transcribing",
            progress: Math.round((i / job.videoFiles.length) * 50) + 10,
            message: `Submitting for transcription: ${file.name}`,
            filesCompleted: i,
            totalFiles: job.videoFiles.length,
          },
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

        const transcript = await client.transcripts.submit(transcriptParams);

        await ctx.runMutation(internal.jobs.addTranscriptId, {
          jobId: args.jobId,
          fileId: file.id,
          fileName: file.name,
          transcriptId: transcript.id,
          publicUrl,
        });

        const fallbackDelayMs = 15 * 60 * 1000;
        await ctx.scheduler.runAfter(
          fallbackDelayMs,
          internal.actions.transcription.checkTranscriptStatus,
          {
            jobId: args.jobId,
            transcriptId: transcript.id,
            fileId: file.id,
          }
        );
      } catch (error: any) {
        console.error(`Failed to start transcription for ${file.name}:`, error);

        try {
          await ctx.runAction(internal.actions.drive.revokeFilePublicAccess, {
            fileId: file.id,
            userId: user._id,
          });
        } catch {}

        await ctx.runMutation(internal.jobs.updateStatus, {
          jobId: args.jobId,
          status: "failed",
          errorMessage: `Failed to transcribe ${file.name}: ${error.message}`,
        });
        return;
      }
    }

    await ctx.runMutation(internal.jobs.updateStatus, {
      jobId: args.jobId,
      status: "transcribing",
      stageProgress: {
        stage: "transcribing",
        progress: 50,
        message: "Waiting for transcriptions to complete...",
        filesCompleted: 0,
        totalFiles: job.videoFiles.length,
      },
    });
  },
});

export const checkTranscriptStatus = internalAction({
  args: {
    jobId: v.id("jobs"),
    transcriptId: v.string(),
    fileId: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.jobs.getByIdInternal, { jobId: args.jobId });
    if (!job) return;

    if (job.status === "completed" || job.status === "failed") return;

    const transcript = (job.transcripts || []).find((t: { transcriptId: string }) => t.transcriptId === args.transcriptId);
    if (!transcript) return;

    if (transcript.status === "completed" || transcript.status === "error") return;

    const client = getClient();

    try {
      const result = await client.transcripts.get(args.transcriptId);

      if (result.status === "completed") {
        await handleTranscriptCompleted(ctx, args.jobId, args.transcriptId, result.text || "");
      } else if (result.status === "error") {
        await handleTranscriptError(
          ctx,
          args.jobId,
          args.transcriptId,
          result.error || "Unknown error"
        );
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
    const result = await ctx.runQuery(internal.jobs.findByTranscriptId, {
      transcriptId: args.transcriptId,
    });

    if (!result) {
      console.error("No job found for transcript:", args.transcriptId);
      return;
    }

    const { job } = result;

    if (args.status === "completed" && args.text) {
      await handleTranscriptCompleted(ctx, job._id, args.transcriptId, args.text);
    } else if (args.status === "error") {
      await handleTranscriptError(ctx, job._id, args.transcriptId, args.error || "Unknown error");
    }
  },
});

async function handleTranscriptCompleted(
  ctx: any,
  jobId: any,
  transcriptId: string,
  text: string
) {
  await ctx.runMutation(internal.jobs.updateTranscriptStatus, {
    jobId,
    transcriptId,
    status: "completed",
  });

  const job = await ctx.runQuery(internal.jobs.getByIdInternal, { jobId });
  if (!job) return;

  const transcript = (job.transcripts || []).find((t: any) => t.transcriptId === transcriptId);
  if (transcript?.publicUrl) {
    const project = await ctx.runQuery(internal.projects.getByIdInternal, {
      projectId: job.projectId,
    });
    if (project) {
      const fileId = transcript.fileId;
      try {
        await ctx.runAction(internal.actions.drive.revokeFilePublicAccess, {
          fileId,
          userId: project.userId,
        });
      } catch {}
    }
  }

  const allCompleted = (job.transcripts || []).every(
    (t: any) => t.transcriptId === transcriptId || t.status === "completed" || t.status === "error"
  );

  if (allCompleted) {
    await ctx.runAction(internal.actions.extraction.extractAll, { jobId });
  }
}

async function handleTranscriptError(ctx: any, jobId: any, transcriptId: string, error: string) {
  await ctx.runMutation(internal.jobs.updateTranscriptStatus, {
    jobId,
    transcriptId,
    status: "error",
  });

  const job = await ctx.runQuery(internal.jobs.getByIdInternal, { jobId });
  if (!job) return;

  const transcript = (job.transcripts || []).find((t: any) => t.transcriptId === transcriptId);
  if (transcript) {
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

  await ctx.runMutation(internal.jobs.updateStatus, {
    jobId,
    status: "failed",
    errorMessage: `Transcription failed: ${error}`,
  });
}
