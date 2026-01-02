"""
Processing job-related Pydantic schemas.
"""

from datetime import datetime
from typing import Any

from pydantic import Field

from app.models.job import JobStatus
from app.schemas.base import BaseSchema, TimestampMixin


class DriveFile(BaseSchema):
    """Schema for a Google Drive file reference."""

    id: str
    name: str
    mime_type: str
    size: int | None = None
    web_view_link: str | None = None


class JobCreate(BaseSchema):
    """Schema for creating a processing job."""

    project_id: int
    video_files: list[DriveFile] = Field(..., min_length=1)
    supporting_files: list[DriveFile] | None = None


class JobUpdate(BaseSchema):
    """Schema for updating a job (internal use)."""

    status: JobStatus | None = None
    current_stage: str | None = None
    stage_progress: dict[str, Any] | None = None
    extraction_result: dict[str, Any] | None = None
    synthesis_result: dict[str, Any] | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


class JobResponse(BaseSchema, TimestampMixin):
    """Processing job response schema."""

    id: int
    project_id: int
    status: JobStatus
    video_files: list[dict[str, Any]]
    supporting_files: list[dict[str, Any]] | None = None
    current_stage: str | None = None
    stage_progress: dict[str, Any]
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


class JobProgress(BaseSchema):
    """Real-time job progress update."""

    job_id: int
    status: JobStatus
    current_stage: str | None
    stage_progress: dict[str, Any]
    message: str | None = None


class JobWithResults(JobResponse):
    """Job response including processing results."""

    extraction_result: dict[str, Any] | None = None
    synthesis_result: dict[str, Any] | None = None
