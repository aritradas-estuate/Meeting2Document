"""
Project-related Pydantic schemas.
"""

from typing import Any

from pydantic import Field

from app.models.project import ProjectStatus
from app.schemas.base import BaseSchema, TimestampMixin


class ProjectBase(BaseSchema):
    """Base project schema."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None


class ProjectCreate(ProjectBase):
    """Schema for creating a project."""

    drive_folder_id: str | None = None
    drive_folder_name: str | None = None
    schema_type: str = "zuora_q2r"
    model_config_json: dict[str, Any] | None = None


class ProjectUpdate(BaseSchema):
    """Schema for updating a project."""

    name: str | None = None
    description: str | None = None
    drive_folder_id: str | None = None
    drive_folder_name: str | None = None
    schema_type: str | None = None
    model_config_json: dict[str, Any] | None = None
    status: ProjectStatus | None = None


class ProjectResponse(ProjectBase, TimestampMixin):
    """Project response schema."""

    id: int
    user_id: int
    drive_folder_id: str | None = None
    drive_folder_name: str | None = None
    schema_type: str
    model_config_json: dict[str, Any] | None = None
    status: ProjectStatus


class ProjectWithStats(ProjectResponse):
    """Project response with additional statistics."""

    job_count: int = 0
    document_count: int = 0
    latest_job_status: str | None = None
