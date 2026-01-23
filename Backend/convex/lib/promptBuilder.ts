import {
  type DocumentTemplate,
  type SectionDefinition,
  getTemplate,
  getSectionById,
} from "./templateLoader";

export function buildSectionWriterPrompt(
  sectionId: string,
  templateId: string = "zuora-sdd"
): { systemPrompt: string; sectionContext: string } {
  const template = getTemplate(templateId);
  const section = getSectionById(sectionId, templateId);

  if (!section) {
    throw new Error(`Section not found: ${sectionId}`);
  }

  const systemPrompt = template.prompts.writerSystem;
  const sectionContext = buildSectionContext(section, template);

  return { systemPrompt, sectionContext };
}

function buildSectionContext(
  section: SectionDefinition,
  template: DocumentTemplate
): string {
  let context = `Write the "${section.title}" section of a ${template.documentType}.\n\n`;
  context += `SECTION DESCRIPTION: ${section.description}\n\n`;

  if (section.writingGuidelines) {
    context += `WRITING GUIDELINES:\n${section.writingGuidelines}\n\n`;
  }

  if (section.requiredElements && section.requiredElements.length > 0) {
    context += `REQUIRED ELEMENTS (must be included if information is available):\n`;
    for (const element of section.requiredElements) {
      context += `- ${element}\n`;
    }
    context += "\n";
  }

  if (section.tableFormats && Object.keys(section.tableFormats).length > 0) {
    context += `TABLE FORMATS TO USE:\n`;
    for (const [name, format] of Object.entries(section.tableFormats)) {
      context += `\n${name}:\n${format}\n`;
    }
    context += "\n";
  }

  if (section.exampleContent) {
    context += `EXAMPLE OF GOOD CONTENT:\n${section.exampleContent}\n\n`;
  }

  const qualityStandards = template.qualityStandards;
  context += `QUALITY MARKERS:\n`;
  context += `- Mark unconfirmed items with: ${qualityStandards.unconfirmedMarker}\n`;
  context += `- Mark assumptions with: ${qualityStandards.assumptionMarker}\n`;

  return context;
}

export function buildSectionReviewerPrompt(
  sectionId: string,
  templateId: string = "zuora-sdd"
): { systemPrompt: string; reviewContext: string } {
  const template = getTemplate(templateId);
  const section = getSectionById(sectionId, templateId);

  if (!section) {
    throw new Error(`Section not found: ${sectionId}`);
  }

  const systemPrompt = template.prompts.reviewerSystem;
  const reviewContext = buildReviewContext(section, template);

  return { systemPrompt, reviewContext };
}

function buildReviewContext(
  section: SectionDefinition,
  template: DocumentTemplate
): string {
  let context = `Review this draft of the "${section.title}" section for a ${template.documentType}.\n\n`;
  context += `SECTION DESCRIPTION: ${section.description}\n\n`;

  if (section.requiredElements && section.requiredElements.length > 0) {
    context += `EXPECTED ELEMENTS (check if present when information was available):\n`;
    for (const element of section.requiredElements) {
      context += `- ${element}\n`;
    }
    context += "\n";
  }

  return context;
}

export function buildSynthesisPrompt(
  templateId: string = "zuora-sdd"
): string {
  const template = getTemplate(templateId);
  let prompt = template.prompts.synthesisSystem + "\n\n";

  prompt += "AVAILABLE SECTIONS:\n\n";

  for (const section of template.sections) {
    prompt += `- ${section.id}: "${section.title}"\n`;
    prompt += `  Description: ${section.description}\n`;
    prompt += `  Keywords to look for: ${section.keywords.join(", ")}\n\n`;
  }

  return prompt;
}

export function buildFrontMatter(
  projectName: string,
  sections: Array<{ sectionId: string; sectionTitle: string }>,
  templateId: string = "zuora-sdd"
): string {
  const template = getTemplate(templateId);
  const config = template.frontMatter;

  if (!config.enabled) {
    return "";
  }

  let frontMatter = "";
  const title = config.titleFormat
    .replace("{projectName}", projectName)
    .replace("{documentType}", template.documentType);

  frontMatter += `# ${title}\n\n`;

  if (config.includeVersion) {
    frontMatter += `**Version:** 1.0\n\n`;
  }

  if (config.includeDate) {
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    frontMatter += `**Generated:** ${date}\n\n`;
  }

  frontMatter += "---\n\n";

  if (config.includeTOC && sections.length > 0) {
    frontMatter += "## Table of Contents\n\n";

    let tocIndex = 1;
    let currentParent: string | null = null;

    for (const section of sections) {
      const sectionDef = getSectionById(section.sectionId, templateId);
      const anchor = section.sectionTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+$/, "");

      if (sectionDef?.parentSection && sectionDef.parentSection !== currentParent) {
        currentParent = sectionDef.parentSection;
      }

      if (sectionDef?.parentSection) {
        frontMatter += `   ${tocIndex}. [${section.sectionTitle}](#${anchor})\n`;
      } else {
        frontMatter += `${tocIndex}. [${section.sectionTitle}](#${anchor})\n`;
      }
      tocIndex++;
    }

    frontMatter += "\n---\n\n";
  }

  if (config.includeRevisionHistory) {
    frontMatter += "## Document History\n\n";
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const historyTable = config.revisionHistoryTable.replace("{date}", dateStr);
    frontMatter += historyTable + "\n\n";
    frontMatter += "---\n\n";
  }

  return frontMatter;
}

export function buildSectionList(templateId: string = "zuora-sdd"): string {
  const template = getTemplate(templateId);
  let sectionList = "AVAILABLE SECTIONS:\n\n";

  for (const section of template.sections) {
    sectionList += `- ${section.id}: "${section.title}"\n`;
    sectionList += `  Description: ${section.description}\n`;
    sectionList += `  Keywords to look for: ${section.keywords.join(", ")}\n\n`;
  }

  return sectionList;
}
