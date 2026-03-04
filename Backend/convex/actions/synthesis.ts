"use node";

import { internalAction, action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import OpenAI from "openai";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  SECTION_SCHEMA,
  getAllSections,
  getSynthesisSystemPrompt,
} from "../lib/templateLoader";
import { buildSectionList } from "../lib/promptBuilder";
import {
  logPipelineStart,
  logPipelineEnd,
  logStep,
  logDetail,
  logAICall,
  logAIResponse,
  logError,
  logProgress,
} from "../lib/logger";

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  return new OpenAI({ apiKey });
};

const SYNTHESIS_MODEL = process.env.MODEL_SYNTHESIS || "gpt-5.2";

async function verifyGenerationOwnership(ctx: any, generationId: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthorized");

  const generation = await ctx.runQuery(
    internal.documentGenerations.getByIdInternal,
    { generationId },
  );
  if (!generation) throw new Error("Generation not found");

  const project = await ctx.runQuery(internal.projects.getByIdInternal, {
    projectId: generation.projectId,
  });
  if (!project) throw new Error("Project not found");
  if (project.userId !== userId) throw new Error("Unauthorized");
}

function getSourceType(source: any): "video" | "document" {
  if ("sourceContentId" in source) return "document";
  return "video"; // covers both legacy (no sourceType) and new video shape
}

interface SourceData {
  fileName: string;
  transcript: string;
  keyIdeas: {
    summary?: string;
    decisions?: Array<{ decision: string; made_by: string; context: string }>;
    action_items?: Array<{
      task: string;
      assigned_to: string;
      due_date?: string;
      priority?: string;
    }>;
    key_points?: Array<{ point: string; discussed_by: string[] }>;
    questions_raised?: Array<{
      question: string;
      asked_by: string;
      answered: boolean;
      answer?: string;
    }>;
    concerns?: Array<{
      concern: string;
      raised_by: string;
      resolution?: string;
    }>;
    topics_discussed?: Array<{ topic: string; duration_estimate: string }>;
    follow_ups?: Array<{ item: string; owner: string }>;
  };
  sourceType?: "video" | "document";
}

interface SectionRecommendation {
  sectionId: string;
  sectionTitle: string;
  confidence: "high" | "medium" | "low";
  summary: string;
  sourceFileNames: string[];
}

function buildSourceContext(sources: SourceData[]): string {
  let context = "";

  for (const source of sources) {
    if (source.sourceType === "document") {
      context += `\n\n=== DOCUMENT SOURCE: ${source.fileName} ===\n`;
      context += `\n--- DOCUMENT CONTENT ---\n${source.transcript.substring(0, 15000)}\n`;
      continue;
    }

    context += `\n\n=== SOURCE: ${source.fileName} ===\n`;
    context += `\n--- TRANSCRIPT ---\n${source.transcript.substring(0, 15000)}\n`;

    if (source.keyIdeas) {
      context += `\n--- EXTRACTED KEY IDEAS ---\n`;

      if (source.keyIdeas.summary) {
        context += `Summary: ${source.keyIdeas.summary}\n\n`;
      }

      if (source.keyIdeas.decisions?.length) {
        context += `Decisions:\n`;
        for (const d of source.keyIdeas.decisions) {
          context += `- ${d.decision} (by ${d.made_by})\n`;
        }
        context += "\n";
      }

      if (source.keyIdeas.action_items?.length) {
        context += `Action Items:\n`;
        for (const a of source.keyIdeas.action_items) {
          context += `- ${a.task} (assigned to ${a.assigned_to})\n`;
        }
        context += "\n";
      }

      if (source.keyIdeas.key_points?.length) {
        context += `Key Points:\n`;
        for (const k of source.keyIdeas.key_points) {
          context += `- ${k.point}\n`;
        }
        context += "\n";
      }

      if (source.keyIdeas.concerns?.length) {
        context += `Concerns:\n`;
        for (const c of source.keyIdeas.concerns) {
          context += `- ${c.concern}\n`;
        }
        context += "\n";
      }

      if (source.keyIdeas.topics_discussed?.length) {
        context += `Topics Discussed:\n`;
        for (const t of source.keyIdeas.topics_discussed) {
          context += `- ${t.topic}\n`;
        }
        context += "\n";
      }
    }
  }

  return context;
}



