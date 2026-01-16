export interface SectionDefinition {
  id: string;
  title: string;
  description: string;
  category: "overview" | "technical" | "q2r" | "operational";
  order: number;
  parentSection?: string;
}

export const SECTION_SCHEMA: Record<string, SectionDefinition> = {
  document_purpose: {
    id: "document_purpose",
    title: "Document Purpose",
    description:
      "Clear statement of document intent, scope, and what systems/solutions it covers",
    category: "overview",
    order: 1,
  },
  business_overview: {
    id: "business_overview",
    title: "Business Overview",
    description:
      "Client's business model, products/services, current systems, and why they need Zuora",
    category: "overview",
    order: 2,
  },
  project_overview: {
    id: "project_overview",
    title: "Project Overview",
    description:
      "Main implementation objectives, key systems involved, integration approach, and high-level workflow",
    category: "overview",
    order: 3,
  },

  proposed_architecture: {
    id: "proposed_architecture",
    title: "Proposed Architecture",
    description:
      "Architecture diagram explanation, system integrations, data flow between components",
    category: "technical",
    order: 4,
  },
  project_scope: {
    id: "project_scope",
    title: "Project Scope",
    description:
      "Inclusions/exclusions, project phases, key stakeholders, and reference documents",
    category: "technical",
    order: 5,
  },
  zuora_administration: {
    id: "zuora_administration",
    title: "Zuora Administration",
    description:
      "Security policies, user roles and permissions, tenant profile settings, data access control",
    category: "technical",
    order: 6,
  },
  notifications: {
    id: "notifications",
    title: "Notifications",
    description:
      "Callouts, email notifications to customers, event notifications, SMTP configuration",
    category: "technical",
    order: 7,
  },

  q2r_price_to_offer: {
    id: "q2r_price_to_offer",
    title: "Price to Offer (P2O)",
    description:
      "Pricing model overview, product catalog, charge models, rate plans, billing periods, taxation",
    category: "q2r",
    order: 8,
    parentSection: "Zuora Q2R Requirements",
  },
  q2r_lead_to_quotes: {
    id: "q2r_lead_to_quotes",
    title: "Lead to Quotes",
    description:
      "CRM integration (Salesforce CPQ, Zuora CPQ), account creation flow, quote workflow, contacts handling",
    category: "q2r",
    order: 9,
    parentSection: "Zuora Q2R Requirements",
  },
  q2r_order_to_subscription: {
    id: "q2r_order_to_subscription",
    title: "Order to Subscription Management (O2S)",
    description:
      "Subscription model, account relationships, lifecycle (create, renew, upgrade, downgrade, cancel, pause/resume)",
    category: "q2r",
    order: 10,
    parentSection: "Zuora Q2R Requirements",
  },
  q2r_rating_to_billing: {
    id: "q2r_rating_to_billing",
    title: "Rating to Billing (R2B)",
    description:
      "Billing overview (advance vs arrears), bill runs, billing batches, invoice templates and settings",
    category: "q2r",
    order: 11,
    parentSection: "Zuora Q2R Requirements",
  },
  q2r_cash_to_collections: {
    id: "q2r_cash_to_collections",
    title: "Cash to Collections (C2C)",
    description:
      "Payment gateway, payment methods, payment runs, auto-pay, payment method updater, AR management",
    category: "q2r",
    order: 12,
    parentSection: "Zuora Q2R Requirements",
  },
  q2r_revenue_recognition: {
    id: "q2r_revenue_recognition",
    title: "Revenue Recognition to Finance (R2F)",
    description:
      "Revenue recognition model, accounting codes, revenue distribution rules, deferred revenue",
    category: "q2r",
    order: 13,
    parentSection: "Zuora Q2R Requirements",
  },
  q2r_record_to_report: {
    id: "q2r_record_to_report",
    title: "Record to Report (R2R)",
    description:
      "Reporting requirements, GL journal entry exports, ERP integration (NetSuite, etc.)",
    category: "q2r",
    order: 14,
    parentSection: "Zuora Q2R Requirements",
  },

  data_migration: {
    id: "data_migration",
    title: "Data Migration",
    description:
      "Migration scope (accounts, subscriptions, payment methods, open AR), volumes, phases, source systems",
    category: "operational",
    order: 15,
  },
  integration: {
    id: "integration",
    title: "Integration",
    description:
      "Native integrations (Zuora 360, CPQ), third-party integrations, workflows, custom callouts",
    category: "operational",
    order: 16,
  },
  assumptions_limitations: {
    id: "assumptions_limitations",
    title: "Assumptions, Limitations & Open Questions",
    description:
      "Known constraints, out-of-scope items, items requiring clarification",
    category: "operational",
    order: 17,
  },
};

