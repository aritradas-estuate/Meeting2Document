"""
Pydantic schemas for request/response validation.
"""

from app.schemas.auth import AuthResponse, GoogleAuthRequest, GoogleAuthURL, TokenResponse
from app.schemas.base import ErrorResponse, MessageResponse, PaginatedResponse
from app.schemas.document import (
    DocumentCreate,
    DocumentExport,
    DocumentExportResponse,
    DocumentResponse,
    DocumentSectionCreate,
    DocumentSectionResponse,
    DocumentSectionUpdate,
    DocumentSectionWithHistory,
    DocumentUpdate,
    DocumentWithSections,
)
from app.schemas.drive import (
    DriveBreadcrumb,
    DriveFileDownload,
    DriveItem,
    DriveListRequest,
    DriveListResponse,
    DriveNavigationResponse,
    SharedDrive,
    SharedDriveListResponse,
)
from app.schemas.job import (
    DriveFile,
    JobCreate,
    JobProgress,
    JobResponse,
    JobUpdate,
    JobWithResults,
)
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    ProjectWithStats,
)
from app.schemas.user import UserCreate, UserResponse, UserWithTokens

__all__ = [
    # Auth
    "TokenResponse",
    "AuthResponse",
    "GoogleAuthRequest",
    "GoogleAuthURL",
    # Base
    "ErrorResponse",
    "MessageResponse",
    "PaginatedResponse",
    # User
    "UserCreate",
    "UserResponse",
    "UserWithTokens",
    # Project
    "ProjectCreate",
    "ProjectResponse",
    "ProjectUpdate",
    "ProjectWithStats",
    # Job
    "DriveFile",
    "JobCreate",
    "JobUpdate",
    "JobResponse",
    "JobProgress",
    "JobWithResults",
    # Document
    "DocumentCreate",
    "DocumentUpdate",
    "DocumentResponse",
    "DocumentWithSections",
    "DocumentSectionCreate",
    "DocumentSectionUpdate",
    "DocumentSectionResponse",
    "DocumentSectionWithHistory",
    "DocumentExport",
    "DocumentExportResponse",
    # Drive
    "DriveItem",
    "DriveListRequest",
    "DriveListResponse",
    "SharedDrive",
    "SharedDriveListResponse",
    "DriveFileDownload",
    "DriveBreadcrumb",
    "DriveNavigationResponse",
]
