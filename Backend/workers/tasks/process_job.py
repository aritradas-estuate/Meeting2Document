"""
Main processing job task.

This task orchestrates the entire document generation pipeline:
1. Make files temporarily public on Google Drive
2. Extract information (transcription via AssemblyAI + extraction via GPT-5.2)
3. Synthesize information from all sources (Phase IV)
4. Generate document sections with writer/reviewer loop (Phase IV)
5. Assemble final document (Phase IV)
6. Upload to Google Drive (optional) (Phase IV)

Phase III implements steps 1-2 only (extraction pipeline).
"""

import asyncio
from datetime import datetime, timezone
from typing import Any

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload
from sqlalchemy.pool import NullPool

from app.config import settings
from app.core.logging import get_logger
from app.models.job import JobStatus, ProcessingJob
from app.models.project import Project
from app.services.drive_service import DriveService
from workers.ai_pipeline.extraction.transcription import TranscriptionService
from workers.ai_pipeline.extraction.information_extractor import InformationExtractor

logger = get_logger(__name__)

# File size limit for direct URL transcription (100MB)
MAX_DIRECT_URL_SIZE = 100 * 1024 * 1024


async def update_job_status(
    session: AsyncSession,
    job_id: int,
    status: JobStatus,
    current_stage: str | None = None,
    stage_progress: dict[str, Any] | None = None,
    error_message: str | None = None,
    extraction_result: dict[str, Any] | None = None,
) -> ProcessingJob:
    result = await session.execute(select(ProcessingJob).where(ProcessingJob.id == job_id))
    job = result.scalar_one()

    job.status = status
    if current_stage is not None:
        job.current_stage = current_stage
    if stage_progress is not None:
        job.stage_progress = {**job.stage_progress, **stage_progress}
    if error_message is not None:
        job.error_message = error_message
    if extraction_result is not None:
        job.extraction_result = extraction_result

    if status == JobStatus.PENDING:
        job.started_at = None
        job.completed_at = None
    elif status in [JobStatus.COMPLETED, JobStatus.FAILED]:
        job.completed_at = datetime.now(timezone.utc)

    await session.commit()
    return job


async def process_single_file(
    file_info: dict[str, Any],
    drive_service: DriveService,
    transcription_service: TranscriptionService,
    extractor: InformationExtractor,
    session: AsyncSession,
    job_id: int,
    file_index: int,
    total_files: int,
) -> dict[str, Any]:
    file_id = file_info["id"]
    file_name = file_info.get("name", "Unknown")
    file_size = file_info.get("size", 0)

    logger.info("Processing file", file_id=file_id, file_name=file_name, file_size=file_size)

    if file_size > MAX_DIRECT_URL_SIZE:
        raise ValueError(f"File {file_name} exceeds 100MB limit. Please compress and re-upload.")

    def update_progress(progress: int, message: str) -> None:
        base_progress = (file_index / total_files) * 100
        file_contribution = (1 / total_files) * progress
        total_progress = base_progress + file_contribution
        logger.debug(
            "File progress",
            file_name=file_name,
            progress=progress,
            message=message,
            total_progress=total_progress,
        )

    try:
        update_progress(0, "Making file temporarily public...")
        download_url = await drive_service.make_file_public(file_id)

        update_progress(5, "Starting transcription...")
        transcription_result = await transcription_service.transcribe_from_url(
            download_url,
            progress_callback=lambda p, m: update_progress(5 + int(p * 0.6), m),
        )

        update_progress(70, "Revoking public access...")
        await drive_service.revoke_public_access(file_id)

        update_progress(75, "Extracting key information...")
        extraction_result = await extractor.extract_from_transcript(
            transcription_result.text,
            file_name=file_name,
        )

        update_progress(100, "Complete")

        return {
            "file_id": file_id,
            "file_name": file_name,
            "file_size": file_size,
            "status": "completed",
            "transcription": transcription_service.to_dict(transcription_result),
            "extraction": extractor.to_dict(extraction_result),
        }

    except Exception as e:
        logger.exception("Failed to process file", file_id=file_id, error=str(e))

        try:
            await drive_service.revoke_public_access(file_id)
        except Exception:
            pass

        return {
            "file_id": file_id,
            "file_name": file_name,
            "file_size": file_size,
            "status": "failed",
            "error": str(e),
        }


