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
