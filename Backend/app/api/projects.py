"""
Project management API endpoints.
"""

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession, Pagination, require_project_access
from app.core.exceptions import NotFoundError, ValidationError
from app.core.logging import get_logger
from app.models.document import Document
from app.models.job import ProcessingJob
from app.models.project import Project, ProjectStatus
from app.schemas.base import MessageResponse, PaginatedResponse
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate, ProjectWithStats

logger = get_logger(__name__)

router = APIRouter()


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    db: DbSession,
    current_user: CurrentUser,
    project_in: ProjectCreate,
) -> ProjectResponse:
    """Create a new project."""
    drive_folders_data = None
    if project_in.drive_folders:
        drive_folders_data = [f.model_dump() for f in project_in.drive_folders]

    project = Project(
        user_id=current_user.id,
        name=project_in.name,
        description=project_in.description,
        drive_folders=drive_folders_data,
        schema_type=project_in.schema_type,
        model_config_json=project_in.model_config_json,
    )
    db.add(project)
    await db.flush()

    logger.info("Created project", project_id=project.id, user_id=current_user.id)
    return ProjectResponse.model_validate(project)


@router.get("", response_model=PaginatedResponse[ProjectResponse])
async def list_projects(
    db: DbSession,
    current_user: CurrentUser,
    pagination: Pagination,
    status: str | None = None,
) -> PaginatedResponse[ProjectResponse]:
    query = select(Project).where(Project.user_id == current_user.id)

    if status:
        status_list = [s.strip().upper() for s in status.split(",")]
        valid_statuses = [
            ProjectStatus(s.lower())
            for s in status_list
            if s.lower() in [e.value for e in ProjectStatus]
        ]
        if valid_statuses:
            query = query.filter(Project.status.in_(valid_statuses))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(Project.updated_at.desc())
    query = query.offset(pagination.offset).limit(pagination.page_size)

    result = await db.execute(query)
    projects = result.scalars().all()

    return PaginatedResponse(
        items=[ProjectResponse.model_validate(p) for p in projects],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + pagination.page_size - 1) // pagination.page_size,
    )


@router.get("/{project_id}", response_model=ProjectWithStats)
async def get_project(
    db: DbSession,
    current_user: CurrentUser,
    project_id: int,
) -> ProjectWithStats:
    """Get a specific project with statistics."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise NotFoundError(message="Project not found")

    require_project_access(project.user_id, current_user)

    # Get job count
    job_count_result = await db.execute(
        select(func.count())
        .select_from(ProcessingJob)
        .where(ProcessingJob.project_id == project_id)
    )
    job_count = job_count_result.scalar() or 0

    # Get document count
    doc_count_result = await db.execute(
        select(func.count()).select_from(Document).where(Document.project_id == project_id)
    )
    document_count = doc_count_result.scalar() or 0

    # Get latest job status
    latest_job_result = await db.execute(
        select(ProcessingJob.status)
        .where(ProcessingJob.project_id == project_id)
        .order_by(ProcessingJob.created_at.desc())
        .limit(1)
    )
    latest_job_status = latest_job_result.scalar_one_or_none()

    return ProjectWithStats(
        **ProjectResponse.model_validate(project).model_dump(),
        job_count=job_count,
        document_count=document_count,
        latest_job_status=latest_job_status.value if latest_job_status else None,
    )


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    db: DbSession,
    current_user: CurrentUser,
    project_id: int,
    project_in: ProjectUpdate,
) -> ProjectResponse:
    """Update a project."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise NotFoundError(message="Project not found")

    require_project_access(project.user_id, current_user)

    update_data = project_in.model_dump(exclude_unset=True)

    if "drive_folders" in update_data and update_data["drive_folders"] is not None:
        update_data["drive_folders"] = [
            f if isinstance(f, dict) else f.model_dump() for f in update_data["drive_folders"]
        ]

    for field, value in update_data.items():
        setattr(project, field, value)

    await db.flush()
    logger.info("Updated project", project_id=project.id)

    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", response_model=MessageResponse)
async def delete_project(
    db: DbSession,
    current_user: CurrentUser,
    project_id: int,
) -> MessageResponse:
    """Delete a project (soft delete by archiving)."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise NotFoundError(message="Project not found")

    require_project_access(project.user_id, current_user)

    # Soft delete by setting status to archived
    project.status = ProjectStatus.ARCHIVED

    logger.info("Archived project", project_id=project.id)
    return MessageResponse(message="Project archived successfully")


@router.post("/{project_id}/restore", response_model=ProjectResponse)
async def restore_project(
    db: DbSession,
    current_user: CurrentUser,
    project_id: int,
) -> ProjectResponse:
    """Restore an archived project back to active status."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise NotFoundError(message="Project not found")

    require_project_access(project.user_id, current_user)

    if project.status != ProjectStatus.ARCHIVED:
        raise ValidationError(message="Only archived projects can be restored")

    project.status = ProjectStatus.ACTIVE

    await db.flush()
    logger.info("Restored project", project_id=project.id)

    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}/permanent", response_model=MessageResponse)
async def permanently_delete_project(
    db: DbSession,
    current_user: CurrentUser,
    project_id: int,
) -> MessageResponse:
    """Permanently delete a project and all associated data."""
    from sqlalchemy import delete

    from app.models.document import DocumentSection

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise NotFoundError(message="Project not found")

    require_project_access(project.user_id, current_user)

    project_name = project.name

    doc_ids_result = await db.execute(select(Document.id).where(Document.project_id == project_id))
    doc_ids = [row[0] for row in doc_ids_result.fetchall()]

    if doc_ids:
        await db.execute(delete(DocumentSection).where(DocumentSection.document_id.in_(doc_ids)))

    await db.execute(delete(Document).where(Document.project_id == project_id))
    await db.execute(delete(ProcessingJob).where(ProcessingJob.project_id == project_id))
    await db.delete(project)
    await db.flush()

    logger.info("Permanently deleted project", project_id=project_id, project_name=project_name)
    return MessageResponse(message="Project permanently deleted")
