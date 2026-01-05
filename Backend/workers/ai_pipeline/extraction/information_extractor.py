import json
from dataclasses import dataclass
from typing import Any

import requests

from app.config import settings
from app.core.logging import get_logger
from workers.ai_pipeline.prompts.extraction_prompts import MEETING_EXTRACTION_PROMPT

logger = get_logger(__name__)

LLM_GATEWAY_URL = "https://llm-gateway.assemblyai.com/v1/chat/completions"


@dataclass
class ExtractionResult:
    summary: str
    decisions: list[dict[str, Any]]
    action_items: list[dict[str, Any]]
    key_points: list[dict[str, Any]]
    questions_raised: list[dict[str, Any]]
    concerns: list[dict[str, Any]]
    topics_discussed: list[dict[str, Any]]
    follow_ups: list[dict[str, Any]]
    raw_response: dict[str, Any]


class InformationExtractor:
    def __init__(self):
        self.api_key = settings.assemblyai_api_key
        self.model = settings.model_extraction
        self.headers = {
            "authorization": self.api_key,
            "content-type": "application/json",
        }

    async def extract_from_transcript(
        self,
        transcript_text: str,
        file_name: str | None = None,
    ) -> ExtractionResult:
        prompt = MEETING_EXTRACTION_PROMPT.format(transcript=transcript_text)

        logger.info(
            "Sending transcript to LLM Gateway",
            model=self.model,
            transcript_length=len(transcript_text),
            file_name=file_name,
        )

        response = requests.post(
            LLM_GATEWAY_URL,
            headers=self.headers,
            json={
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 4000,
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"LLM Gateway request failed: {response.text}")

        result = response.json()
        content = result["choices"][0]["message"]["content"]

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            start_idx = content.find("{")
            end_idx = content.rfind("}") + 1
            if start_idx != -1 and end_idx > start_idx:
                parsed = json.loads(content[start_idx:end_idx])
            else:
                logger.error("Failed to parse LLM response as JSON", content=content[:500])
                parsed = {}

        logger.info("Extraction complete", file_name=file_name)

        return ExtractionResult(
            summary=parsed.get("summary", ""),
            decisions=parsed.get("decisions", []),
            action_items=parsed.get("action_items", []),
            key_points=parsed.get("key_points", []),
            questions_raised=parsed.get("questions_raised", []),
            concerns=parsed.get("concerns", []),
            topics_discussed=parsed.get("topics_discussed", []),
            follow_ups=parsed.get("follow_ups", []),
            raw_response=parsed,
        )

    def to_dict(self, result: ExtractionResult) -> dict[str, Any]:
        return {
            "summary": result.summary,
            "decisions": result.decisions,
            "action_items": result.action_items,
            "key_points": result.key_points,
            "questions_raised": result.questions_raised,
            "concerns": result.concerns,
            "topics_discussed": result.topics_discussed,
            "follow_ups": result.follow_ups,
        }
