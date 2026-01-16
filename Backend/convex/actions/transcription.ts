"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { AssemblyAI } from "assemblyai";

const LARGE_FILE_THRESHOLD_BYTES = 95 * 1024 * 1024;
const LARGE_FILE_THRESHOLD_MB = LARGE_FILE_THRESHOLD_BYTES / 1024 / 1024;
const CONVEX_NODE_MEMORY_LIMIT_MB = 512;

const DEBUG_LARGE_FILE = true;

function getMemoryInfo(): {
  heapMB: string;
  rssMB: string;
  externalMB: string;
} {
  const mem = process.memoryUsage();
  return {
    heapMB: (mem.heapUsed / 1024 / 1024).toFixed(2),
    rssMB: (mem.rss / 1024 / 1024).toFixed(2),
    externalMB: (mem.external / 1024 / 1024).toFixed(2),
  };
}

function debugLogTranscription(
  stage: string,
  message: string,
  data?: Record<string, any>,
) {
  if (!DEBUG_LARGE_FILE) return;
  const mem = getMemoryInfo();
  console.log(`[TRANSCRIPTION DEBUG] [${stage}] ${message}`);
  console.log(
    `  Memory: Heap=${mem.heapMB} MB | RSS=${mem.rssMB} MB | External=${mem.externalMB} MB`,
  );
  if (data) {
    console.log(`  Data:`, JSON.stringify(data, null, 2));
  }
}

const getClient = () => {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY not configured");
  return new AssemblyAI({ apiKey });
};

