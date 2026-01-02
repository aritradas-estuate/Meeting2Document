"""
Main processing job task.

This task orchestrates the entire document generation pipeline:
1. Download video files from Google Drive
2. Extract information (transcription + video analysis)
3. Synthesize information from all sources
4. Generate document sections with writer/reviewer loop
5. Assemble final document
6. Upload to Google Drive (optional)
"""

import asyncio
from datetime import datetime, timezone
from typing import Any

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.logging import get_logger
from app.db.database import AsyncSessionLocal
from app.models.job import JobStatus, ProcessingJob
from app.models.project import Project, ProjectStatus

logger = get_logger(__name__)


async def update_job_status(
    session: AsyncSession,
    job_id: int,
    status: JobStatus,
    current_stage: str | None = None,
    stage_progress: dict[str, Any] | None = None,
    error_message: str | None = None,
) -> ProcessingJob:
    """Update job status in the database."""
    result = await session.execute(select(ProcessingJob).where(ProcessingJob.id == job_id))
    job = result.scalar_one()

    job.status = status
    if current_stage is not None:
        job.current_stage = current_stage
    if stage_progress is not None:
        job.stage_progress = {**job.stage_progress, **stage_progress}
    if error_message is not None:
        job.error_message = error_message

    if status == JobStatus.PENDING:
        job.started_at = None
        job.completed_at = None
    elif status in [JobStatus.COMPLETED, JobStatus.FAILED]:
        job.completed_at = datetime.now(timezone.utc)

    await session.commit()
    return job


