"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { getAllSections, getSectionById } from "../lib/sectionSchema";
import {
  logPipelineStart,
  logPipelineEnd,
  logStep,
  logDetail,
  logProgress,
  logError,
} from "../lib/logger";

function generateTableOfContents(
  sections: Array<{ sectionId: string; sectionTitle: string }>,
): string {
  let toc = "## Table of Contents\n\n";

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section) continue;
    const sectionDef = getSectionById(section.sectionId);
    const anchor = section.sectionTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

    if (sectionDef?.parentSection) {
      toc += `   ${i + 1}. [${section.sectionTitle}](#${anchor})\n`;
    } else {
      toc += `${i + 1}. [${section.sectionTitle}](#${anchor})\n`;
    }
  }

  return toc + "\n---\n\n";
}

function generateCoverPage(projectName: string, generatedAt: Date): string {
  const dateStr = generatedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `# ${projectName}

## Zuora Solution Design Document

**Generated:** ${dateStr}

**Version:** 1.0

---

`;
}

export const assembleDocument = internalAction({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    logPipelineStart("DOCUMENT ASSEMBLY", args.documentId);

    try {
      logStep(1, 4, "Loading document and sections...");
      const document = await ctx.runQuery(
        internal.documents.getWithSectionsInternal,
        {
          documentId: args.documentId,
        },
      );

      if (!document) throw new Error("Document not found");

      const project = await ctx.runQuery(internal.projects.getByIdInternal, {
        projectId: document.projectId,
      });

      logStep(
        1,
        4,
        `Loaded ${document.sections.length} sections for "${project?.name || "Unknown"}"`,
        "success",
      );

      const allSectionDefs = getAllSections();
      const sectionOrder = allSectionDefs.map((s) => s.id);

      const sortedSections = [...document.sections].sort((a: any, b: any) => {
        const aIndex = sectionOrder.indexOf(a.sectionId);
        const bIndex = sectionOrder.indexOf(b.sectionId);
        return aIndex - bIndex;
      });

      const completedSections = sortedSections.filter(
        (s: any) => s.status === "complete" && s.content,
      );

      logDetail(
        `Completed sections: ${completedSections.length}/${document.sections.length}`,
      );

      logStep(2, 4, "Generating cover page...");
      let markdown = generateCoverPage(
        project?.name || "Solution Design Document",
        new Date(),
      );
      logStep(2, 4, "Cover page ready", "success");

      logStep(3, 4, "Generating table of contents...");
      markdown += generateTableOfContents(
        completedSections.map((s: any) => ({
          sectionId: s.sectionId,
          sectionTitle: s.sectionTitle,
        })),
      );
      logStep(3, 4, `TOC with ${completedSections.length} entries`, "success");

      logStep(4, 4, "Assembling sections...");
      const assembledSections: string[] = [];
      let currentParent: string | null = null;

      for (const section of completedSections) {
        const sectionDef = getSectionById(section.sectionId);

        if (
          sectionDef?.parentSection &&
          sectionDef.parentSection !== currentParent
        ) {
          markdown += `## ${sectionDef.parentSection}\n\n`;
          currentParent = sectionDef.parentSection;
        } else if (!sectionDef?.parentSection) {
          currentParent = null;
        }

        if (sectionDef?.parentSection) {
          markdown += `### ${section.sectionTitle}\n\n`;
        } else {
          markdown += `## ${section.sectionTitle}\n\n`;
        }

        markdown += section.content + "\n\n";
        markdown += "---\n\n";
        assembledSections.push(`${section.sectionTitle} ✓`);
      }

      logProgress(assembledSections);

      markdown += `\n\n---\n\n*Document generated automatically from workshop transcripts.*\n`;

      logStep(
        4,
        4,
        `Assembled ${completedSections.length} sections`,
        "success",
      );

      await ctx.runMutation(internal.documents.updateMarkdownContentInternal, {
        documentId: args.documentId,
        markdownContent: markdown,
      });

      logPipelineEnd(
        "DOCUMENT ASSEMBLY",
        args.documentId,
        true,
        Date.now() - startTime,
        {
          Sections: completedSections.length,
          "Markdown Size": `${markdown.length.toLocaleString()} chars`,
        },
      );

      return { success: true, sectionCount: completedSections.length };
    } catch (error: any) {
      logError("DOCUMENT ASSEMBLY", error, { documentId: args.documentId });

      logPipelineEnd(
        "DOCUMENT ASSEMBLY",
        args.documentId,
        false,
        Date.now() - startTime,
        { Error: error.message },
      );

      throw error;
    }
  },
});