export function getSectionById(id: string): SectionDefinition | undefined {
  return SECTION_SCHEMA[id];
}

export function getAllSections(): SectionDefinition[] {
  return Object.values(SECTION_SCHEMA).sort((a, b) => a.order - b.order);
}

export function getSectionsByCategory(
  category: SectionDefinition["category"],
): SectionDefinition[] {
  return getAllSections().filter((s) => s.category === category);
}

export function getQ2RSections(): SectionDefinition[] {
  return getSectionsByCategory("q2r");
}

export function getSectionIds(): string[] {
  return getAllSections().map((s) => s.id);
}

export const SECTION_KEYWORDS: Record<string, string[]> = {
  document_purpose: ["purpose", "scope", "objective", "goal", "project"],
  business_overview: [
    "business",
    "company",
    "product",
    "service",
    "model",
    "revenue",
    "customer",
  ],
  project_overview: [
    "implementation",
    "integration",
    "system",
    "workflow",
    "approach",
    "timeline",
  ],
  proposed_architecture: [
    "architecture",
    "diagram",
    "flow",
    "integration",
    "API",
    "system",
    "data flow",
  ],
  project_scope: [
    "scope",
    "inclusion",
    "exclusion",
    "phase",
    "stakeholder",
    "requirement",
  ],
  zuora_administration: [
    "security",
    "user role",
    "permission",
    "tenant",
    "admin",
    "access",
  ],
  notifications: ["notification", "email", "callout", "event", "SMTP", "alert"],
  q2r_price_to_offer: [
    "price",
    "pricing",
    "product",
    "catalog",
    "rate plan",
    "charge",
    "billing period",
    "tax",
  ],
  q2r_lead_to_quotes: [
    "quote",
    "CPQ",
    "Salesforce",
    "CRM",
    "lead",
    "opportunity",
    "account creation",
  ],
  q2r_order_to_subscription: [
    "subscription",
    "order",
    "renewal",
    "upgrade",
    "downgrade",
    "cancel",
    "lifecycle",
  ],
  q2r_rating_to_billing: [
    "billing",
    "bill run",
    "invoice",
    "rating",
    "batch",
    "advance",
    "arrears",
  ],
  q2r_cash_to_collections: [
    "payment",
    "gateway",
    "collection",
    "cash",
    "auto-pay",
    "AR",
    "dunning",
  ],
  q2r_revenue_recognition: [
    "revenue",
    "recognition",
    "accounting",
    "deferred",
    "ASC 606",
    "finance",
  ],
  q2r_record_to_report: [
    "report",
    "GL",
    "journal",
    "ERP",
    "NetSuite",
    "export",
    "record",
  ],
  data_migration: [
    "migration",
    "migrate",
    "import",
    "data",
    "account migration",
    "historical",
  ],
  integration: [
    "integration",
    "API",
    "workflow",
    "callout",
    "sync",
    "Salesforce",
    "NetSuite",
  ],
  assumptions_limitations: [
    "assumption",
    "limitation",
    "constraint",
    "question",
    "open item",
    "TBD",
  ],
};
