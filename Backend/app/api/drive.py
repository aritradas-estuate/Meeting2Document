"""
Google Drive API endpoints for browsing and file selection.
"""

from datetime import datetime, timezone

from fastapi import APIRouter
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.api.deps import CurrentUser, DbSession
from app.config import settings
from app.core.exceptions import DriveAccessError
from app.core.logging import get_logger
from app.schemas.drive import (
    DriveBreadcrumb,
    DriveItem,
    DriveListRequest,
    DriveListResponse,
    DriveNavigationResponse,
    DriveUploadRequest,
    DriveUploadResponse,
    SharedDrive,
    SharedDriveListResponse,
)
from app.services.drive_service import DriveService

logger = get_logger(__name__)

router = APIRouter()


def get_drive_service(user):
    """Create a Google Drive service instance for the user."""
    if not user.access_token:
        raise DriveAccessError(message="No Google Drive access token available")

    credentials = Credentials(
        token=user.access_token,
        refresh_token=user.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )

    # Check if token needs refresh
    if user.token_expires_at and user.token_expires_at < datetime.now(timezone.utc):
        # Token is expired, need to refresh
        # Note: In production, implement token refresh logic here
        logger.warning("Access token expired for user", user_id=user.id)

    return build("drive", "v3", credentials=credentials)


def parse_drive_item(item: dict) -> DriveItem:
    """Parse a Google Drive API response item into our schema."""
    mime_type = item.get("mimeType", "")
    is_folder = mime_type == "application/vnd.google-apps.folder"

    return DriveItem(
        id=item["id"],
        name=item["name"],
        mime_type=mime_type,
        size=int(item.get("size", 0)) if item.get("size") else None,
        created_time=item.get("createdTime"),
        modified_time=item.get("modifiedTime"),
        web_view_link=item.get("webViewLink"),
        icon_link=item.get("iconLink"),
        thumbnail_link=item.get("thumbnailLink"),
        parents=item.get("parents"),
        is_folder=is_folder,
    )


@router.get("/shared-drives", response_model=SharedDriveListResponse)
async def list_shared_drives(
    current_user: CurrentUser,
    page_token: str | None = None,
    page_size: int = 50,
) -> SharedDriveListResponse:
    """List all Shared Drives the user has access to."""
    try:
        service = get_drive_service(current_user)

        results = (
            service.drives()
            .list(
                pageSize=min(page_size, 100),
                pageToken=page_token,
                fields="nextPageToken,drives(id,name,colorRgb,backgroundImageLink)",
            )
            .execute()
        )

        drives = [
            SharedDrive(
                id=d["id"],
                name=d["name"],
                color_rgb=d.get("colorRgb"),
                background_image_link=d.get("backgroundImageLink"),
            )
            for d in results.get("drives", [])
        ]

        return SharedDriveListResponse(
            drives=drives,
            next_page_token=results.get("nextPageToken"),
        )

    except Exception as e:
        logger.exception("Failed to list shared drives", error=str(e))
        raise DriveAccessError(
            message="Failed to list shared drives",
            details={"error": str(e)},
        )


@router.get("/files", response_model=DriveListResponse)
async def list_files(
    current_user: CurrentUser,
    folder_id: str | None = None,
    drive_id: str | None = None,
    query: str | None = None,
    page_token: str | None = None,
    page_size: int = 50,
) -> DriveListResponse:
    """
    List files and folders in Google Drive.

    Args:
        folder_id: ID of folder to list contents of (default: root)
        drive_id: ID of Shared Drive to search in
        query: Optional search query
        page_token: Token for pagination
        page_size: Number of results per page
    """
    try:
        service = get_drive_service(current_user)

        # Build query
        q_parts = ["trashed = false"]

        if folder_id:
            q_parts.append(f"'{folder_id}' in parents")
        elif not query:
            # If no folder and no search, show root
            q_parts.append("'root' in parents")

        if query:
            q_parts.append(f"name contains '{query}'")

        # Filter for supported file types (videos and common document types)
        file_types = [
            "mimeType = 'application/vnd.google-apps.folder'",
            "mimeType contains 'video/'",
            "mimeType = 'application/pdf'",
            "mimeType = 'application/vnd.google-apps.document'",
            "mimeType contains 'spreadsheet'",
            "mimeType contains 'presentation'",
        ]
        q_parts.append(f"({' or '.join(file_types)})")

        q = " and ".join(q_parts)

        # Build API request
        request_params = {
            "q": q,
            "pageSize": min(page_size, 100),
            "fields": "nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,iconLink,thumbnailLink,parents)",
            "orderBy": "folder,name",
        }

        if page_token:
            request_params["pageToken"] = page_token

        if drive_id:
            request_params["driveId"] = drive_id
            request_params["corpora"] = "drive"
            request_params["includeItemsFromAllDrives"] = True
            request_params["supportsAllDrives"] = True

        results = service.files().list(**request_params).execute()

        items = [parse_drive_item(f) for f in results.get("files", [])]

        return DriveListResponse(
            items=items,
            next_page_token=results.get("nextPageToken"),
        )

    except DriveAccessError:
        raise
    except Exception as e:
        logger.exception("Failed to list files", error=str(e))
        raise DriveAccessError(
            message="Failed to list files",
            details={"error": str(e)},
        )


