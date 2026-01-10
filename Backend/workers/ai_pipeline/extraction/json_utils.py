import json
import re
from typing import Any

from json_repair import repair_json

from app.core.logging import get_logger

logger = get_logger(__name__)


def strip_markdown_code_blocks(text: str) -> str:
    # Matches ```json\n...\n``` or ```\n...\n```
    pattern = r"```(?:json)?\s*\n?(.*?)\n?```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text.strip()


def extract_json_substring(text: str) -> str:
    start_idx = text.find("{")
    end_idx = text.rfind("}") + 1
    if start_idx != -1 and end_idx > start_idx:
        return text[start_idx:end_idx]
    return text


def parse_llm_json(content: str) -> dict[str, Any]:
    original_content = content

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        logger.debug("Direct JSON parsing failed")

    content = strip_markdown_code_blocks(content)
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        logger.debug("Parsing after markdown strip failed")

    content = extract_json_substring(content)
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        logger.debug("Parsing after JSON extraction failed")

    try:
        result = repair_json(content, return_objects=True)
        if isinstance(result, dict):
            logger.info("Successfully repaired malformed JSON")
            return result
        else:
            logger.warning("JSON repair returned non-dict type", result_type=type(result).__name__)
            return {}
    except Exception as e:
        logger.error(
            "All JSON parsing strategies failed",
            error=str(e),
            content_preview=original_content[:500],
        )
        return {}
