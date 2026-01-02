"""
FastAPI dependency injection utilities.
"""

from typing import Annotated, AsyncGenerator

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AuthenticationError, AuthorizationError
from app.core.security import decode_access_token
from app.db.database import AsyncSessionLocal
from app.models.user import User


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Database session dependency.

    Yields an async database session and handles commit/rollback.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Type alias for database session dependency
DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DbSession,
    authorization: str | None = Header(default=None),
) -> User:
    """
    Extract and validate the current user from the Authorization header.

    Args:
        db: Database session
        authorization: Authorization header (Bearer token)

    Returns:
        The authenticated user

    Raises:
        AuthenticationError: If token is missing or invalid
    """
    if not authorization:
        raise AuthenticationError(message="Authorization header required")

    # Extract token from "Bearer <token>" format
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthenticationError(message="Invalid authorization header format")

    token = parts[1]

    # Decode and validate token
    payload = decode_access_token(token)

    # Get user ID from token
    user_id = payload.get("sub")
    if not user_id:
        raise AuthenticationError(message="Invalid token payload")

    # Fetch user from database
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise AuthenticationError(message="User not found")

    return user


# Type alias for current user dependency
CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_optional_user(
    db: DbSession,
    authorization: str | None = Header(default=None),
) -> User | None:
    """
    Optionally extract the current user (for endpoints that work with or without auth).

    Args:
        db: Database session
        authorization: Authorization header (Bearer token)

    Returns:
        The authenticated user or None if not authenticated
    """
    if not authorization:
        return None

    try:
        return await get_current_user(db, authorization)
    except AuthenticationError:
        return None


# Type alias for optional user dependency
OptionalUser = Annotated[User | None, Depends(get_optional_user)]


def require_project_access(project_user_id: int, current_user: User) -> None:
    """
    Verify the current user has access to a project.

    Args:
        project_user_id: The user ID that owns the project
        current_user: The current authenticated user

    Raises:
        AuthorizationError: If user doesn't have access
    """
    if project_user_id != current_user.id:
        raise AuthorizationError(message="You don't have access to this project")


class PaginationParams:
    """Pagination parameters for list endpoints."""

    def __init__(
        self,
        page: int = 1,
        page_size: int = 20,
    ):
        self.page = max(1, page)
        self.page_size = min(max(1, page_size), 100)  # Max 100 items per page
        self.offset = (self.page - 1) * self.page_size


# Type alias for pagination dependency
Pagination = Annotated[PaginationParams, Depends()]
