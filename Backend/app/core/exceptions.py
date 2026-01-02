"""
Custom exception classes for the application.
"""

from typing import Any, Optional


class AppException(Exception):
    """Base exception for application errors."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: Optional[dict[str, Any]] = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(AppException):
    """Raised when authentication fails."""

    def __init__(self, message: str = "Authentication failed", details: Optional[dict] = None):
        super().__init__(
            message=message,
            code="AUTHENTICATION_ERROR",
            status_code=401,
            details=details,
        )


class AuthorizationError(AppException):
    """Raised when user is not authorized to perform an action."""

    def __init__(self, message: str = "Not authorized", details: Optional[dict] = None):
        super().__init__(
            message=message,
            code="AUTHORIZATION_ERROR",
            status_code=403,
            details=details,
        )


class NotFoundError(AppException):
    """Raised when a resource is not found."""

    def __init__(self, message: str = "Resource not found", details: Optional[dict] = None):
        super().__init__(
            message=message,
            code="NOT_FOUND",
            status_code=404,
            details=details,
        )


class ValidationError(AppException):
    """Raised when validation fails."""

    def __init__(self, message: str = "Validation failed", details: Optional[dict] = None):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=400,
            details=details,
        )


class DriveAccessError(AppException):
    """Raised when Google Drive access fails."""

    def __init__(self, message: str = "Google Drive access failed", details: Optional[dict] = None):
        super().__init__(
            message=message,
            code="DRIVE_ACCESS_ERROR",
            status_code=502,
            details=details,
        )


class ProcessingError(AppException):
    """Raised when document processing fails."""

    def __init__(self, message: str = "Processing failed", details: Optional[dict] = None):
        super().__init__(
            message=message,
            code="PROCESSING_ERROR",
            status_code=500,
            details=details,
        )


class AIServiceError(AppException):
    """Raised when an AI service call fails."""

    def __init__(
        self,
        message: str = "AI service error",
        service: str = "unknown",
        details: Optional[dict] = None,
    ):
        super().__init__(
            message=message,
            code="AI_SERVICE_ERROR",
            status_code=502,
            details={"service": service, **(details or {})},
        )


class RateLimitError(AppException):
    """Raised when rate limit is exceeded."""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: Optional[int] = None,
        details: Optional[dict] = None,
    ):
        super().__init__(
            message=message,
            code="RATE_LIMIT_EXCEEDED",
            status_code=429,
            details={"retry_after": retry_after, **(details or {})},
        )
