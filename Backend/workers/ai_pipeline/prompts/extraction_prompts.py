MEETING_EXTRACTION_PROMPT = """
Analyze this meeting transcript and extract the following information.
Return your response as a JSON object with the exact keys specified below.

## TRANSCRIPT:
{transcript}

## EXTRACT THE FOLLOWING:

1. **summary**: A 2-3 paragraph executive summary of the meeting. Include the main topics discussed, key outcomes, and overall tone.

2. **decisions**: List of decisions made during the meeting.
   Format: [{{"decision": "description", "made_by": "Speaker X or Unknown", "context": "why/how it was decided"}}]

3. **action_items**: List of action items or tasks assigned.
   Format: [{{"task": "description", "assigned_to": "Speaker X or Unknown", "due_date": "date if mentioned or null", "priority": "high/medium/low or null"}}]

4. **key_points**: Important discussion points that aren't decisions or actions.
   Format: [{{"point": "description", "discussed_by": ["Speaker X", "Speaker Y"]}}]

5. **questions_raised**: Questions that were asked during the meeting.
   Format: [{{"question": "the question", "asked_by": "Speaker X or Unknown", "answered": true/false, "answer": "the answer if provided or null"}}]

6. **concerns**: Any concerns, risks, or blockers mentioned.
   Format: [{{"concern": "description", "raised_by": "Speaker X or Unknown", "resolution": "resolution if any or null"}}]

7. **topics_discussed**: High-level topics covered in the meeting.
   Format: [{{"topic": "topic name", "duration_estimate": "X minutes or Unknown"}}]

8. **follow_ups**: Items that need follow-up in future meetings.
   Format: [{{"item": "description", "owner": "Speaker X or Unknown"}}]

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting or explanation
- Use "Unknown" for speakers when not identifiable
- Use null for optional fields when not mentioned
- Be thorough but concise in descriptions
- Focus on actionable and important information
"""
