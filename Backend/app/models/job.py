import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.datetime_utils import utc_now
from app.db.database import Base

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.project import Project


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    DOWNLOADING = "downloading"
    EXTRACTING = "extracting"
    SYNTHESIZING = "synthesizing"
    GENERATING = "generating"
    REVIEWING = "reviewing"
    ASSEMBLING = "assembling"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    FAILED = "failed"


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id"), nullable=False)

    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.PENDING)

    video_files: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    supporting_files: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)

    current_stage: Mapped[str | None] = mapped_column(String, nullable=True)
    stage_progress: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    extraction_result: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    synthesis_result: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    project: Mapped["Project"] = relationship("Project", back_populates="jobs")
    documents: Mapped[list["Document"]] = relationship("Document", back_populates="job")