@router.get("/navigate/{folder_id}", response_model=DriveNavigationResponse)
async def navigate_folder(
    current_user: CurrentUser,
    folder_id: str,
    drive_id: str | None = None,
    page_token: str | None = None,
    page_size: int = 50,
) -> DriveNavigationResponse:
    """
    Navigate to a folder and get its contents with breadcrumbs.

    This endpoint returns both the folder contents and the navigation path
    (breadcrumbs) to help with UI navigation.
    """
    try:
        service = get_drive_service(current_user)

        # Get current folder info
        folder_params: dict[str, str | bool] = {"fileId": folder_id, "fields": "id,name,parents"}
        if drive_id:
            folder_params["supportsAllDrives"] = True

        current_folder_data = service.files().get(**folder_params).execute()
        current_folder = DriveItem(
            id=current_folder_data["id"],
            name=current_folder_data["name"],
            mime_type="application/vnd.google-apps.folder",
            is_folder=True,
        )

        # Build breadcrumbs by traversing up the folder hierarchy
        breadcrumbs = []
        parent_id = (
            current_folder_data.get("parents", [None])[0]
            if current_folder_data.get("parents")
            else None
        )

        while parent_id:
            try:
                parent_params = {"fileId": parent_id, "fields": "id,name,parents"}
                if drive_id:
                    parent_params["supportsAllDrives"] = True

                parent = service.files().get(**parent_params).execute()
                breadcrumbs.insert(0, DriveBreadcrumb(id=parent["id"], name=parent["name"]))
                parent_id = parent.get("parents", [None])[0] if parent.get("parents") else None
            except Exception:
                # Stop if we can't get parent (e.g., root of shared drive)
                break

        # Add current folder to breadcrumbs
        breadcrumbs.append(DriveBreadcrumb(id=folder_id, name=current_folder.name))

        # Get folder contents
        files_response = await list_files(
            current_user=current_user,
            folder_id=folder_id,
            drive_id=drive_id,
            page_token=page_token,
            page_size=page_size,
        )

        return DriveNavigationResponse(
            items=files_response.items,
            breadcrumbs=breadcrumbs,
            current_folder=current_folder,
            next_page_token=files_response.next_page_token,
        )

    except DriveAccessError:
        raise
    except Exception as e:
        logger.exception("Failed to navigate folder", error=str(e), folder_id=folder_id)
        raise DriveAccessError(
            message="Failed to navigate folder",
            details={"error": str(e)},
        )


@router.get("/file/{file_id}")
async def get_file_info(
    current_user: CurrentUser,
    file_id: str,
    drive_id: str | None = None,
) -> DriveItem:
    """Get detailed information about a specific file."""
    try:
        service = get_drive_service(current_user)

        params: dict[str, str | bool] = {
            "fileId": file_id,
            "fields": "id,name,mimeType,size,createdTime,modifiedTime,webViewLink,iconLink,thumbnailLink,parents",
        }
        if drive_id:
            params["supportsAllDrives"] = True

        file_data = service.files().get(**params).execute()

        return parse_drive_item(file_data)

    except Exception as e:
        logger.exception("Failed to get file info", error=str(e), file_id=file_id)
        raise DriveAccessError(
            message="Failed to get file info",
            details={"error": str(e)},
        )


@router.post("/upload", response_model=DriveUploadResponse)
async def upload_file(
    current_user: CurrentUser,
    db: DbSession,
    request: DriveUploadRequest,
) -> DriveUploadResponse:
    """
    Upload content to Google Drive.

    This endpoint accepts content and uploads it to the specified location
    in Google Drive. Commonly used for uploading generated documents.
    """
    try:
        drive_service = DriveService(current_user, db)

        result = await drive_service.upload_content(
            content=request.content,
            filename=request.filename,
            mime_type=request.mime_type,
            folder_id=request.folder_id,
            drive_id=request.drive_id,
        )

        return DriveUploadResponse(
            id=result["id"],
            name=result["name"],
            mime_type=result.get("mimeType", request.mime_type),
            web_view_link=result.get("webViewLink"),
            size=int(result["size"]) if result.get("size") else None,
        )

    except DriveAccessError:
        raise
    except Exception as e:
        logger.exception("Failed to upload file", error=str(e))
        raise DriveAccessError(
            message="Failed to upload file",
            details={"error": str(e)},
        )
