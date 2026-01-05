"""
Processing job API endpoints.
"""

from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession, Pagination, require_project_access
from app.config import settings
from app.core.exceptions import NotFoundError, ValidationError
from app.core.logging import get_logger
from app.models.job import JobStatus, ProcessingJob
from app.models.project import Project, ProjectStatus
from app.schemas.base import MessageResponse, PaginatedResponse
from app.schemas.job import JobCreate, JobProgress, JobResponse, JobWithResults
from workers.celery_app import celery_app

logger = get_logger(__name__)

router = APIRouter()


@router.post("", response_model=JobResponse, status_code=201)
async def create_job(
    db: DbSession,
    current_user: CurrentUser,
    job_in: JobCreate,
) -> JobResponse:
    """
    Create a new processing job.

    This queues a job to process the selected video files and generate a document.
    """
    # Verify project access
    result = await db.execute(select(Project).where(Project.id == job_in.project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise NotFoundError(message="Project not found")

    require_project_access(project.user_id, current_user)

    if not job_in.video_files:
        raise ValidationError(message="At least one video file is required")

    max_size_bytes = settings.max_file_size_mb * 1024 * 1024
    oversized_files = [f.name for f in job_in.video_files if f.size and f.size > max_size_bytes]
    if oversized_files:
        raise ValidationError(
            message=f"Files exceed {settings.max_file_size_mb}MB limit: {', '.join(oversized_files)}. "
            "Please compress these files before processing."
        )

    # Create job
    job = ProcessingJob(
        project_id=job_in.project_id,
        video_files=[f.model_dump() for f in job_in.video_files],
        supporting_files=[f.model_dump() for f in job_in.supporting_files]
        if job_in.supporting_files
        else None,
        status=JobStatus.PENDING,
        stage_progress={},
    )
    db.add(job)
    await db.flush()

    # Update project status
    project.status = ProjectStatus.PROCESSING

    await db.commit()

    logger.info("Created processing job", job_id=job.id, project_id=project.id)

    celery_app.send_task(
        "workers.tasks.process_job.process_job",
        args=[job.id],
        queue="processing",
    )

    return JobResponse.model_validate(job)


@router.get("", response_model=PaginatedResponse[JobResponse])
async def list_jobs(
    db: DbSession,
    current_user: CurrentUser,
    pagination: Pagination,
    project_id: int | None = None,
    status: JobStatus | None = None,
) -> PaginatedResponse[JobResponse]:
    """List all processing jobs for the current user's projects."""
    # Build query - join with projects to filter by user
    query = select(ProcessingJob).join(Project).where(Project.user_id == current_user.id)

    if project_id:
        query = query.filter(ProcessingJob.project_id == project_id)

    if status:
        query = query.filter(ProcessingJob.status == status)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(ProcessingJob.created_at.desc())
    query = query.offset(pagination.offset).limit(pagination.page_size)

    result = await db.execute(query)
    jobs = result.scalars().all()

    return PaginatedResponse(
        items=[JobResponse.model_validate(j) for j in jobs],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + pagination.page_size - 1) // pagination.page_size,
    )


@router.get("/{job_id}", response_model=JobWithResults)
async def get_job(
    db: DbSession,
    current_user: CurrentUser,
    job_id: int,
) -> JobWithResults:
    """Get a specific job with full results."""
    result = await db.execute(select(ProcessingJob).join(Project).where(ProcessingJob.id == job_id))
    job = result.scalar_one_or_none()

    if not job:
        raise NotFoundError(message="Job not found")

    # Verify access through project
    require_project_access(job.project.user_id, current_user)

    return JobWithResults.model_validate(job)


@router.get("/{job_id}/progress", response_model=JobProgress)
async def get_job_progress(
    db: DbSession,
    current_user: CurrentUser,
    job_id: int,
) -> JobProgress:
    """Get current progress of a processing job."""
    result = await db.execute(select(ProcessingJob).join(Project).where(ProcessingJob.id == job_id))
    job = result.scalar_one_or_none()

    if not job:
        raise NotFoundError(message="Job not found")

    require_project_access(job.project.user_id, current_user)

    return JobProgress(
        job_id=job.id,
        status=job.status,
        current_stage=job.current_stage,
        stage_progress=job.stage_progress,
        message=_get_status_message(job),
    )


@router.post("/{job_id}/cancel", response_model=MessageResponse)
async def cancel_job(
    db: DbSession,
    current_user: CurrentUser,
    job_id: int,
) -> MessageResponse:
    """Cancel a processing job."""
    result = await db.execute(select(ProcessingJob).join(Project).where(ProcessingJob.id == job_id))
    job = result.scalar_one_or_none()

    if not job:
        raise NotFoundError(message="Job not found")

    require_project_access(job.project.user_id, current_user)

    # Can only cancel jobs that haven't completed
    if job.status in [JobStatus.COMPLETED, JobStatus.FAILED]:
        raise ValidationError(message=f"Cannot cancel job with status: {job.status.value}")

    job.status = JobStatus.FAILED
    job.error_message = "Cancelled by user"
    job.completed_at = datetime.now(timezone.utc)

    # Reset project status if this was the only processing job
    # (In production, check if there are other active jobs)
    job.project.status = ProjectStatus.ACTIVE

    logger.info("Cancelled job", job_id=job.id)

    # TODO: Cancel Celery task
    # celery_app.control.revoke(job.celery_task_id, terminate=True)

    return MessageResponse(message="Job cancelled successfully")


@router.post("/{job_id}/retry", response_model=JobResponse)
async def retry_job(
    db: DbSession,
    current_user: CurrentUser,
    job_id: int,
) -> JobResponse:
    """Retry a failed processing job."""
    result = await db.execute(select(ProcessingJob).join(Project).where(ProcessingJob.id == job_id))
    job = result.scalar_one_or_none()

    if not job:
        raise NotFoundError(message="Job not found")

    require_project_access(job.project.user_id, current_user)

    if job.status != JobStatus.FAILED:
        raise ValidationError(message="Can only retry failed jobs")

    # Reset job status
    job.status = JobStatus.PENDING
    job.error_message = None
    job.current_stage = None
    job.stage_progress = {}
    job.started_at = None
    job.completed_at = None

    # Update project status
    job.project.status = ProjectStatus.PROCESSING

    await db.commit()

    logger.info("Retrying job", job_id=job.id)

    celery_app.send_task(
        "workers.tasks.process_job.process_job",
        args=[job.id],
        queue="processing",
    )

    return JobResponse.model_validate(job)


def _get_status_message(job: ProcessingJob) -> str:
    """Generate a human-readable status message for a job."""
    status_messages = {
        JobStatus.PENDING: "Waiting to start processing...",
        JobStatus.DOWNLOADING: "Downloading video files from Google Drive...",
        JobStatus.EXTRACTING: "Extracting information from videos (transcription + visual analysis)...",
        JobStatus.SYNTHESIZING: "Synthesizing information from all sources...",
        JobStatus.GENERATING: "Generating document sections...",
        JobStatus.REVIEWING: "Reviewing and refining document sections...",
        JobStatus.ASSEMBLING: "Assembling final document...",
        JobStatus.UPLOADING: "Uploading document to Google Drive...",
        JobStatus.COMPLETED: "Processing complete!",
        JobStatus.FAILED: job.error_message or "Processing failed",
    }
    return status_messages.get(job.status, "Processing...")