export const analyze = internalAction({
  args: {
    generationId: v.id("documentGenerations"),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    const generation = await ctx.runQuery(
      internal.documentGenerations.getByIdInternal,
      {
        generationId: args.generationId,
      },
    );
    if (!generation) throw new Error("Generation not found");

    logPipelineStart("SYNTHESIS PIPELINE", args.generationId, {
      "Source Count": generation.selectedSources.length,
      Model: SYNTHESIS_MODEL,
    });

    await ctx.runMutation(internal.documentGenerations.updateStatusInternal, {
      generationId: args.generationId,
      status: "analyzing",
    });

    try {
      logStep(1, 3, "Loading source data...");
      const sources: SourceData[] = [];
      const loadedFiles: string[] = [];

      for (const selectedSource of generation.selectedSources) {
        const type = getSourceType(selectedSource);

        if (type === "video") {
          const transcript = await ctx.runQuery(
            internal.transcripts.getByIdInternal,
            {
              transcriptId: (selectedSource as any).transcriptId,
            },
          );
          const keyIdea = await ctx.runQuery(
            internal.keyIdeas.getByIdInternal,
            {
              keyIdeaId: (selectedSource as any).keyIdeaId,
            },
          );

          if (transcript && keyIdea) {
            sources.push({
              fileName: selectedSource.fileName,
              transcript: transcript.text || "",
              keyIdeas: keyIdea.extraction || {},
              sourceType: "video",
            });
            loadedFiles.push(`${selectedSource.fileName} ✓`);
          }
        } else {
          const sourceContent = await ctx.runQuery(
            internal.sourceContent.getByIdInternal,
            {
              sourceContentId: (selectedSource as any).sourceContentId,
            },
          );

          if (sourceContent && sourceContent.text) {
            sources.push({
              fileName: selectedSource.fileName,
              transcript: sourceContent.text,
              keyIdeas: {},
              sourceType: "document",
            });
            loadedFiles.push(`${selectedSource.fileName} (doc) ✓`);
          }
        }
      }

      logProgress(loadedFiles);

      if (sources.length === 0) {
        throw new Error("No valid sources found");
      }

      const totalTranscriptChars = sources.reduce(
        (sum, s) => sum + s.transcript.length,
        0,
      );
      const totalKeyIdeas = sources.reduce((sum, s) => {
        const ki = s.keyIdeas;
        return (
          sum +
          (ki.decisions?.length || 0) +
          (ki.action_items?.length || 0) +
          (ki.key_points?.length || 0)
        );
      }, 0);

      logStep(
        1,
        3,
        `Loaded ${sources.length} sources (${totalTranscriptChars.toLocaleString()} chars, ${totalKeyIdeas} key ideas)`,
        "success",
      );

      const sourceContext = buildSourceContext(sources);
      const sectionList = buildSectionList();

      const userPrompt = `${sectionList}

SOURCE MATERIAL:
${sourceContext}

Analyze the source material and recommend which sections from the AVAILABLE SECTIONS list can be written based on the information provided. For each section, assess the confidence level and provide a one-sentence summary of what relevant information was found.

Remember: Only recommend sections where you found relevant information. Be conservative with confidence levels.`;

      logStep(2, 3, "Calling OpenAI for section analysis...");
      logAICall(SYNTHESIS_MODEL, "section analysis", userPrompt.length);

      const aiStartTime = Date.now();
      const openai = getOpenAIClient();

      const response = await openai.chat.completions.create({
        model: SYNTHESIS_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: getSynthesisSystemPrompt(),
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_completion_tokens: 4000,
        temperature: 0.1,
      });

      const aiDuration = Date.now() - aiStartTime;
      const content = response.choices[0]?.message?.content;

      if (!content) {
        logAIResponse(SYNTHESIS_MODEL, false, aiDuration);
        throw new Error("No response from synthesis model");
      }

      logAIResponse(
        SYNTHESIS_MODEL,
        true,
        aiDuration,
        `${content.length} chars response`,
      );

      logStep(3, 3, "Processing recommendations...");
      const result = JSON.parse(content);
      const recommendations: SectionRecommendation[] = [];

      if (result.recommendations && Array.isArray(result.recommendations)) {
        for (const rec of result.recommendations) {
          const sectionDef = SECTION_SCHEMA[rec.sectionId];
          if (sectionDef) {
            recommendations.push({
              sectionId: rec.sectionId,
              sectionTitle: sectionDef.title,
              confidence: rec.confidence || "low",
              summary: rec.summary || "",
              sourceFileNames:
                rec.sourceFiles || sources.map((s) => s.fileName),
            });
          }
        }
      }

      const ALWAYS_INCLUDE_SECTIONS = [
        "q2r_price_to_offer",
        "q2r_lead_to_quotes",
        "q2r_order_to_subscription",
        "q2r_rating_to_billing",
        "q2r_cash_to_collections",
        "q2r_revenue_recognition",
        "q2r_record_to_report",
        "zuora_administration",
      ];

      for (const sectionId of ALWAYS_INCLUDE_SECTIONS) {
        if (!recommendations.find((r) => r.sectionId === sectionId)) {
          const sectionDef = SECTION_SCHEMA[sectionId];
          if (sectionDef) {
            recommendations.push({
              sectionId,
              sectionTitle: sectionDef.title,
              confidence: "low",
              summary:
                "Not discussed in workshops. Include section with placeholder content.",
              sourceFileNames: sources.map((s) => s.fileName),
            });
          }
        }
      }

      recommendations.sort((a, b) => {
        const confidenceOrder = { high: 0, medium: 1, low: 2 };
        return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
      });

      const highCount = recommendations.filter(
        (r) => r.confidence === "high",
      ).length;
      const mediumCount = recommendations.filter(
        (r) => r.confidence === "medium",
      ).length;
      const lowCount = recommendations.filter(
        (r) => r.confidence === "low",
      ).length;

      logStep(
        3,
        3,
        `Found ${recommendations.length} sections: ${highCount} high, ${mediumCount} medium, ${lowCount} low confidence`,
        "success",
      );

      await ctx.runMutation(
        internal.documentGenerations.saveRecommendationsInternal,
        {
          generationId: args.generationId,
          recommendations,
        },
      );

      logPipelineEnd(
        "SYNTHESIS PIPELINE",
        args.generationId,
        true,
        Date.now() - startTime,
        {
          Recommendations: recommendations.length,
          "High Confidence": highCount,
          "Medium Confidence": mediumCount,
          "Low Confidence": lowCount,
        },
      );

      return { success: true, recommendations };
    } catch (error: any) {
      logError("SYNTHESIS PIPELINE", error, {
        generationId: args.generationId,
        sourceCount: generation.selectedSources.length,
      });

      await ctx.runMutation(internal.documentGenerations.updateStatusInternal, {
        generationId: args.generationId,
        status: "failed",
        errorMessage: error.message,
      });

      logPipelineEnd(
        "SYNTHESIS PIPELINE",
        args.generationId,
        false,
        Date.now() - startTime,
        { Error: error.message },
      );

      throw error;
    }
  },
});

export const startSynthesis = action({
  args: {
    generationId: v.id("documentGenerations"),
  },
  handler: async (ctx, args) => {
    await verifyGenerationOwnership(ctx, args.generationId);

    await ctx.scheduler.runAfter(0, internal.actions.synthesis.analyze, {
      generationId: args.generationId,
    });

    return { started: true };
  },
});
