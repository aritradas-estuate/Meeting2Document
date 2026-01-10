MEETING_EXTRACTION_PROMPT = """
Analyze this meeting transcript and extract the following information.

CRITICAL: Return ONLY a valid JSON object. No explanations, no markdown, no code blocks.
Start your response with {{ and end with }}.

## TRANSCRIPT:
{transcript}

## EXTRACT THE FOLLOWING:

1. "summary": A 2-3 paragraph executive summary of the meeting.

2. "decisions": List of decisions made.
   Format: [{{"decision": "description", "made_by": "Speaker X or Unknown", "context": "why/how"}}]

3. "action_items": List of action items assigned.
   Format: [{{"task": "description", "assigned_to": "Speaker X or Unknown", "due_date": "date or null", "priority": "high/medium/low or null"}}]

4. "key_points": Important discussion points.
   Format: [{{"point": "description", "discussed_by": ["Speaker X", "Speaker Y"]}}]

5. "questions_raised": Questions asked during the meeting.
   Format: [{{"question": "the question", "asked_by": "Speaker X or Unknown", "answered": true/false, "answer": "answer or null"}}]

6. "concerns": Concerns, risks, or blockers mentioned.
   Format: [{{"concern": "description", "raised_by": "Speaker X or Unknown", "resolution": "resolution or null"}}]

7. "topics_discussed": High-level topics covered.
   Format: [{{"topic": "topic name", "duration_estimate": "X minutes or Unknown"}}]

8. "follow_ups": Items needing follow-up.
   Format: [{{"item": "description", "owner": "Speaker X or Unknown"}}]

RULES:
- Output ONLY the JSON object, nothing else
- Use "Unknown" for unidentifiable speakers
- Use null for optional fields when not mentioned
- Escape special characters in strings properly (especially quotes and newlines)
"""
