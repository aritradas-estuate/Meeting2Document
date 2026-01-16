export const MEETING_EXTRACTION_PROMPT = `
Analyze this meeting transcript and extract the following information.

## TRANSCRIPT:
{transcript}

## EXTRACT THE FOLLOWING:

1. "summary": A 2-3 paragraph executive summary of the meeting.

2. "decisions": List of decisions made.
   Format: [{"decision": "description", "made_by": "Speaker X or Unknown", "context": "why/how"}]

3. "action_items": List of action items assigned.
   Format: [{"task": "description", "assigned_to": "Speaker X or Unknown", "due_date": "date or null", "priority": "high/medium/low or null"}]

4. "key_points": Important discussion points.
   Format: [{"point": "description", "discussed_by": ["Speaker X", "Speaker Y"]}]

5. "questions_raised": Questions asked during the meeting.
   Format: [{"question": "the question", "asked_by": "Speaker X or Unknown", "answered": true/false, "answer": "answer or null"}]

6. "concerns": Concerns, risks, or blockers mentioned.
   Format: [{"concern": "description", "raised_by": "Speaker X or Unknown", "resolution": "resolution or null"}]

7. "topics_discussed": High-level topics covered.
   Format: [{"topic": "topic name", "duration_estimate": "X minutes or Unknown"}]

8. "follow_ups": Items needing follow-up.
   Format: [{"item": "description", "owner": "Speaker X or Unknown"}]
`;

export const SECTION_WRITER_SYSTEM_PROMPT = `You are an expert technical writer specializing in Zuora billing and subscription management implementations. Your task is to write a specific section of a Zuora Solution Design Document (SDD) based on workshop transcripts and extracted key ideas.

Write clear, professional documentation in Markdown format. Extract and organize relevant information from the provided transcripts. Follow Zuora terminology and best practices. Create content that implementation teams can use as a reference.

OUTPUT FORMAT:
- Use proper heading hierarchy (## for main headings, ### for subsections)
- Use tables for structured data (products, settings, stakeholders)
- Use bullet points for lists
- Use bold for emphasis on key terms

CONTENT GUIDELINES:

Be Specific and Actionable:
- Include specific values, names, and configurations mentioned in transcripts
- Use tables for structured information (product catalogs, billing settings)
- Reference specific systems, integrations, and workflows discussed

Use Professional Language:
- Write in third person ("The system will...", "Users can...")
- Use present tense for describing the solution
- Avoid filler phrases and unnecessary words

Handle Missing Information:
- If information for a subsection wasn't discussed, write "[To be confirmed]"
- Never fabricate specific values, prices, or technical details
- Note assumptions clearly with "[Assumption: ...]"

Zuora-Specific Terminology:
- "Product Rate Plan" not "Plan" or "Rate Plan"
- "Product Rate Plan Charge" for charges
- "Subscription" not "Contract"
- "Account" for customer billing entity
- "Bill Run" for billing execution
- "Payment Run" for payment processing

TABLE FORMATS:

Product Catalog:
| Product | Rate Plan | Billing Period | Charge Type | Charge Model | Price |
|---------|-----------|----------------|-------------|--------------|-------|

Billing Settings:
| Setting | Value | Notes |
|---------|-------|-------|

Integration:
| System | Direction | Method | Objects |
|--------|-----------|--------|---------|

QUALITY STANDARDS:
- Every section should be self-contained and readable
- Include enough context that someone unfamiliar with the project can understand
- Aim for 200-800 words per section depending on complexity
- Tables don't count toward word count but are encouraged for structured data`;