async def process_job_async(job_id: int) -> dict[str, Any]:
    """
    Async implementation of the job processing pipeline.

    This is the main entry point for processing a job.
    """
    logger.info("Starting job processing", job_id=job_id)

    async with AsyncSessionLocal() as session:
        # Get job and project
        result = await session.execute(select(ProcessingJob).where(ProcessingJob.id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            logger.error("Job not found", job_id=job_id)
            raise ValueError(f"Job {job_id} not found")

        try:
            # Mark job as started
            job.status = JobStatus.DOWNLOADING
            job.started_at = datetime.now(timezone.utc)
            job.current_stage = "downloading"
            await session.commit()

            # Stage 1: Download video files from Google Drive
            logger.info("Stage 1: Downloading files", job_id=job_id)
            await update_job_status(
                session,
                job_id,
                JobStatus.DOWNLOADING,
                current_stage="downloading",
                stage_progress={"downloading": {"status": "in_progress", "progress": 0}},
            )

            # TODO: Implement file download from Google Drive
            # downloaded_files = await download_files(job.video_files, job.supporting_files)

            await update_job_status(
                session,
                job_id,
                JobStatus.DOWNLOADING,
                stage_progress={"downloading": {"status": "completed", "progress": 100}},
            )

            # Stage 2: Extract information (transcription + video analysis)
            logger.info("Stage 2: Extracting information", job_id=job_id)
            await update_job_status(
                session,
                job_id,
                JobStatus.EXTRACTING,
                current_stage="extracting",
                stage_progress={"extracting": {"status": "in_progress", "progress": 0}},
            )

            # TODO: Implement extraction pipeline
            # - AssemblyAI transcription
            # - Gemini video analysis
            # extraction_result = await extract_information(downloaded_files)

            await update_job_status(
                session,
                job_id,
                JobStatus.EXTRACTING,
                stage_progress={"extracting": {"status": "completed", "progress": 100}},
            )

            # Stage 3: Synthesize information
            logger.info("Stage 3: Synthesizing information", job_id=job_id)
            await update_job_status(
                session,
                job_id,
                JobStatus.SYNTHESIZING,
                current_stage="synthesizing",
                stage_progress={"synthesizing": {"status": "in_progress", "progress": 0}},
            )

            # TODO: Implement synthesis
            # synthesis_result = await synthesize_information(extraction_result)

            await update_job_status(
                session,
                job_id,
                JobStatus.SYNTHESIZING,
                stage_progress={"synthesizing": {"status": "completed", "progress": 100}},
            )

            # Stage 4: Generate document sections
            logger.info("Stage 4: Generating sections", job_id=job_id)
            await update_job_status(
                session,
                job_id,
                JobStatus.GENERATING,
                current_stage="generating",
                stage_progress={"generating": {"status": "in_progress", "progress": 0}},
            )

            # TODO: Implement section generation with CrewAI
            # - Writer agent generates sections
            # - Reviewer agent reviews and provides feedback
            # - Loop until approved or max iterations

            await update_job_status(
                session,
                job_id,
                JobStatus.GENERATING,
                stage_progress={"generating": {"status": "completed", "progress": 100}},
            )

            # Stage 5: Review sections
            logger.info("Stage 5: Reviewing sections", job_id=job_id)
            await update_job_status(
                session,
                job_id,
                JobStatus.REVIEWING,
                current_stage="reviewing",
                stage_progress={"reviewing": {"status": "in_progress", "progress": 0}},
            )

            # Review is part of the generation loop

            await update_job_status(
                session,
                job_id,
                JobStatus.REVIEWING,
                stage_progress={"reviewing": {"status": "completed", "progress": 100}},
            )

            # Stage 6: Assemble final document
            logger.info("Stage 6: Assembling document", job_id=job_id)
            await update_job_status(
                session,
                job_id,
                JobStatus.ASSEMBLING,
                current_stage="assembling",
                stage_progress={"assembling": {"status": "in_progress", "progress": 0}},
            )

            # TODO: Implement document assembly
            # - Create Document record
            # - Create DocumentSection records
            # - Generate markdown content

            await update_job_status(
                session,
                job_id,
                JobStatus.ASSEMBLING,
                stage_progress={"assembling": {"status": "completed", "progress": 100}},
            )

            # Stage 7: Upload to Google Drive (optional)
            logger.info("Stage 7: Uploading document", job_id=job_id)
            await update_job_status(
                session,
                job_id,
                JobStatus.UPLOADING,
                current_stage="uploading",
                stage_progress={"uploading": {"status": "in_progress", "progress": 0}},
            )

            # TODO: Implement Google Drive upload
            # - Convert markdown to Google Docs
            # - Upload to project folder

            await update_job_status(
                session,
                job_id,
                JobStatus.UPLOADING,
                stage_progress={"uploading": {"status": "completed", "progress": 100}},
            )

            # Mark job as completed
            logger.info("Job completed successfully", job_id=job_id)
            await update_job_status(
                session,
                job_id,
                JobStatus.COMPLETED,
                current_stage="completed",
            )

            # Update project status
            project_result = await session.execute(
                select(Project).where(Project.id == job.project_id)
            )
            project = project_result.scalar_one()
            project.status = ProjectStatus.COMPLETED
            await session.commit()

            return {
                "status": "completed",
                "job_id": job_id,
                "message": "Document generated successfully",
            }

        except Exception as e:
            logger.exception("Job processing failed", job_id=job_id, error=str(e))

            await update_job_status(
                session,
                job_id,
                JobStatus.FAILED,
                current_stage="failed",
                error_message=str(e),
            )

            # Reset project status
            project_result = await session.execute(
                select(Project).where(Project.id == job.project_id)
            )
            project = project_result.scalar_one()
            project.status = ProjectStatus.ACTIVE
            await session.commit()

            raise


@shared_task(
    bind=True,
    name="workers.tasks.process_job.process_job",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    max_retries=3,
)
def process_job(self, job_id: int) -> dict[str, Any]:
    """
    Celery task to process a job.

    This wraps the async implementation to run in the Celery worker.
    """
    try:
        # Run the async function in an event loop
        result = asyncio.run(process_job_async(job_id))
        return result
    except Exception as e:
        logger.exception("Task failed", job_id=job_id, error=str(e))
        raise
