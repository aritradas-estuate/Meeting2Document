import time
from dataclasses import dataclass
from typing import Any, Callable

import requests

from app.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com"


@dataclass
class SpeakerSegment:
    speaker: str
    start: float
    end: float
    text: str


@dataclass
class TranscriptionResult:
    text: str
    speakers: list[SpeakerSegment]
    duration_seconds: float
    confidence: float
    chapters: list[dict[str, Any]]
    utterances: list[dict[str, Any]]
    words: list[dict[str, Any]]


class TranscriptionService:
    def __init__(self):
        self.api_key = settings.assemblyai_api_key
        self.headers = {"authorization": self.api_key}

    async def transcribe_from_url(
        self,
        audio_url: str,
        progress_callback: Callable[[int, str], None] | None = None,
    ) -> TranscriptionResult:
        if progress_callback:
            progress_callback(0, "Submitting to AssemblyAI...")

        transcript_response = requests.post(
            f"{ASSEMBLYAI_BASE_URL}/v2/transcript",
            headers=self.headers,
            json={
                "audio_url": audio_url,
                "speaker_labels": True,
                "auto_chapters": True,
            },
        )

        if transcript_response.status_code != 200:
            raise RuntimeError(f"AssemblyAI submission failed: {transcript_response.text}")

        transcript_id = transcript_response.json()["id"]
        logger.info("Submitted transcription job", transcript_id=transcript_id)

        if progress_callback:
            progress_callback(10, "Transcription in progress...")

        polling_endpoint = f"{ASSEMBLYAI_BASE_URL}/v2/transcript/{transcript_id}"
        last_progress = 10

        while True:
            poll_response = requests.get(polling_endpoint, headers=self.headers)
            result = poll_response.json()

            status = result.get("status")

            if status == "completed":
                if progress_callback:
                    progress_callback(100, "Transcription complete")
                break
            elif status == "error":
                raise RuntimeError(f"Transcription failed: {result.get('error')}")

            if progress_callback and last_progress < 90:
                last_progress = min(last_progress + 5, 90)
                progress_callback(last_progress, "Transcription in progress...")

            time.sleep(3)

        speakers = []
        for utterance in result.get("utterances", []):
            speakers.append(
                SpeakerSegment(
                    speaker=utterance.get("speaker", "Unknown"),
                    start=utterance.get("start", 0) / 1000,
                    end=utterance.get("end", 0) / 1000,
                    text=utterance.get("text", ""),
                )
            )

        return TranscriptionResult(
            text=result.get("text", ""),
            speakers=speakers,
            duration_seconds=(result.get("audio_duration") or 0),
            confidence=result.get("confidence", 0),
            chapters=result.get("chapters") or [],
            utterances=result.get("utterances") or [],
            words=result.get("words") or [],
        )

    def to_dict(self, result: TranscriptionResult) -> dict[str, Any]:
        return {
            "text": result.text,
            "speakers": [
                {
                    "speaker": s.speaker,
                    "start": s.start,
                    "end": s.end,
                    "text": s.text,
                }
                for s in result.speakers
            ],
            "duration_seconds": result.duration_seconds,
            "confidence": result.confidence,
            "chapters": result.chapters,
            "utterances": result.utterances,
            "words": result.words,
        }