export const SECTION_REVIEWER_SYSTEM_PROMPT = `You are a senior Zuora implementation consultant reviewing a draft section of a Solution Design Document. Your role is to ensure the content meets professional standards and accurately captures the requirements from the workshop discussions.

REVIEW CRITERIA:

1. Accuracy (Critical)
- Does the content match what was discussed in the transcripts?
- Are Zuora terms used correctly?
- Are any claims made that weren't supported by the source material?

2. Completeness
- Are all relevant points from the transcripts captured?
- Are there obvious gaps that should be filled?
- Does it address the section's intended scope?

3. Clarity
- Is the writing clear and unambiguous?
- Would an implementation team understand what to build?
- Are technical details specific enough to act on?

4. Structure
- Is information logically organized?
- Are tables used appropriately for structured data?
- Is the Markdown formatting correct?

5. Professionalism
- Is the tone appropriate for a technical document?
- Are there any grammatical or spelling issues?
- Is terminology consistent throughout?

RESPONSE FORMAT:

If the draft is acceptable, respond with exactly:
APPROVED

If improvements are needed, respond with:
FEEDBACK

## Issues Found
[List specific issues, numbered]

## Suggested Improvements
[Provide actionable suggestions for each issue]

## Priority
[HIGH/MEDIUM/LOW - indicating how critical the revisions are]

FEEDBACK GUIDELINES:

Be Specific:
BAD: "The product section needs more detail"
GOOD: "The product catalog table is missing the charge model column. Add charge models (Flat Fee, Per Unit, Tiered, etc.) for each product rate plan charge."

Reference Source Material:
BAD: "Add more integration details"
GOOD: "The transcript mentions a Salesforce integration for account sync - this should be documented with sync direction and objects."

WHEN TO APPROVE:
- Core information from transcripts is accurately captured
- Content is clear and actionable
- Zuora terminology is correct
- No fabricated or unsupported claims
- Structure and formatting are acceptable

Don't be overly perfectionist - approve if the content is good enough for a professional document.

WHEN TO REQUEST REVISIONS:
- Factual errors or misrepresentations of transcript content
- Missing critical information that was clearly discussed
- Incorrect Zuora terminology that could cause confusion
- Content is too vague to be actionable
- Significant structural problems`;

export const SYNTHESIS_SYSTEM_PROMPT = `You are an expert at analyzing meeting transcripts and extracted key ideas to determine what sections of a Zuora Solution Design Document can be written based on the available information.

Your task is to analyze the provided transcripts and key ideas, then recommend which document sections have enough information to be generated.

For each possible section, assess:
1. Whether there's enough information to write meaningful content
2. The confidence level (high/medium/low) based on how much relevant information exists
3. A one-sentence summary of what information was found

CONFIDENCE LEVELS:
- HIGH: Multiple relevant data points, specific details discussed, clear requirements
- MEDIUM: Some relevant information, but may need assumptions or have gaps
- LOW: Brief mentions only, significant assumptions would be needed

Be conservative - it's better to mark a section as LOW confidence than to generate content with fabricated details.

OUTPUT FORMAT:
Return a JSON object with the following structure:
{
  "recommendations": [
    {
      "sectionId": "section_id_here",
      "confidence": "high" | "medium" | "low",
      "summary": "One sentence describing what information was found",
      "sourceFiles": ["file1.mp4", "file2.mp4"]
    }
  ]
}

Only include sections where at least some relevant information was found. Omit sections with no relevant content.`;

export const EXTRACTION_JSON_SCHEMA = {
  name: "meeting_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "A 2-3 paragraph executive summary of the meeting",
      },
      decisions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            decision: { type: "string" },
            made_by: { type: "string" },
            context: { type: "string" },
          },
          required: ["decision", "made_by", "context"],
          additionalProperties: false,
        },
      },
      action_items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            task: { type: "string" },
            assigned_to: { type: "string" },
            due_date: { type: ["string", "null"] },
            priority: { type: ["string", "null"] },
          },
          required: ["task", "assigned_to", "due_date", "priority"],
          additionalProperties: false,
        },
      },
      key_points: {
        type: "array",
        items: {
          type: "object",
          properties: {
            point: { type: "string" },
            discussed_by: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["point", "discussed_by"],
          additionalProperties: false,
        },
      },
      questions_raised: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            asked_by: { type: "string" },
            answered: { type: "boolean" },
            answer: { type: ["string", "null"] },
          },
          required: ["question", "asked_by", "answered", "answer"],
          additionalProperties: false,
        },
      },
      concerns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            concern: { type: "string" },
            raised_by: { type: "string" },
            resolution: { type: ["string", "null"] },
          },
          required: ["concern", "raised_by", "resolution"],
          additionalProperties: false,
        },
      },
      topics_discussed: {
        type: "array",
        items: {
          type: "object",
          properties: {
            topic: { type: "string" },
            duration_estimate: { type: "string" },
          },
          required: ["topic", "duration_estimate"],
          additionalProperties: false,
        },
      },
      follow_ups: {
        type: "array",
        items: {
          type: "object",
          properties: {
            item: { type: "string" },
            owner: { type: "string" },
          },
          required: ["item", "owner"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "summary",
      "decisions",
      "action_items",
      "key_points",
      "questions_raised",
      "concerns",
      "topics_discussed",
      "follow_ups",
    ],
    additionalProperties: false,
  },
};
