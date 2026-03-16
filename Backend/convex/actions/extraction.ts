"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import OpenAI from "openai";
import {
  MEETING_EXTRACTION_PROMPT,
  EXTRACTION_JSON_SCHEMA,
} from "../lib/prompts";

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  return new OpenAI({ apiKey });
};

const EXTRACTION_MODEL = process.env.MODEL_EXTRACTION || "gpt-5.4";

export const extractSingle = internalAction({
  args: {
    transcriptId: v.id("transcripts"),
    keyIdeaId: v.id("keyIdeas"),
  },
  handler: async (ctx, args) => {
    const transcript = await ctx.runQuery(
      internal.transcripts.getByIdInternal,
      {
        transcriptId: args.transcriptId,
      },
    );
    if (!transcript) throw new Error("Transcript not found");

    const keyIdea = await ctx.runQuery(internal.keyIdeas.getByIdInternal, {
      keyIdeaId: args.keyIdeaId,
    });
    if (!keyIdea) throw new Error("Key idea record not found");

    if (keyIdea.status === "completed" || keyIdea.status === "extracting") {
      console.log(
        `KeyIdea ${args.keyIdeaId} already ${keyIdea.status}, skipping`,
      );
      return;
    }

    await ctx.runMutation(internal.keyIdeas.updateStatusInternal, {
      keyIdeaId: args.keyIdeaId,
      status: "extracting",
    });

    await ctx.runMutation(internal.jobs.updateStatus, {
      jobId: transcript.jobId,
      status: "extracting",
      currentStage: "extracting",
      stageProgress: {
        stage: "extracting",
        progress: 50,
        message: `Extracting key ideas from: ${transcript.fileName}`,
      },
    });

    try {
      const openai = getOpenAIClient();
      const transcriptText = transcript.text || "";

      const prompt = MEETING_EXTRACTION_PROMPT.replace(
        "{transcript}",
        transcriptText,
      );

      const response = await openai.chat.completions.create({
        model: EXTRACTION_MODEL,
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
        max_completion_tokens: 4000,
        temperature: 0,
      });

      const extractionContent = response.choices[0]?.message?.content;
      if (!extractionContent) {
        throw new Error("No extraction result from OpenAI");
      }

      const extraction = JSON.parse(extractionContent);

      await ctx.runMutation(internal.keyIdeas.saveResultInternal, {
        keyIdeaId: args.keyIdeaId,
        extraction,
      });
    } catch (error: any) {
      console.error(`Failed to extract from ${transcript.fileName}:`, error);

      await ctx.runMutation(internal.keyIdeas.updateStatusInternal, {
        keyIdeaId: args.keyIdeaId,
        status: "failed",
        error: error.message,
      });
    }

    await ctx.runMutation(internal.jobs.checkCompletion, {
      jobId: transcript.jobId,
    });
  },
});