export const startTranscription = internalAction({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.jobs.getByIdInternal, {
      jobId: args.jobId,
    });
    if (!job) throw new Error("Job not found");

    const project = await ctx.runQuery(internal.projects.getByIdInternal, {
      projectId: job.projectId,
    });
    if (!project) throw new Error("Project not found");

    const user = await ctx.runQuery(internal.users.getById, {
      userId: project.userId,
    });
    if (!user) throw new Error("User not found");

    const transcripts = await ctx.runQuery(
      internal.transcripts.listByJobInternal,
      {
        jobId: args.jobId,
      },
    );

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
      const isLargeFile =
        transcript.fileSize &&
        transcript.fileSize >= LARGE_FILE_THRESHOLD_BYTES;
      const fileSizeMB = transcript.fileSize
        ? (transcript.fileSize / 1024 / 1024).toFixed(2)
        : "unknown";
      const fileSizeBytes = transcript.fileSize || 0;
      const flowType = isLargeFile ? "GCS" : "public URL";

      console.log(`\n${"=".repeat(80)}`);
      console.log(`TRANSCRIPTION PIPELINE: ${transcript.fileName}`);
      console.log(`${"=".repeat(80)}`);
      console.log(`  File ID: ${transcript.fileId}`);
      console.log(`  Transcript ID: ${transcript._id}`);
      console.log(
        `  File Size: ${fileSizeMB} MB (${fileSizeBytes.toLocaleString()} bytes)`,
      );
      console.log(`  Large File Threshold: ${LARGE_FILE_THRESHOLD_MB} MB`);
      console.log(`  Is Large File: ${isLargeFile}`);
      console.log(`  Pipeline Flow: ${flowType}`);
      console.log(`  Convex Memory Limit: ${CONVEX_NODE_MEMORY_LIMIT_MB} MB`);

      if (isLargeFile) {
        const estimatedMemoryMB = parseFloat(fileSizeMB) * 2.5;
        const memoryRisk =
          estimatedMemoryMB > CONVEX_NODE_MEMORY_LIMIT_MB * 0.7;
        console.log(`  ⚠️ LARGE FILE DETECTED - Using GCS Pipeline`);
        console.log(
          `  Estimated Memory Need: ~${estimatedMemoryMB.toFixed(0)} MB`,
        );
        console.log(
          `  Memory Risk Level: ${memoryRisk ? "🔴 HIGH RISK" : "🟡 MODERATE"}`,
        );

        if (estimatedMemoryMB > CONVEX_NODE_MEMORY_LIMIT_MB) {
          console.warn(`  🚨 WARNING: File may exceed Convex memory limit!`);
          console.warn(
            `     Estimated: ${estimatedMemoryMB.toFixed(0)} MB > Limit: ${CONVEX_NODE_MEMORY_LIMIT_MB} MB`,
          );
        }
      }
      console.log(`${"=".repeat(80)}`);

      debugLogTranscription(
        "START",
        `Beginning transcription pipeline for ${transcript.fileName}`,
        {
          transcriptId: transcript._id,
          fileId: transcript.fileId,
          fileName: transcript.fileName,
          fileSizeBytes,
          fileSizeMB,
          isLargeFile,
          flowType,
          threshold: `${LARGE_FILE_THRESHOLD_MB} MB`,
        },
      );

      const stepTimings: Record<string, number> = {};
      const startTotal = Date.now();

      try {
        await ctx.runMutation(internal.transcripts.updateStatusInternal, {
          transcriptId: transcript._id,
          status: "transcribing",
        });

        let audioUrl: string;

        if (isLargeFile) {
          debugLogTranscription(
            "LARGE_FILE_FLOW",
            "Starting GCS upload flow for large file",
            {
              fileName: transcript.fileName,
              fileSizeMB,
              userId: user._id,
            },
          );

          let stepStart = Date.now();
          console.log(
            `\n[Step 1/4] Downloading from Drive & uploading to GCS...`,
          );
          console.log(`           (This is the memory-intensive step)`);

          debugLogTranscription(
            "STEP_1_START",
            "Calling downloadAndUploadToGcs action",
          );

          let gcsFileName: string;
          try {
            gcsFileName = await ctx.runAction(
              internal.actions.drive.downloadAndUploadToGcs,
              {
                fileId: transcript.fileId,
                fileName: transcript.fileName,
                userId: user._id,
              },
            );
            stepTimings["1_download_upload"] = Date.now() - stepStart;

            debugLogTranscription(
              "STEP_1_COMPLETE",
              "Download and upload to GCS completed",
              {
                gcsFileName,
                durationMs: stepTimings["1_download_upload"],
                durationSec: (stepTimings["1_download_upload"] / 1000).toFixed(
                  2,
                ),
              },
            );

            console.log(
              `[Step 1/4] ✓ Completed in ${(stepTimings["1_download_upload"] / 1000).toFixed(1)}s`,
            );
            console.log(`           GCS File: ${gcsFileName}`);
          } catch (error: any) {
            const failDuration = Date.now() - stepStart;

            debugLogTranscription(
              "STEP_1_FAILED",
              "Download/Upload to GCS FAILED",
              {
                errorName: error.name,
                errorMessage: error.message,
                errorCode: error.code,
                errorStack: error.stack,
                durationMs: failDuration,
                fileName: transcript.fileName,
                fileSizeMB,
              },
            );

            console.error(
              `\n[Step 1/4] ✗ FAILED after ${(failDuration / 1000).toFixed(1)}s`,
            );
            console.error(`           Error: ${error.message}`);
            console.error(`           Error Name: ${error.name}`);
            console.error(`           Error Code: ${error.code || "N/A"}`);

            if (
              error.message?.includes("memory") ||
              error.message?.includes("heap") ||
              error.message?.includes("allocation")
            ) {
              console.error(`\n           🚨 MEMORY-RELATED ERROR DETECTED!`);
              console.error(
                `           This likely means the file is too large for Convex's memory limit.`,
              );
              console.error(
                `           File: ${fileSizeMB} MB | Limit: ${CONVEX_NODE_MEMORY_LIMIT_MB} MB`,
              );
            }

            throw new Error(`Download and upload failed: ${error.message}`);
          }

          stepStart = Date.now();
          console.log(`\n[Step 2/4] Saving GCS reference to database...`);
          debugLogTranscription(
            "STEP_2_START",
            "Saving GCS filename to transcript record",
          );

          try {
            await ctx.runMutation(
              internal.transcripts.updateGcsFileNameInternal,
              {
                transcriptId: transcript._id,
                gcsFileName,
              },
            );
            stepTimings["2_save_ref"] = Date.now() - stepStart;

            debugLogTranscription("STEP_2_COMPLETE", "GCS reference saved", {
              transcriptId: transcript._id,
              gcsFileName,
              durationMs: stepTimings["2_save_ref"],
            });

            console.log(`[Step 2/4] ✓ Saved in ${stepTimings["2_save_ref"]}ms`);
          } catch (error: any) {
            debugLogTranscription(
              "STEP_2_FAILED",
              "Failed to save GCS reference",
              {
                errorMessage: error.message,
                transcriptId: transcript._id,
                gcsFileName,
              },
            );
            console.error(
              `[Step 2/4] ✗ FAILED - Save GCS reference error:`,
              error.message,
            );
            throw new Error(`Save GCS reference failed: ${error.message}`);
          }

          stepStart = Date.now();
          console.log(`\n[Step 3/4] Generating signed URL...`);
          debugLogTranscription(
            "STEP_3_START",
            "Generating signed URL for GCS file",
            { gcsFileName },
          );

          try {
            audioUrl = await ctx.runAction(
              internal.actions.gcs.generateSignedUrl,
              {
                gcsFileName,
                expirationMinutes: 180,
              },
            );
            stepTimings["3_signed_url"] = Date.now() - stepStart;

            debugLogTranscription("STEP_3_COMPLETE", "Signed URL generated", {
              gcsFileName,
              expirationMinutes: 180,
              durationMs: stepTimings["3_signed_url"],
              urlLength: audioUrl?.length || 0,
            });

            console.log(
              `[Step 3/4] ✓ Generated in ${stepTimings["3_signed_url"]}ms`,
            );
          } catch (error: any) {
            debugLogTranscription(
              "STEP_3_FAILED",
              "Failed to generate signed URL",
              {
                errorMessage: error.message,
                errorCode: error.code,
                gcsFileName,
              },
            );
            console.error(`[Step 3/4] ✗ FAILED - Signed URL error:`, {
              message: error.message,
              code: error.code,
            });
            throw new Error(`Signed URL generation failed: ${error.message}`);
          }
        } else {
          const stepStart = Date.now();
          console.log(`\n[Step 1/2] Making file public on Google Drive...`);
          try {
            const publicUrl = await ctx.runAction(
              internal.actions.drive.makeFilePublic,
              {
                fileId: transcript.fileId,
                userId: user._id,
              },
            );
            stepTimings["1_make_public"] = Date.now() - stepStart;
            console.log(
              `[Step 1/2] ✓ Made public in ${stepTimings["1_make_public"]}ms`,
            );

            await ctx.runMutation(internal.transcripts.updateStatusInternal, {
              transcriptId: transcript._id,
              status: "transcribing",
              publicUrl,
            });

            audioUrl = publicUrl;
          } catch (error: any) {
            console.error(
              `[Step 1/2] ✗ FAILED - Make public error:`,
              error.message,
            );
            throw new Error(`Make file public failed: ${error.message}`);
          }
        }

        const stepStart = Date.now();
        const stepNum = isLargeFile ? "4/4" : "2/2";
        console.log(`\n[Step ${stepNum}] Submitting to AssemblyAI...`);

        const transcriptParams: any = {
          audio_url: audioUrl,
          speaker_labels: true,
        };

        if (webhookUrl) {
          transcriptParams.webhook_url = webhookUrl;
          transcriptParams.webhook_auth_header_name = "X-Webhook-Secret";
          transcriptParams.webhook_auth_header_value =
            process.env.WEBHOOK_SECRET;
        }

        try {
          const assemblyAiTranscript =
            await client.transcripts.submit(transcriptParams);
          stepTimings["submit_assemblyai"] = Date.now() - stepStart;
          console.log(
            `[Step ${stepNum}] ✓ Submitted (ID: ${assemblyAiTranscript.id}) in ${stepTimings["submit_assemblyai"]}ms`,
          );

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
            },
          );
        } catch (error: any) {
          console.error(
            `[Step ${stepNum}] ✗ FAILED - AssemblyAI submit error:`,
            error.message,
          );
          throw new Error(`AssemblyAI submit failed: ${error.message}`);
        }

        const totalTime = Date.now() - startTotal;

        debugLogTranscription(
          "PIPELINE_SUCCESS",
          `Transcription pipeline completed for ${transcript.fileName}`,
          {
            fileName: transcript.fileName,
            fileSizeMB,
            isLargeFile,
            totalTimeMs: totalTime,
            totalTimeSec: (totalTime / 1000).toFixed(2),
            stepTimings,
          },
        );

        console.log(`\n${"=".repeat(80)}`);
        console.log(`✓ TRANSCRIPTION PIPELINE SUCCESS: ${transcript.fileName}`);
        console.log(`  File Size: ${fileSizeMB} MB`);
        console.log(`  Pipeline: ${flowType}`);
        console.log(`  Total time: ${(totalTime / 1000).toFixed(1)}s`);
        console.log(`  Step timings:`, stepTimings);
        console.log(`${"=".repeat(80)}\n`);

        return { success: true, transcriptId: transcript._id };
      } catch (error: any) {
        const totalTime = Date.now() - startTotal;

        debugLogTranscription(
          "PIPELINE_FAILED",
          `Transcription pipeline FAILED for ${transcript.fileName}`,
          {
            fileName: transcript.fileName,
            fileSizeMB,
            fileSizeBytes,
            isLargeFile,
            flowType,
            totalTimeMs: totalTime,
            totalTimeSec: (totalTime / 1000).toFixed(2),
            stepTimings,
            errorName: error.name,
            errorMessage: error.message,
            errorCode: error.code,
            errorStack: error.stack,
          },
        );

        console.error(`\n${"=".repeat(80)}`);
        console.error(
          `✗ TRANSCRIPTION PIPELINE FAILED: ${transcript.fileName}`,
        );
        console.error(
          `  File Size: ${fileSizeMB} MB (${fileSizeBytes?.toLocaleString() || "unknown"} bytes)`,
        );
        console.error(`  Pipeline: ${flowType}`);
        console.error(`  Error: ${error.message}`);
        console.error(`  Error Name: ${error.name}`);
        console.error(`  Error Code: ${error.code || "N/A"}`);
        console.error(`  Failed after: ${(totalTime / 1000).toFixed(1)}s`);
        console.error(`Step timings before failure:`, stepTimings);
        console.error(`${"=".repeat(60)}\n`);

        await cleanupTranscriptResources(ctx, transcript, user._id);

        await ctx.runMutation(internal.transcripts.updateStatusInternal, {
          transcriptId: transcript._id,
          status: "failed",
          error: error.message,
        });

        const keyIdea = await ctx.runQuery(
          internal.keyIdeas.getByTranscriptInternal,
          {
            transcriptId: transcript._id,
          },
        );
        if (keyIdea) {
          await ctx.runMutation(internal.keyIdeas.updateStatusInternal, {
            keyIdeaId: keyIdea._id,
            status: "failed",
            error: "Transcription failed",
          });
        }

        await ctx.runMutation(internal.jobs.checkCompletion, {
          jobId: args.jobId,
        });

        return {
          success: false,
          transcriptId: transcript._id,
          error: error.message,
        };
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
    const transcript = await ctx.runQuery(
      internal.transcripts.getByIdInternal,
      {
        transcriptId: args.transcriptId,
      },
    );
    if (!transcript) return;

    if (transcript.status === "completed" || transcript.status === "failed")
      return;

    const job = await ctx.runQuery(internal.jobs.getByIdInternal, {
      jobId: transcript.jobId,
    });
    if (!job || job.status === "completed" || job.status === "failed") return;

    const client = getClient();

    try {
      const result = await client.transcripts.get(args.assemblyAiTranscriptId);

      if (result.status === "completed") {
        await handleTranscriptCompleted(ctx, transcript, result);
      } else if (result.status === "error") {
        await handleTranscriptError(
          ctx,
          transcript,
          result.error || "Unknown error",
        );
      } else {
        await ctx.scheduler.runAfter(
          60 * 1000,
          internal.actions.transcription.checkTranscriptStatus,
          args,
        );
      }
    } catch (error: any) {
      console.error("Failed to check transcript status:", error);
      await ctx.scheduler.runAfter(
        60 * 1000,
        internal.actions.transcription.checkTranscriptStatus,
        args,
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
    const transcript = await ctx.runQuery(
      internal.transcripts.findByAssemblyAiId,
      {
        assemblyAiTranscriptId: args.transcriptId,
      },
    );

    if (!transcript) {
      console.error(
        "No transcript found for AssemblyAI ID:",
        args.transcriptId,
      );
      return;
    }

    if (args.status === "completed") {
      const client = getClient();
      const fullTranscript = await client.transcripts.get(args.transcriptId);
      await handleTranscriptCompleted(ctx, transcript, fullTranscript);
    } else if (args.status === "error") {
      await handleTranscriptError(
        ctx,
        transcript,
        args.error || "Unknown error",
      );
    }
  },
});

