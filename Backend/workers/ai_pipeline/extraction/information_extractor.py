import json
from dataclasses import dataclass
from typing import Any

import requests
import tenacity

from app.config import settings
from app.core.logging import get_logger
from workers.ai_pipeline.extraction.json_utils import parse_llm_json
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


def _create_empty_result() -> ExtractionResult:
    return ExtractionResult(
        summary="",
        decisions=[],
        action_items=[],
        key_points=[],
        questions_raised=[],
        concerns=[],
        topics_discussed=[],
        follow_ups=[],
        raw_response={},
    )


class InformationExtractor:
    def __init__(self) -> None:
        self.api_key = settings.assemblyai_api_key
        self.model = settings.model_extraction
        self.headers = {
            "authorization": self.api_key,
            "content-type": "application/json",
        }

    def _call_llm(self, prompt: str) -> str:
        response = requests.post(
            LLM_GATEWAY_URL,
            headers=self.headers,
            json={
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are an expert at extracting structured information from meeting transcripts. "
                            "You MUST respond with valid JSON only. Do not include any text before or after the JSON. "
                            "Do not wrap the JSON in markdown code blocks."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 4000,
                "temperature": 0.0,
            },
            timeout=120,
        )

        if response.status_code != 200:
            raise requests.exceptions.HTTPError(
                f"LLM Gateway request failed with status {response.status_code}: {response.text}"
            )

        result = response.json()
        return result["choices"][0]["message"]["content"]

    @tenacity.retry(
        wait=tenacity.wait_exponential(multiplier=2, min=4, max=30),
        stop=tenacity.stop_after_attempt(3),
        retry=tenacity.retry_if_exception_type(
            (
                requests.exceptions.ConnectionError,
                requests.exceptions.Timeout,
                requests.exceptions.HTTPError,
                json.JSONDecodeError,
                KeyError,
            )
        ),
        before_sleep=lambda retry_state: logger.warning(
            "Retrying LLM extraction",
            attempt=retry_state.attempt_number,
        ),
        reraise=True,
    )
    def _call_llm_with_retry(self, prompt: str) -> dict[str, Any]:
        content = self._call_llm(prompt)
        parsed = parse_llm_json(content)

        if not parsed:
            raise json.JSONDecodeError("Failed to parse JSON after all strategies", content, 0)

        return parsed

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

        try:
            parsed = self._call_llm_with_retry(prompt)
        except tenacity.RetryError as e:
            logger.error(
                "LLM extraction failed after all retries",
                file_name=file_name,
                error=str(e.last_attempt.exception()),
            )
            return _create_empty_result()
        except Exception as e:
            logger.error(
                "Unexpected error during LLM extraction",
                file_name=file_name,
                error=str(e),
            )
            return _create_empty_result()

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