async def process_job_async(job_id: int) -> dict[str, Any]:
    logger.info("Starting job processing", job_id=job_id)

    task_engine = create_async_engine(
        settings.database_url,
        poolclass=NullPool,
    )
    TaskSessionLocal = async_sessionmaker(
        bind=task_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    try:
        async with TaskSessionLocal() as session:
            result = await session.execute(
                select(ProcessingJob)
                .options(selectinload(ProcessingJob.project).selectinload(Project.user))
                .where(ProcessingJob.id == job_id)
            )
            job = result.scalar_one_or_none()

            if not job:
                logger.error("Job not found", job_id=job_id)
                raise ValueError(f"Job {job_id} not found")

            user = job.project.user
            if not user or not user.access_token:
                raise ValueError("User not found or missing Google credentials")

            try:
                job.status = JobStatus.EXTRACTING
                job.started_at = datetime.now(timezone.utc)
                job.current_stage = "extracting"
                await session.commit()

                drive_service = DriveService(user, session)
                transcription_service = TranscriptionService()
                extractor = InformationExtractor()

                extraction_results: dict[str, Any] = {
                    "files": [],
                    "supporting_documents": [],
                    "metadata": {
                        "started_at": datetime.now(timezone.utc).isoformat(),
                        "models_used": {
                            "transcription": "assemblyai",
                            "extraction": settings.model_extraction,
                        },
                    },
                }

                video_files = job.video_files or []
                total_files = len(video_files)

                logger.info("Processing video files", job_id=job_id, total_files=total_files)

                for idx, file_info in enumerate(video_files):
                    file_name = file_info.get("name", "Unknown")

                    await update_job_status(
                        session,
                        job_id,
                        JobStatus.EXTRACTING,
                        stage_progress={
                            "extracting": {
                                "status": "in_progress",
                                "progress": int((idx / total_files) * 100),
                                "current_file": file_name,
                                "files_completed": idx,
                                "total_files": total_files,
                            }
                        },
                    )

                    file_result = await process_single_file(
                        file_info=file_info,
                        drive_service=drive_service,
                        transcription_service=transcription_service,
                        extractor=extractor,
                        session=session,
                        job_id=job_id,
                        file_index=idx,
                        total_files=total_files,
                    )

                    extraction_results["files"].append(file_result)

                extraction_results["metadata"]["completed_at"] = datetime.now(
                    timezone.utc
                ).isoformat()
                extraction_results["metadata"]["total_files_processed"] = total_files

                successful_files = sum(
                    1 for f in extraction_results["files"] if f["status"] == "completed"
                )
                failed_files = total_files - successful_files

                if failed_files == total_files:
                    raise ValueError("All files failed to process")

                await update_job_status(
                    session,
                    job_id,
                    JobStatus.COMPLETED,
                    current_stage="completed",
                    stage_progress={
                        "extracting": {
                            "status": "completed",
                            "progress": 100,
                            "files_completed": total_files,
                            "total_files": total_files,
                            "successful": successful_files,
                            "failed": failed_files,
                        }
                    },
                    extraction_result=extraction_results,
                )

                logger.info(
                    "Job completed successfully",
                    job_id=job_id,
                    successful_files=successful_files,
                    failed_files=failed_files,
                )

                return {
                    "status": "completed",
                    "job_id": job_id,
                    "files_processed": total_files,
                    "successful": successful_files,
                    "failed": failed_files,
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

                raise
    finally:
        await task_engine.dispose()


@shared_task(
    bind=True,
    name="workers.tasks.process_job.process_job",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    max_retries=3,
)
def process_job(self, job_id: int) -> dict[str, Any]:
    try:
        result = asyncio.run(process_job_async(job_id))
        return result
    except Exception as e:
        logger.exception("Task failed", job_id=job_id, error=str(e))
        raise
