"""
Document-related Pydantic schemas.
"""

from datetime import datetime
from typing import Any

from pydantic import Field

from app.models.document import DocumentStatus, SectionStatus
from app.schemas.base import BaseSchema, TimestampMixin


class DocumentSectionBase(BaseSchema):
    """Base document section schema."""

    section_id: str
    section_title: str


class DocumentSectionCreate(DocumentSectionBase):
    """Schema for creating a document section."""

    content: str | None = None


class DocumentSectionUpdate(BaseSchema):
    """Schema for updating a document section."""

    content: str | None = None
    status: SectionStatus | None = None


class DocumentSectionResponse(DocumentSectionBase, TimestampMixin):
    """Document section response schema."""

    id: int
    document_id: int
    content: str | None = None
    status: SectionStatus
    review_count: int
    final_draft_number: int | None = None


class DocumentSectionWithHistory(DocumentSectionResponse):
    """Document section with full generation history."""

    generation_history: list[dict[str, Any]]


class DocumentBase(BaseSchema):
    """Base document schema."""

    title: str = Field(..., min_length=1, max_length=500)
    schema_type: str


class DocumentCreate(DocumentBase):
    """Schema for creating a document."""

    project_id: int
    job_id: int | None = None
    content: dict[str, Any] | None = None
    markdown_content: str | None = None


class DocumentUpdate(BaseSchema):
    """Schema for updating a document."""

    title: str | None = None
    content: dict[str, Any] | None = None
    markdown_content: str | None = None
    status: DocumentStatus | None = None


class DocumentResponse(DocumentBase, TimestampMixin):
    """Document response schema."""

    id: int
    project_id: int
    job_id: int | None = None
    drive_file_id: str | None = None
    drive_file_url: str | None = None
    version: int
    status: DocumentStatus


class DocumentWithSections(DocumentResponse):
    """Document response with all sections."""

    sections: list[DocumentSectionResponse]


class DocumentExport(BaseSchema):
    """Schema for document export request."""

    format: str = Field(default="markdown", pattern="^(markdown|google_doc)$")
    include_metadata: bool = False


class DocumentExportResponse(BaseSchema):
    """Response from document export."""

    format: str
    content: str | None = None  # For markdown
    drive_file_id: str | None = None  # For Google Docs
    drive_file_url: str | None = None  # For Google Docs
