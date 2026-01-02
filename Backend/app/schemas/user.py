"""
User-related Pydantic schemas.
"""

from datetime import datetime

from pydantic import EmailStr

from app.schemas.base import BaseSchema, TimestampMixin


class UserBase(BaseSchema):
    """Base user schema."""

    email: EmailStr
    name: str
    picture_url: str | None = None


class UserCreate(UserBase):
    """Schema for creating a user (internal use only, via OAuth)."""

    google_id: str


class UserResponse(UserBase, TimestampMixin):
    """User response schema."""

    id: int


class UserWithTokens(UserResponse):
    """User response with OAuth tokens (internal use)."""

    access_token: str | None = None
    refresh_token: str | None = None
    token_expires_at: datetime | None = None
