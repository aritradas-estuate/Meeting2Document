"""
Google Drive service for file operations.

This service handles downloading files for processing and uploading
generated documents back to Google Drive.
"""

import io
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, BinaryIO

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload, MediaIoBaseUpload
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import DriveAccessError
from app.core.logging import get_logger
from app.models.user import User

# Type alias for the Google Drive service (dynamically typed)
DriveServiceResource = Any

logger = get_logger(__name__)


class DriveService:
    """Service for interacting with Google Drive API."""

    def __init__(self, user: User, db: AsyncSession | None = None):
        """
        Initialize the Drive service for a user.

        Args:
            user: The user whose credentials will be used
            db: Optional database session for token refresh persistence
        """
        self.user = user
        self.db = db
        self._service: DriveServiceResource | None = None

    async def _get_credentials(self) -> Credentials:
        """Get valid credentials, refreshing if necessary."""
        if not self.user.access_token:
            raise DriveAccessError(message="No Google Drive access token available")

        # Google's Credentials class uses naive UTC datetimes internally,
        # so convert our timezone-aware datetime to naive UTC
        expiry = self.user.token_expires_at
        if expiry and expiry.tzinfo is not None:
            expiry = expiry.replace(tzinfo=None)

        credentials = Credentials(
            token=self.user.access_token,
            refresh_token=self.user.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            expiry=expiry,
        )

        # Check if token needs refresh
        if self._should_refresh_token(credentials):
            credentials = await self._refresh_credentials(credentials)

        return credentials

    def _should_refresh_token(self, credentials: Credentials) -> bool:
        """Check if the token should be refreshed."""
        if not credentials.expiry:
            return False

        # Refresh if token expires within 5 minutes
        buffer_time = timedelta(minutes=5)
        expiry_with_buffer = credentials.expiry - buffer_time

        # Handle timezone-aware vs naive datetime comparison
        now = datetime.now(timezone.utc)
        if credentials.expiry.tzinfo is None:
            expiry_with_buffer = expiry_with_buffer.replace(tzinfo=timezone.utc)

        return now >= expiry_with_buffer

    async def _refresh_credentials(self, credentials: Credentials) -> Credentials:
        """Refresh the OAuth credentials."""
        if not credentials.refresh_token:
            raise DriveAccessError(message="Cannot refresh token: no refresh token available")

        try:
            credentials.refresh(Request())

            # Update user tokens in database if session is available
            if self.db:
                self.user.access_token = credentials.token
                self.user.token_expires_at = credentials.expiry
                self.user.updated_at = datetime.now(timezone.utc)
                await self.db.flush()
                logger.info("Refreshed OAuth token for user", user_id=self.user.id)

            return credentials

        except Exception as e:
            logger.exception("Failed to refresh OAuth token", error=str(e))
            raise DriveAccessError(
                message="Failed to refresh authentication token",
                details={"error": str(e)},
            )

    async def get_service(self) -> DriveServiceResource:
        """Get the Google Drive API service instance."""
        if self._service is None:
            credentials = await self._get_credentials()
            self._service = build("drive", "v3", credentials=credentials)
        return self._service

    async def download_file_to_path(
        self,
        file_id: str,
        destination: Path | str,
        drive_id: str | None = None,
    ) -> Path:
        """
        Download a file from Google Drive to a local path.

        Args:
            file_id: The Google Drive file ID
            destination: Local path to save the file
            drive_id: Optional Shared Drive ID

        Returns:
            Path to the downloaded file
        """
        destination = Path(destination)
        destination.parent.mkdir(parents=True, exist_ok=True)

        service = await self.get_service()

        try:
            # Get file metadata first for logging
            file_params: dict = {"fileId": file_id, "fields": "name,size,mimeType"}
            if drive_id:
                file_params["supportsAllDrives"] = True

            file_metadata = service.files().get(**file_params).execute()
            logger.info(
                "Downloading file",
                file_id=file_id,
                name=file_metadata.get("name"),
                size=file_metadata.get("size"),
            )

            # Download the file
            request = service.files().get_media(fileId=file_id)
            if drive_id:
                request = service.files().get_media(fileId=file_id, supportsAllDrives=True)

            with open(destination, "wb") as f:
                downloader = MediaIoBaseDownload(f, request)
                done = False
                while not done:
                    status, done = downloader.next_chunk()
                    if status:
                        logger.debug(
                            "Download progress",
                            file_id=file_id,
                            progress=f"{int(status.progress() * 100)}%",
                        )

            logger.info("File downloaded successfully", file_id=file_id, path=str(destination))
            return destination

        except Exception as e:
            logger.exception("Failed to download file", file_id=file_id, error=str(e))
            raise DriveAccessError(
                message=f"Failed to download file: {file_id}",
                details={"error": str(e)},
            )

    async def download_file_to_memory(
        self,
        file_id: str,
        drive_id: str | None = None,
    ) -> tuple[bytes, dict]:
        """
        Download a file from Google Drive into memory.

        Args:
            file_id: The Google Drive file ID
            drive_id: Optional Shared Drive ID

        Returns:
            Tuple of (file_content_bytes, file_metadata)
        """
        service = await self.get_service()

        try:
            # Get file metadata
            file_params: dict = {"fileId": file_id, "fields": "name,size,mimeType"}
            if drive_id:
                file_params["supportsAllDrives"] = True

            file_metadata = service.files().get(**file_params).execute()

            # Download to memory
            request = service.files().get_media(fileId=file_id)
            if drive_id:
                request = service.files().get_media(fileId=file_id, supportsAllDrives=True)

            buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(buffer, request)
            done = False
            while not done:
                status, done = downloader.next_chunk()

            buffer.seek(0)
            return buffer.read(), file_metadata

        except Exception as e:
            logger.exception("Failed to download file to memory", file_id=file_id, error=str(e))
            raise DriveAccessError(
                message=f"Failed to download file: {file_id}",
                details={"error": str(e)},
            )

    async def download_file_to_temp(
        self,
        file_id: str,
        drive_id: str | None = None,
        suffix: str | None = None,
    ) -> tuple[Path, dict]:
        """
        Download a file to a temporary location.

        Args:
            file_id: The Google Drive file ID
            drive_id: Optional Shared Drive ID
            suffix: Optional file suffix (e.g., '.mp4')

        Returns:
            Tuple of (temp_file_path, file_metadata)
        """
        service = await self.get_service()

        # Get file metadata for name/extension
        file_params: dict = {"fileId": file_id, "fields": "name,size,mimeType"}
        if drive_id:
            file_params["supportsAllDrives"] = True

        file_metadata = service.files().get(**file_params).execute()

        # Determine suffix from filename if not provided
        if suffix is None:
            name = file_metadata.get("name", "")
            if "." in name:
                suffix = "." + name.rsplit(".", 1)[1]

        # Create temp file
        temp_dir = Path(settings.temp_file_dir)
        temp_dir.mkdir(parents=True, exist_ok=True)

        temp_file = tempfile.NamedTemporaryFile(
            dir=temp_dir,
            suffix=suffix,
            delete=False,
        )
        temp_path = Path(temp_file.name)
        temp_file.close()

        # Download to temp file
        await self.download_file_to_path(file_id, temp_path, drive_id)

        return temp_path, file_metadata

    async def upload_file(
        self,
        file_path: Path | str,
        filename: str,
        folder_id: str | None = None,
        drive_id: str | None = None,
        mime_type: str | None = None,
    ) -> dict:
        """
        Upload a file to Google Drive.

        Args:
            file_path: Local path to the file to upload
            filename: Name for the file in Drive
            folder_id: Optional folder ID to upload to
            drive_id: Optional Shared Drive ID
            mime_type: Optional MIME type (auto-detected if not provided)

        Returns:
            Dictionary with file metadata including id, name, webViewLink
        """
        file_path = Path(file_path)

        if not file_path.exists():
            raise DriveAccessError(message=f"File not found: {file_path}")

        service = await self.get_service()

        try:
            # Prepare file metadata
            file_metadata: dict = {"name": filename}

            if folder_id:
                file_metadata["parents"] = [folder_id]

            # Create media upload
            media = MediaFileUpload(
                str(file_path),
                mimetype=mime_type,
                resumable=True,
            )

            # Upload parameters
            create_params: dict = {
                "body": file_metadata,
                "media_body": media,
                "fields": "id,name,mimeType,webViewLink,size",
            }

            if drive_id:
                create_params["supportsAllDrives"] = True
                file_metadata["parents"] = [folder_id or drive_id]

            # Execute upload
            result = service.files().create(**create_params).execute()

            logger.info(
                "File uploaded successfully",
                file_id=result.get("id"),
                name=result.get("name"),
            )

            return result

        except Exception as e:
            logger.exception("Failed to upload file", filename=filename, error=str(e))
            raise DriveAccessError(
                message=f"Failed to upload file: {filename}",
                details={"error": str(e)},
            )

    async def upload_content(
        self,
        content: bytes | str | BinaryIO,
        filename: str,
        mime_type: str,
        folder_id: str | None = None,
        drive_id: str | None = None,
    ) -> dict:
        """
        Upload content directly to Google Drive without a local file.

        Args:
            content: The content to upload (bytes, string, or file-like object)
            filename: Name for the file in Drive
            mime_type: MIME type of the content
            folder_id: Optional folder ID to upload to
            drive_id: Optional Shared Drive ID

        Returns:
            Dictionary with file metadata including id, name, webViewLink
        """
        service = await self.get_service()

        try:
            # Convert content to BytesIO if needed
            if isinstance(content, str):
                buffer = io.BytesIO(content.encode("utf-8"))
            elif isinstance(content, bytes):
                buffer = io.BytesIO(content)
            else:
                buffer = content

            # Prepare file metadata
            file_metadata: dict = {"name": filename}

            if folder_id:
                file_metadata["parents"] = [folder_id]

            # Create media upload from buffer
            media = MediaIoBaseUpload(
                buffer,
                mimetype=mime_type,
                resumable=True,
            )

            # Upload parameters
            create_params: dict = {
                "body": file_metadata,
                "media_body": media,
                "fields": "id,name,mimeType,webViewLink,size",
            }

            if drive_id:
                create_params["supportsAllDrives"] = True
                file_metadata["parents"] = [folder_id or drive_id]

            # Execute upload
            result = service.files().create(**create_params).execute()

            logger.info(
                "Content uploaded successfully",
                file_id=result.get("id"),
                name=result.get("name"),
            )

            return result

        except Exception as e:
            logger.exception("Failed to upload content", filename=filename, error=str(e))
            raise DriveAccessError(
                message=f"Failed to upload content: {filename}",
                details={"error": str(e)},
            )

    async def get_file_metadata(
        self,
        file_id: str,
        drive_id: str | None = None,
    ) -> dict:
        service = await self.get_service()

        params: dict = {
            "fileId": file_id,
            "fields": "id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents",
        }

        if drive_id:
            params["supportsAllDrives"] = True

        return service.files().get(**params).execute()

    async def make_file_public(self, file_id: str) -> str:
        service = await self.get_service()

        try:
            permission = {
                "type": "anyone",
                "role": "reader",
            }

            service.permissions().create(
                fileId=file_id,
                body=permission,
                supportsAllDrives=True,
            ).execute()

            download_url = f"https://drive.google.com/u/0/uc?id={file_id}&export=download"

            logger.info("Made file temporarily public", file_id=file_id)
            return download_url

        except Exception as e:
            logger.exception("Failed to make file public", file_id=file_id, error=str(e))
            raise DriveAccessError(
                message=f"Failed to make file public: {file_id}",
                details={"error": str(e)},
            )

    async def revoke_public_access(self, file_id: str) -> None:
        service = await self.get_service()

        try:
            permissions = (
                service.permissions()
                .list(
                    fileId=file_id,
                    supportsAllDrives=True,
                )
                .execute()
            )

            for perm in permissions.get("permissions", []):
                if perm.get("type") == "anyone":
                    service.permissions().delete(
                        fileId=file_id,
                        permissionId=perm["id"],
                        supportsAllDrives=True,
                    ).execute()
                    logger.info("Revoked public access", file_id=file_id, permission_id=perm["id"])

        except Exception as e:
            logger.exception("Failed to revoke public access", file_id=file_id, error=str(e))
            raise DriveAccessError(
                message=f"Failed to revoke public access: {file_id}",
                details={"error": str(e)},
            )


async def get_drive_service(user: User, db: AsyncSession | None = None) -> DriveService:
    """
    Factory function to create a DriveService instance.

    Args:
        user: The user whose credentials will be used
        db: Optional database session for token refresh persistence

    Returns:
        Configured DriveService instance
    """
    return DriveService(user, db)
