import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.datetime_utils import utc_now
from app.db.database import Base

if TYPE_CHECKING:
    from app.models.job import ProcessingJob
    from app.models.project import Project


class DocumentStatus(str, enum.Enum):
    DRAFT = "draft"
    GENERATING = "generating"
    COMPLETE = "complete"


class SectionStatus(str, enum.Enum):
    PENDING = "pending"
    GENERATING = "generating"
    REVIEWING = "reviewing"
    COMPLETE = "complete"
    SKIPPED = "skipped"


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id"), nullable=False)
    job_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("processing_jobs.id"), nullable=True
    )

    title: Mapped[str] = mapped_column(String, nullable=False)
    schema_type: Mapped[str] = mapped_column(String, nullable=False)

    content: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    markdown_content: Mapped[str | None] = mapped_column(Text, nullable=True)

    drive_file_id: Mapped[str | None] = mapped_column(String, nullable=True)
    drive_file_url: Mapped[str | None] = mapped_column(String, nullable=True)

    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus), default=DocumentStatus.DRAFT
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    project: Mapped["Project"] = relationship("Project", back_populates="documents")
    job: Mapped["ProcessingJob | None"] = relationship("ProcessingJob", back_populates="documents")
    sections: Mapped[list["DocumentSection"]] = relationship(
        "DocumentSection", back_populates="document"
    )


class DocumentSection(Base):
    __tablename__ = "document_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(Integer, ForeignKey("documents.id"), nullable=False)

    section_id: Mapped[str] = mapped_column(String, nullable=False)
    section_title: Mapped[str] = mapped_column(String, nullable=False)

    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[SectionStatus] = mapped_column(
        Enum(SectionStatus), default=SectionStatus.PENDING
    )

    generation_history: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    final_draft_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    document: Mapped["Document"] = relationship("Document", back_populates="sections")
