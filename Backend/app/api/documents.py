"""
Document management API endpoints.
"""

from fastapi import APIRouter
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession, Pagination, require_project_access
from app.core.exceptions import NotFoundError, ValidationError
from app.core.logging import get_logger
from app.models.document import Document, DocumentSection, DocumentStatus
from app.models.project import Project
from app.schemas.base import MessageResponse, PaginatedResponse
from app.schemas.document import (
    DocumentCreate,
    DocumentExport,
    DocumentExportResponse,
    DocumentResponse,
    DocumentSectionResponse,
    DocumentSectionUpdate,
    DocumentSectionWithHistory,
    DocumentUpdate,
    DocumentWithSections,
)

logger = get_logger(__name__)

router = APIRouter()


@router.post("", response_model=DocumentResponse, status_code=201)
async def create_document(
    db: DbSession,
    current_user: CurrentUser,
    doc_in: DocumentCreate,
) -> DocumentResponse:
    """Create a new document."""
    # Verify project access
    result = await db.execute(select(Project).where(Project.id == doc_in.project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise NotFoundError(message="Project not found")

    require_project_access(project.user_id, current_user)

    document = Document(
        project_id=doc_in.project_id,
        job_id=doc_in.job_id,
        title=doc_in.title,
        schema_type=doc_in.schema_type,
        content=doc_in.content,
        markdown_content=doc_in.markdown_content,
    )
    db.add(document)
    await db.flush()

    logger.info("Created document", document_id=document.id, project_id=project.id)
    return DocumentResponse.model_validate(document)


@router.get("", response_model=PaginatedResponse[DocumentResponse])
async def list_documents(
    db: DbSession,
    current_user: CurrentUser,
    pagination: Pagination,
    project_id: int | None = None,
    status: DocumentStatus | None = None,
) -> PaginatedResponse[DocumentResponse]:
    """List all documents for the current user's projects."""
    query = select(Document).join(Project).where(Project.user_id == current_user.id)

    if project_id:
        query = query.filter(Document.project_id == project_id)

    if status:
        query = query.filter(Document.status == status)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(Document.updated_at.desc())
    query = query.offset(pagination.offset).limit(pagination.page_size)

    result = await db.execute(query)
    documents = result.scalars().all()

    return PaginatedResponse(
        items=[DocumentResponse.model_validate(d) for d in documents],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + pagination.page_size - 1) // pagination.page_size,
    )


@router.get("/{document_id}", response_model=DocumentWithSections)
async def get_document(
    db: DbSession,
    current_user: CurrentUser,
    document_id: int,
) -> DocumentWithSections:
    """Get a document with all its sections."""
    result = await db.execute(select(Document).join(Project).where(Document.id == document_id))
    document = result.scalar_one_or_none()

    if not document:
        raise NotFoundError(message="Document not found")

    require_project_access(document.project.user_id, current_user)

    # Load sections
    sections_result = await db.execute(
        select(DocumentSection)
        .where(DocumentSection.document_id == document_id)
        .order_by(DocumentSection.id)
    )
    sections = sections_result.scalars().all()

    return DocumentWithSections(
        **DocumentResponse.model_validate(document).model_dump(),
        sections=[DocumentSectionResponse.model_validate(s) for s in sections],
    )


@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    db: DbSession,
    current_user: CurrentUser,
    document_id: int,
    doc_in: DocumentUpdate,
) -> DocumentResponse:
    """Update a document."""
    result = await db.execute(select(Document).join(Project).where(Document.id == document_id))
    document = result.scalar_one_or_none()

    if not document:
        raise NotFoundError(message="Document not found")

    require_project_access(document.project.user_id, current_user)

    # Update fields
    update_data = doc_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(document, field, value)

    # Increment version if content changed
    if "content" in update_data or "markdown_content" in update_data:
        document.version += 1

    await db.flush()
    logger.info("Updated document", document_id=document.id)

    return DocumentResponse.model_validate(document)


@router.delete("/{document_id}", response_model=MessageResponse)
async def delete_document(
    db: DbSession,
    current_user: CurrentUser,
    document_id: int,
) -> MessageResponse:
    """Delete a document."""
    result = await db.execute(select(Document).join(Project).where(Document.id == document_id))
    document = result.scalar_one_or_none()

    if not document:
        raise NotFoundError(message="Document not found")

    require_project_access(document.project.user_id, current_user)

    await db.delete(document)
    logger.info("Deleted document", document_id=document_id)

    return MessageResponse(message="Document deleted successfully")


# Section endpoints


@router.get("/{document_id}/sections/{section_id}", response_model=DocumentSectionWithHistory)
async def get_section(
    db: DbSession,
    current_user: CurrentUser,
    document_id: int,
    section_id: int,
) -> DocumentSectionWithHistory:
    """Get a specific document section with its generation history."""
    result = await db.execute(
        select(DocumentSection)
        .join(Document)
        .join(Project)
        .where(DocumentSection.id == section_id)
        .where(DocumentSection.document_id == document_id)
    )
    section = result.scalar_one_or_none()

    if not section:
        raise NotFoundError(message="Section not found")

    require_project_access(section.document.project.user_id, current_user)

    return DocumentSectionWithHistory.model_validate(section)


@router.patch("/{document_id}/sections/{section_id}", response_model=DocumentSectionResponse)
async def update_section(
    db: DbSession,
    current_user: CurrentUser,
    document_id: int,
    section_id: int,
    section_in: DocumentSectionUpdate,
) -> DocumentSectionResponse:
    """Update a document section."""
    result = await db.execute(
        select(DocumentSection)
        .join(Document)
        .join(Project)
        .where(DocumentSection.id == section_id)
        .where(DocumentSection.document_id == document_id)
    )
    section = result.scalar_one_or_none()

    if not section:
        raise NotFoundError(message="Section not found")

    require_project_access(section.document.project.user_id, current_user)

    # Update fields
    update_data = section_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(section, field, value)

    await db.flush()
    logger.info("Updated section", section_id=section.id, document_id=document_id)

    return DocumentSectionResponse.model_validate(section)


# Export endpoints


@router.post("/{document_id}/export", response_model=DocumentExportResponse)
async def export_document(
    db: DbSession,
    current_user: CurrentUser,
    document_id: int,
    export_request: DocumentExport,
) -> DocumentExportResponse:
    """Export a document to the specified format."""
    result = await db.execute(select(Document).join(Project).where(Document.id == document_id))
    document = result.scalar_one_or_none()

    if not document:
        raise NotFoundError(message="Document not found")

    require_project_access(document.project.user_id, current_user)

    if export_request.format == "markdown":
        # Return markdown content directly
        if not document.markdown_content:
            raise ValidationError(message="Document has no markdown content")

        return DocumentExportResponse(
            format="markdown",
            content=document.markdown_content,
        )

    elif export_request.format == "google_doc":
        # TODO: Implement Google Docs export
        # This would:
        # 1. Convert markdown to Google Docs format
        # 2. Create a new Google Doc in the user's Drive
        # 3. Return the file ID and URL

        raise ValidationError(message="Google Docs export not yet implemented")

    else:
        raise ValidationError(message=f"Unsupported export format: {export_request.format}")
