"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { getAllSections, getSectionById } from "../lib/templateLoader";
import { buildFrontMatter } from "../lib/promptBuilder";
import {
  logPipelineStart,
  logPipelineEnd,
  logStep,
  logDetail,
  logProgress,
  logError,
} from "../lib/logger";



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

      logStep(2, 4, "Generating front matter (cover, TOC, revision history)...");
      const sectionsList = completedSections.map((s: any) => ({
        sectionId: s.sectionId,
        sectionTitle: s.sectionTitle,
      }));
      let markdown = buildFrontMatter(
        project?.name || "Solution Design Document",
        sectionsList,
      );
      logStep(2, 4, `Front matter with ${completedSections.length} TOC entries`, "success");

      logStep(3, 3, "Assembling sections...");
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

        // Check if content already starts with a header matching section title
        // to avoid duplicate headers like "## Title\n## Title"
        const contentTrimmed = section.content.trim();
        const headerMatch = contentTrimmed.match(/^#{1,4}\s*(.+?)[\n\r]/);
        const contentStartsWithTitle = headerMatch && 
          headerMatch[1].toLowerCase().trim().includes(
            section.sectionTitle.toLowerCase().substring(0, 20)
          );

        if (!contentStartsWithTitle) {
          if (sectionDef?.parentSection) {
            markdown += `### ${section.sectionTitle}\n\n`;
          } else {
            markdown += `## ${section.sectionTitle}\n\n`;
          }
        }

        markdown += section.content + "\n\n";
        markdown += "---\n\n";
        assembledSections.push(`${section.sectionTitle} ✓`);
      }

      logProgress(assembledSections);

      markdown += `\n\n---\n\n*Document generated automatically from workshop transcripts.*\n`;

      logStep(
        3,
        3,
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
