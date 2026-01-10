"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import OpenAI from "openai";
import { AssemblyAI } from "assemblyai";
import { MEETING_EXTRACTION_PROMPT, EXTRACTION_JSON_SCHEMA } from "../lib/prompts";

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  return new OpenAI({ apiKey });
};

const getAssemblyAIClient = () => {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY not configured");
  return new AssemblyAI({ apiKey });
};

export const extractAll = internalAction({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.jobs.getByIdInternal, { jobId: args.jobId });
    if (!job) throw new Error("Job not found");

    if (job.status === "completed" || job.status === "failed") return;

    await ctx.runMutation(internal.jobs.updateStatus, {
      jobId: args.jobId,
      status: "extracting",
      currentStage: "extracting",
      stageProgress: {
        stage: "extracting",
        progress: 0,
        message: "Fetching transcripts...",
        filesCompleted: 0,
        totalFiles: job.videoFiles.length,
      },
    });

    const assemblyai = getAssemblyAIClient();
    const openai = getOpenAIClient();

    const fileResults: any[] = [];
    const transcripts = job.transcripts || [];

    for (let i = 0; i < transcripts.length; i++) {
      const transcript = transcripts[i]!;
      const videoFile = job.videoFiles.find((f: { id: string }) => f.id === transcript.fileId);

      await ctx.runMutation(internal.jobs.updateStatus, {
        jobId: args.jobId,
        status: "extracting",
        stageProgress: {
          stage: "extracting",
          progress: Math.round((i / transcripts.length) * 100),
          message: `Extracting from: ${transcript.fileName}`,
          filesCompleted: i,
          totalFiles: transcripts.length,
        },
      });

      try {
        let transcriptText = "";

        if (transcript.status === "completed") {
          const fullTranscript = await assemblyai.transcripts.get(transcript.transcriptId);
          transcriptText = fullTranscript.text || "";
        } else if (transcript.status === "error") {
          fileResults.push({
            fileId: transcript.fileId,
            fileName: transcript.fileName,
            fileSize: videoFile?.size ?? null,
            status: "failed",
            error: "Transcription failed",
          });
          continue;
        } else {
          fileResults.push({
            fileId: transcript.fileId,
            fileName: transcript.fileName,
            fileSize: videoFile?.size ?? null,
            status: "failed",
            error: "Transcript not ready",
          });
          continue;
        }

        const prompt = MEETING_EXTRACTION_PROMPT.replace("{transcript}", transcriptText);

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          response_format: {
            type: "json_schema",
            json_schema: EXTRACTION_JSON_SCHEMA as any,
          },
          messages: [
            {
              role: "system",
              content:
                "You are an expert at extracting structured information from meeting transcripts. Extract all relevant information accurately.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 4000,
          temperature: 0,
        });

        const extractionContent = response.choices[0]?.message?.content;
        if (!extractionContent) {
          throw new Error("No extraction result from OpenAI");
        }

        const extraction = JSON.parse(extractionContent);

        fileResults.push({
          fileId: transcript.fileId,
          fileName: transcript.fileName,
          fileSize: videoFile?.size ?? null,
          status: "completed",
          transcription: {
            text: transcriptText,
          },
          extraction,
        });
      } catch (error: any) {
        console.error(`Failed to extract from ${transcript.fileName}:`, error);
        fileResults.push({
          fileId: transcript.fileId,
          fileName: transcript.fileName,
          fileSize: videoFile?.size ?? null,
          status: "failed",
          error: error.message,
        });
      }
    }

    const successfulFiles = fileResults.filter((f) => f.status === "completed").length;
    const failedFiles = fileResults.filter((f) => f.status === "failed").length;

    if (failedFiles === fileResults.length) {
      await ctx.runMutation(internal.jobs.updateStatus, {
        jobId: args.jobId,
        status: "failed",
        errorMessage: "All files failed to process",
      });
      return;
    }

    const extractionResult = {
      files: fileResults,
      metadata: {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        modelsUsed: {
          transcription: "assemblyai",
          extraction: "gpt-4o",
        },
        totalFilesProcessed: fileResults.length,
      },
    };

    await ctx.runMutation(internal.jobs.saveExtractionResult, {
      jobId: args.jobId,
      extractionResult,
    });
  },
});

export const extractSingle = internalAction({
  args: {
    transcriptId: v.string(),
    text: v.string(),
    jobId: v.id("jobs"),
    fileId: v.string(),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const openai = getOpenAIClient();

    const prompt = MEETING_EXTRACTION_PROMPT.replace("{transcript}", args.text);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: {
        type: "json_schema",
        json_schema: EXTRACTION_JSON_SCHEMA as any,
      },
      messages: [
        {
          role: "system",
          content:
            "You are an expert at extracting structured information from meeting transcripts. Extract all relevant information accurately.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 4000,
      temperature: 0,
    });

    const extractionContent = response.choices[0]?.message?.content;
    if (!extractionContent) {
      throw new Error("No extraction result from OpenAI");
    }

    return JSON.parse(extractionContent);
  },
});