async function cleanupTranscriptResources(
  ctx: any,
  transcript: any,
  userId: any,
) {
  console.log(`Cleaning up resources for ${transcript.fileName}...`);

  if (transcript.gcsFileName) {
    try {
      console.log(`  - Deleting GCS file: ${transcript.gcsFileName}`);
      await ctx.runAction(internal.actions.gcs.deleteFile, {
        gcsFileName: transcript.gcsFileName,
      });
    } catch (e: any) {
      console.error(`  - Failed to cleanup GCS file:`, e.message);
    }
  }

  if (transcript.publicUrl) {
    try {
      console.log(`  - Revoking public access for Drive file`);
      await ctx.runAction(internal.actions.drive.revokeFilePublicAccess, {
        fileId: transcript.fileId,
        userId,
      });
    } catch (e: any) {
      console.error(`  - Failed to revoke public access:`, e.message);
    }
  }

  console.log(`Cleanup complete for ${transcript.fileName}`);
}

async function handleTranscriptCompleted(
  ctx: any,
  transcript: any,
  assemblyAiResult: any,
) {
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

  const job = await ctx.runQuery(internal.jobs.getByIdInternal, {
    jobId: transcript.jobId,
  });
  if (job) {
    const project = await ctx.runQuery(internal.projects.getByIdInternal, {
      projectId: job.projectId,
    });
    if (project) {
      await cleanupTranscriptResources(ctx, transcript, project.userId);
    }
  }

  const keyIdea = await ctx.runQuery(
    internal.keyIdeas.getByTranscriptInternal,
    {
      transcriptId: transcript._id,
    },
  );

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

  const keyIdea = await ctx.runQuery(
    internal.keyIdeas.getByTranscriptInternal,
    {
      transcriptId: transcript._id,
    },
  );
  if (keyIdea) {
    await ctx.runMutation(internal.keyIdeas.updateStatusInternal, {
      keyIdeaId: keyIdea._id,
      status: "failed",
      error: "Transcription failed",
    });
  }

  const job = await ctx.runQuery(internal.jobs.getByIdInternal, {
    jobId: transcript.jobId,
  });
  if (job) {
    const project = await ctx.runQuery(internal.projects.getByIdInternal, {
      projectId: job.projectId,
    });
    if (project) {
      await cleanupTranscriptResources(ctx, transcript, project.userId);
    }
  }

  await ctx.runMutation(internal.jobs.checkCompletion, {
    jobId: transcript.jobId,
  });
}
