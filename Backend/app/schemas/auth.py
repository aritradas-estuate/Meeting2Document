"""
Authentication-related Pydantic schemas.
"""

from pydantic import BaseModel

from app.schemas.user import UserResponse


class TokenResponse(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthResponse(BaseModel):
    """Full authentication response with user and token."""

    user: UserResponse
    token: TokenResponse


class GoogleAuthRequest(BaseModel):
    """Google OAuth authorization code exchange request."""

    code: str
    redirect_uri: str | None = None


class GoogleAuthURL(BaseModel):
    """Google OAuth authorization URL response."""

    authorization_url: str
