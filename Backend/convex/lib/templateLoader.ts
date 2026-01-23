import zuoraSddTemplate from "../templates/zuora-sdd.template.json";

export interface FrontMatterConfig {
  enabled: boolean;
  titleFormat: string;
  includeVersion: boolean;
  includeDate: boolean;
  includeTOC: boolean;
  includeRevisionHistory: boolean;
  revisionHistoryTable: string;
}

export interface SectionDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  order: number;
  parentSection: string | null;
  keywords: string[];
  writingGuidelines?: string;
  requiredElements?: string[];
  tableFormats?: Record<string, string>;
  exampleContent?: string;
}

export interface TemplatePrompts {
  writerSystem: string;
  reviewerSystem: string;
  synthesisSystem: string;
}

export interface TemplateTerminology {
  domain: string;
  preferred: Record<string, string>;
  avoid: string[];
}

export interface QualityStandards {
  minWordsPerSection: number | null;
  maxWordsPerSection: number | null;
  requireTables: boolean;
  requireExamples: boolean;
  markUnconfirmedItems: boolean;
  unconfirmedMarker: string;
  assumptionMarker: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  documentType: string;
  frontMatter: FrontMatterConfig;
  sections: SectionDefinition[];
  prompts: TemplatePrompts;
  terminology: TemplateTerminology;
  qualityStandards: QualityStandards;
}

const TEMPLATES: Record<string, DocumentTemplate> = {
  "zuora-sdd": zuoraSddTemplate as unknown as DocumentTemplate,
};

const DEFAULT_TEMPLATE_ID = "zuora-sdd";

export function getTemplate(
  templateId: string = DEFAULT_TEMPLATE_ID
): DocumentTemplate {
  const template = TEMPLATES[templateId];
  if (!template) {
    const available = Object.keys(TEMPLATES).join(", ");
    throw new Error(
      `Template not found: ${templateId}. Available templates: ${available}`
    );
  }
  return template;
}

export function getAvailableTemplateIds(): string[] {
  return Object.keys(TEMPLATES);
}

export function getAvailableTemplates(): Array<{
  id: string;
  name: string;
  description: string;
  version: string;
}> {
  return Object.values(TEMPLATES).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    version: t.version,
  }));
}

export function getAllSections(
  templateId: string = DEFAULT_TEMPLATE_ID
): SectionDefinition[] {
  const template = getTemplate(templateId);
  return [...template.sections].sort((a, b) => a.order - b.order);
}

export function getSectionById(
  sectionId: string,
  templateId: string = DEFAULT_TEMPLATE_ID
): SectionDefinition | undefined {
  const template = getTemplate(templateId);
  return template.sections.find((s) => s.id === sectionId);
}

export function getSectionsByCategory(
  category: string,
  templateId: string = DEFAULT_TEMPLATE_ID
): SectionDefinition[] {
  return getAllSections(templateId).filter((s) => s.category === category);
}

export function getQ2RSections(
  templateId: string = DEFAULT_TEMPLATE_ID
): SectionDefinition[] {
  return getSectionsByCategory("q2r", templateId);
}

export function getSectionIds(
  templateId: string = DEFAULT_TEMPLATE_ID
): string[] {
  return getAllSections(templateId).map((s) => s.id);
}

export function getSectionKeywords(
  sectionId: string,
  templateId: string = DEFAULT_TEMPLATE_ID
): string[] {
  const section = getSectionById(sectionId, templateId);
  return section?.keywords || [];
}

export function getAllSectionKeywords(
  templateId: string = DEFAULT_TEMPLATE_ID
): Record<string, string[]> {
  const sections = getAllSections(templateId);
  const keywords: Record<string, string[]> = {};
  for (const section of sections) {
    keywords[section.id] = section.keywords;
  }
  return keywords;
}

export function getWriterSystemPrompt(
  templateId: string = DEFAULT_TEMPLATE_ID
): string {
  return getTemplate(templateId).prompts.writerSystem;
}

export function getReviewerSystemPrompt(
  templateId: string = DEFAULT_TEMPLATE_ID
): string {
  return getTemplate(templateId).prompts.reviewerSystem;
}

export function getSynthesisSystemPrompt(
  templateId: string = DEFAULT_TEMPLATE_ID
): string {
  return getTemplate(templateId).prompts.synthesisSystem;
}

export function getFrontMatterConfig(
  templateId: string = DEFAULT_TEMPLATE_ID
): FrontMatterConfig {
  return getTemplate(templateId).frontMatter;
}

export function generateDocumentTitle(
  projectName: string,
  templateId: string = DEFAULT_TEMPLATE_ID
): string {
  const template = getTemplate(templateId);
  return template.frontMatter.titleFormat
    .replace("{projectName}", projectName)
    .replace("{documentType}", template.documentType);
}

export function getTerminology(
  templateId: string = DEFAULT_TEMPLATE_ID
): TemplateTerminology {
  return getTemplate(templateId).terminology;
}

export function getQualityStandards(
  templateId: string = DEFAULT_TEMPLATE_ID
): QualityStandards {
  return getTemplate(templateId).qualityStandards;
}

export const SECTION_SCHEMA: Record<string, SectionDefinition> = (() => {
  const schema: Record<string, SectionDefinition> = {};
  for (const section of getAllSections()) {
    schema[section.id] = section;
  }
  return schema;
})();

export const SECTION_KEYWORDS: Record<string, string[]> =
  getAllSectionKeywords();
