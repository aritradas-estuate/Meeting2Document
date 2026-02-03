"use node";

import { internalAction, action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import { getSectionById } from "../lib/templateLoader";
import {
  buildSectionWriterPrompt,
  buildSectionReviewerPrompt,
} from "../lib/promptBuilder";
import {
  logPipelineStart,
  logPipelineEnd,
  logStep,
  logDetail,
  logIteration,
  logAICall,
  logAIResponse,
  logError,
} from "../lib/logger";

const getAnthropicClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic({ apiKey });
};

const WRITER_MODEL =
  process.env.MODEL_SECTION_WRITER || "claude-sonnet-4-20250514";
const REVIEWER_MODEL =
  process.env.MODEL_SECTION_REVIEWER || "claude-sonnet-4-20250514";
const MAX_ITERATIONS = parseInt(process.env.MAX_REVIEW_ITERATIONS || "3", 10);

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;
const RETRYABLE_STATUS_CODES = [429, 529, 500, 502, 503, 504];

async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      const statusCode = error.status || error.statusCode;
      const isRetryable = RETRYABLE_STATUS_CODES.includes(statusCode);
      const errorMessage = error.message || String(error);
      const isOverloaded = errorMessage.includes("overloaded") || errorMessage.includes("Overloaded");
      
      if (!isRetryable && !isOverloaded) {
        throw error;
      }
      
      if (attempt === MAX_RETRIES - 1) {
        logError(`${operationName} failed after ${MAX_RETRIES} attempts`, error, { 
          statusCode, 
          attempts: MAX_RETRIES 
        });
        throw error;
      }
      
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000;
      logDetail(`${operationName} failed (${statusCode || 'overloaded'}), retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error(`${operationName} failed after ${MAX_RETRIES} attempts`);
}

interface SourceData {
  fileName: string;
  transcript: string;
  keyIdeas: any;
}

interface GenerationHistoryEntry {
  draftNumber: number;
  content: string;
  generatedAt: number;
  writerModel: string;
  reviewerModel?: string;
  reviewerFeedback?: string;
  approved: boolean;
}

function buildSourceContext(sources: SourceData[]): string {
  let context = "";

  for (const source of sources) {
    context += `\n\n=== SOURCE: ${source.fileName} ===\n`;
    context += `\n--- TRANSCRIPT ---\n${source.transcript}\n`;

    if (source.keyIdeas) {
      context += `\n--- EXTRACTED KEY IDEAS ---\n`;

      if (source.keyIdeas.summary) {
        context += `Summary: ${source.keyIdeas.summary}\n\n`;
      }

      if (source.keyIdeas.decisions?.length) {
        context += `Decisions:\n`;
        for (const d of source.keyIdeas.decisions) {
          context += `- ${d.decision} (by ${d.made_by}): ${d.context}\n`;
        }
        context += "\n";
      }

      if (source.keyIdeas.action_items?.length) {
        context += `Action Items:\n`;
        for (const a of source.keyIdeas.action_items) {
          context += `- ${a.task} (assigned to ${a.assigned_to}, priority: ${a.priority || "not set"})\n`;
        }
        context += "\n";
      }

      if (source.keyIdeas.key_points?.length) {
        context += `Key Points:\n`;
        for (const k of source.keyIdeas.key_points) {
          context += `- ${k.point} (discussed by: ${k.discussed_by?.join(", ") || "unknown"})\n`;
        }
        context += "\n";
      }

      if (source.keyIdeas.concerns?.length) {
        context += `Concerns:\n`;
        for (const c of source.keyIdeas.concerns) {
          context += `- ${c.concern} (raised by ${c.raised_by}${c.resolution ? `, resolution: ${c.resolution}` : ""})\n`;
        }
        context += "\n";
      }

      if (source.keyIdeas.questions_raised?.length) {
        context += `Questions Raised:\n`;
        for (const q of source.keyIdeas.questions_raised) {
          context += `- ${q.question} (asked by ${q.asked_by}, ${q.answered ? `answered: ${q.answer}` : "unanswered"})\n`;
        }
        context += "\n";
      }

      if (source.keyIdeas.topics_discussed?.length) {
        context += `Topics Discussed:\n`;
        for (const t of source.keyIdeas.topics_discussed) {
          context += `- ${t.topic} (${t.duration_estimate})\n`;
        }
        context += "\n";
      }

      if (source.keyIdeas.follow_ups?.length) {
        context += `Follow-ups:\n`;
        for (const f of source.keyIdeas.follow_ups) {
          context += `- ${f.item} (owner: ${f.owner})\n`;
        }
        context += "\n";
      }
    }
  }

  return context;
}

async function writeDraft(
  anthropic: Anthropic,
  sectionId: string,
  sourceContext: string,
  previousDraft?: string,
  feedback?: string,
): Promise<string> {
  const { systemPrompt, sectionContext } = buildSectionWriterPrompt(sectionId);

  let userPrompt = sectionContext;
  userPrompt += `\nSOURCE MATERIAL:\n${sourceContext}\n\n`;

  if (previousDraft && feedback) {
    userPrompt += `PREVIOUS DRAFT:\n${previousDraft}\n\n`;
    userPrompt += `REVIEWER FEEDBACK TO ADDRESS:\n${feedback}\n\n`;
    userPrompt += `Please revise the section to address the reviewer's feedback while maintaining accuracy to the source material.`;
  } else {
    userPrompt += `Write this section in Markdown format. Extract relevant information from the source material and organize it professionally.`;
  }

  const response = await withRetry(
    () => anthropic.messages.create({
      model: WRITER_MODEL,
      max_tokens: 16000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
    "writeDraft"
  );

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text || "";
}

async function reviewDraft(
  anthropic: Anthropic,
  sectionId: string,
  sourceContext: string,
  draft: string,
): Promise<{ approved: boolean; feedback?: string }> {
  const { systemPrompt, reviewContext } = buildSectionReviewerPrompt(sectionId);

  const userPrompt = `${reviewContext}
SOURCE MATERIAL (for reference):
${sourceContext}

DRAFT TO REVIEW:
${draft}

Review the draft against the criteria in your instructions. If acceptable, respond with exactly "APPROVED". If improvements are needed, provide structured feedback.`;

  const response = await withRetry(
    () => anthropic.messages.create({
      model: REVIEWER_MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
    "reviewDraft"
  );

  const textBlock = response.content.find((block) => block.type === "text");
  const reviewText = textBlock?.text || "";

  if (reviewText.trim().toUpperCase().startsWith("APPROVED")) {
    return { approved: true };
  }

  return { approved: false, feedback: reviewText };
}

export const generateSection = internalAction({
  args: {
    documentSectionId: v.id("documentSections"),
    generationId: v.id("documentGenerations"),
    sectionId: v.string(),
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

    const sectionDef = getSectionById(args.sectionId);
    if (!sectionDef) throw new Error(`Unknown section: ${args.sectionId}`);

    logPipelineStart("SECTION GENERATION", sectionDef.title, {
      "Section ID": args.sectionId,
      "Document Section ID": args.documentSectionId,
      "Writer Model": WRITER_MODEL,
      "Reviewer Model": REVIEWER_MODEL,
      "Max Iterations": MAX_ITERATIONS,
    });

    const sources: SourceData[] = [];
    for (const selectedSource of generation.selectedSources) {
      const transcript = await ctx.runQuery(
        internal.transcripts.getByIdInternal,
        {
          transcriptId: selectedSource.transcriptId,
        },
      );
      const keyIdea = await ctx.runQuery(internal.keyIdeas.getByIdInternal, {
        keyIdeaId: selectedSource.keyIdeaId,
      });

      if (transcript && keyIdea) {
        sources.push({
          fileName: selectedSource.fileName,
          transcript: transcript.text || "",
          keyIdeas: keyIdea.extraction || {},
        });
      }
    }

    logDetail(`Loaded ${sources.length} sources`);

    const sourceContext = buildSourceContext(sources);
    const anthropic = getAnthropicClient();
    const generationHistory: GenerationHistoryEntry[] = [];

    let currentDraft = "";
    let approved = false;
    let iteration = 0;

    await ctx.runMutation(internal.documents.updateSectionStatusInternal, {
      documentSectionId: args.documentSectionId,
      status: "generating",
    });

    try {
      while (!approved && iteration < MAX_ITERATIONS) {
        iteration++;

        logIteration(iteration, MAX_ITERATIONS, "Writing draft...");

        const previousDraft = iteration > 1 ? currentDraft : undefined;
        const lastEntry = generationHistory[generationHistory.length - 1];
        const previousFeedback =
          generationHistory.length > 0 && lastEntry
            ? lastEntry.reviewerFeedback
            : undefined;

        logAICall(WRITER_MODEL, "write draft", sourceContext.length);
        const writeStartTime = Date.now();

        currentDraft = await writeDraft(
          anthropic,
          args.sectionId,
          sourceContext,
          previousDraft,
          previousFeedback,
        );

        logAIResponse(
          WRITER_MODEL,
          true,
          Date.now() - writeStartTime,
          `${currentDraft.length} chars`,
        );

        await ctx.runMutation(internal.documents.updateSectionStatusInternal, {
          documentSectionId: args.documentSectionId,
          status: "reviewing",
        });

        logIteration(iteration, MAX_ITERATIONS, "Reviewing draft...");
        logAICall(REVIEWER_MODEL, "review draft", currentDraft.length);
        const reviewStartTime = Date.now();

        const review = await reviewDraft(
          anthropic,
          args.sectionId,
          sourceContext,
          currentDraft,
        );

        const reviewDuration = Date.now() - reviewStartTime;

        const historyEntry: GenerationHistoryEntry = {
          draftNumber: iteration,
          content: currentDraft,
          generatedAt: Date.now(),
          writerModel: WRITER_MODEL,
          reviewerModel: REVIEWER_MODEL,
          reviewerFeedback: review.feedback,
          approved: review.approved,
        };

        generationHistory.push(historyEntry);

        if (review.approved) {
          logAIResponse(REVIEWER_MODEL, true, reviewDuration, "APPROVED");
          approved = true;
        } else {
          logAIResponse(
            REVIEWER_MODEL,
            true,
            reviewDuration,
            "REVISION REQUESTED",
          );
          logDetail("Feedback", review.feedback?.substring(0, 200));

          if (iteration < MAX_ITERATIONS) {
            await ctx.runMutation(
              internal.documents.updateSectionStatusInternal,
              {
                documentSectionId: args.documentSectionId,
                status: "generating",
              },
            );
          }
        }
      }

      await ctx.runMutation(internal.documents.saveSectionContentInternal, {
        documentSectionId: args.documentSectionId,
        content: currentDraft,
        generationHistory,
        finalDraftNumber: iteration,
      });

      await ctx.scheduler.runAfter(
        0,
        internal.actions.generation.checkGenerationComplete,
        {
          generationId: args.generationId,
        },
      );

      logPipelineEnd(
        "SECTION GENERATION",
        sectionDef.title,
        true,
        Date.now() - startTime,
        {
          Iterations: iteration,
          Approved: approved,
          "Final Draft": `${currentDraft.length} chars`,
        },
      );

      return {
        sectionId: args.sectionId,
        approved,
        iterations: iteration,
        content: currentDraft,
      };
    } catch (error: any) {
      logError("SECTION GENERATION", error, {
        sectionId: args.sectionId,
        iteration,
      });

      logPipelineEnd(
        "SECTION GENERATION",
        sectionDef.title,
        false,
        Date.now() - startTime,
        { Error: error.message, "Failed at iteration": iteration },
      );

      throw error;
    }
  },
});

export const startGeneration = action({
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
    if (
      !generation.selectedSectionIds ||
      generation.selectedSectionIds.length === 0
    ) {
      throw new Error("No sections selected for generation");
    }

    logPipelineStart("DOCUMENT GENERATION", args.generationId, {
      "Sections to Generate": generation.selectedSectionIds.length,
      "Source Files": generation.selectedSources.length,
    });

    const project = await ctx.runQuery(internal.projects.getByIdInternal, {
      projectId: generation.projectId,
    });
    if (!project) throw new Error("Project not found");

    logStep(1, 3, "Creating document...");
    const documentId = await ctx.runMutation(
      internal.documents.createInternal,
      {
        projectId: generation.projectId,
        title: `${project.name} - Solution Design Document`,
        schemaType: "zuora_sdd",
      },
    );
    logStep(1, 3, `Document created: ${documentId}`, "success");

    await ctx.runMutation(internal.documentGenerations.linkDocumentInternal, {
      generationId: args.generationId,
      documentId,
    });

    logStep(2, 3, "Creating section placeholders...");
    const sectionPromises = [];
    const sectionNames: string[] = [];

    for (const sectionId of generation.selectedSectionIds) {
      const sectionDef = getSectionById(sectionId);
      if (!sectionDef) continue;

      sectionNames.push(sectionDef.title);

      const documentSectionId = await ctx.runMutation(
        internal.documents.createSectionInternal,
        {
          documentId,
          sectionId,
          sectionTitle: sectionDef.title,
          sourceFileNames: generation.selectedSources.map(
            (s: { fileName: string }) => s.fileName,
          ),
        },
      );

      sectionPromises.push(
        ctx.scheduler.runAfter(0, internal.actions.generation.generateSection, {
          documentSectionId,
          generationId: args.generationId,
          sectionId,
        }),
      );
    }

    logStep(2, 3, `Created ${sectionNames.length} sections`, "success");
    logDetail("Sections", sectionNames.join(", "));

    logStep(3, 3, "Scheduling section generation tasks...");
    await Promise.all(sectionPromises);
    logStep(
      3,
      3,
      `Scheduled ${sectionPromises.length} parallel generation tasks`,
      "success",
    );

    logPipelineEnd(
      "DOCUMENT GENERATION",
      args.generationId,
      true,
      Date.now() - startTime,
      {
        "Document ID": documentId,
        "Sections Started": sectionPromises.length,
      },
    );

    return {
      documentId,
      sectionsStarted: generation.selectedSectionIds.length,
    };
  },
});

export const checkGenerationComplete = internalAction({
  args: {
    generationId: v.id("documentGenerations"),
  },
  handler: async (ctx, args) => {
    const generation = await ctx.runQuery(
      internal.documentGenerations.getByIdInternal,
      {
        generationId: args.generationId,
      },
    );
    if (!generation || !generation.documentId) return { complete: false };

    const document = await ctx.runQuery(
      internal.documents.getWithSectionsInternal,
      {
        documentId: generation.documentId,
      },
    );
    if (!document) return { complete: false };

    const allComplete = document.sections.every(
      (s: any) => s.status === "complete" || s.status === "skipped",
    );

    if (allComplete) {
      await ctx.runMutation(internal.documentGenerations.updateStatusInternal, {
        generationId: args.generationId,
        status: "completed",
      });

      await ctx.scheduler.runAfter(
        0,
        internal.actions.assembly.assembleDocument,
        {
          documentId: generation.documentId,
        },
      );
    }

    return { complete: allComplete };
  },
});
