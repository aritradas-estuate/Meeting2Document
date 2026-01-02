"""
Google Drive-related Pydantic schemas.
"""

from datetime import datetime

from pydantic import Field

from app.schemas.base import BaseSchema


class DriveItem(BaseSchema):
    """Schema for a Google Drive file or folder."""

    id: str
    name: str
    mime_type: str
    size: int | None = None
    created_time: datetime | None = None
    modified_time: datetime | None = None
    web_view_link: str | None = None
    icon_link: str | None = None
    thumbnail_link: str | None = None
    parents: list[str] | None = None
    is_folder: bool = False


class DriveListRequest(BaseSchema):
    """Request to list Drive files/folders."""

    folder_id: str | None = Field(default=None, description="Folder ID to list contents of")
    drive_id: str | None = Field(default=None, description="Shared Drive ID")
    query: str | None = Field(default=None, description="Search query")
    page_token: str | None = None
    page_size: int = Field(default=50, ge=1, le=100)


class DriveListResponse(BaseSchema):
    """Response from listing Drive files/folders."""

    items: list[DriveItem]
    next_page_token: str | None = None


class SharedDrive(BaseSchema):
    """Schema for a Shared Drive."""

    id: str
    name: str
    color_rgb: str | None = None
    background_image_link: str | None = None


class SharedDriveListResponse(BaseSchema):
    """Response from listing Shared Drives."""

    drives: list[SharedDrive]
    next_page_token: str | None = None


class DriveFileDownload(BaseSchema):
    """Request to download a Drive file."""

    file_id: str
    export_format: str | None = Field(
        default=None, description="For Google Workspace files, the export format"
    )


class DriveBreadcrumb(BaseSchema):
    """Breadcrumb item for folder navigation."""

    id: str
    name: str


class DriveNavigationResponse(BaseSchema):
    """Response with items and navigation breadcrumbs."""

    items: list[DriveItem]
    breadcrumbs: list[DriveBreadcrumb]
    current_folder: DriveItem | None = None
    next_page_token: str | None = None


class DriveUploadRequest(BaseSchema):
    """Request to upload content to Google Drive."""

    filename: str = Field(..., description="Name for the file in Drive")
    content: str = Field(..., description="File content (base64 encoded for binary)")
    mime_type: str = Field(default="text/markdown", description="MIME type of the content")
    folder_id: str | None = Field(default=None, description="Folder ID to upload to")
    drive_id: str | None = Field(default=None, description="Shared Drive ID")


class DriveUploadResponse(BaseSchema):
    """Response from uploading a file to Drive."""

    id: str
    name: str
    mime_type: str
    web_view_link: str | None = None
    size: int | None = None
