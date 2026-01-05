from typing import Any

from pydantic import Field

from app.models.project import ProjectStatus
from app.schemas.base import BaseSchema, TimestampMixin


class DriveFolder(BaseSchema):
    id: str
    name: str


class ProjectBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None


class ProjectCreate(ProjectBase):
    drive_folders: list[DriveFolder] | None = None
    schema_type: str = "zuora_q2r"
    model_config_json: dict[str, Any] | None = None


class ProjectUpdate(BaseSchema):
    name: str | None = None
    description: str | None = None
    drive_folders: list[DriveFolder] | None = None
    schema_type: str | None = None
    model_config_json: dict[str, Any] | None = None
    status: ProjectStatus | None = None


class ProjectResponse(ProjectBase, TimestampMixin):
    id: int
    user_id: int
    drive_folders: list[DriveFolder] | None = None
    schema_type: str
    model_config_json: dict[str, Any] | None = None
    status: ProjectStatus


class ProjectWithStats(ProjectResponse):
    job_count: int = 0
    document_count: int = 0
    latest_job_status: str | None = None
