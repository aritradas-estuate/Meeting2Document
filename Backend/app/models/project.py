import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.datetime_utils import utc_now
from app.db.database import Base

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.job import ProcessingJob
    from app.models.user import User


class ProjectStatus(str, enum.Enum):
    ACTIVE = "active"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)

    drive_folders: Mapped[list[dict[str, str]] | None] = mapped_column(
        JSONB, nullable=True, default=list
    )

    schema_type: Mapped[str] = mapped_column(String, default="zuora_q2r")
    model_config_json: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True, name="model_config"
    )

    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus), default=ProjectStatus.ACTIVE)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    user: Mapped["User"] = relationship("User", back_populates="projects")
    jobs: Mapped[list["ProcessingJob"]] = relationship("ProcessingJob", back_populates="project")
    documents: Mapped[list["Document"]] = relationship("Document", back_populates="project")
