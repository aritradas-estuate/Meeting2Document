"""
Authentication API endpoints.
"""

from datetime import datetime, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Request
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from google_auth_oauthlib.flow import Flow
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.config import settings
from app.core.exceptions import AuthenticationError
from app.core.logging import get_logger
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.auth import AuthResponse, GoogleAuthRequest, GoogleAuthURL, TokenResponse
from app.schemas.user import UserResponse

logger = get_logger(__name__)

router = APIRouter()

# Google OAuth scopes required for the application
GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/drive.readonly",  # Read files from Drive
    "https://www.googleapis.com/auth/drive.file",  # Create/edit files created by app
]


def get_google_flow(redirect_uri: str | None = None) -> Flow:
    """Create a Google OAuth flow instance."""
    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_redirect_uri],
        }
    }

    flow = Flow.from_client_config(
        client_config,
        scopes=GOOGLE_SCOPES,
        redirect_uri=redirect_uri or settings.google_redirect_uri,
    )

    return flow


@router.get("/google/url", response_model=GoogleAuthURL)
async def get_google_auth_url(redirect_uri: str | None = None) -> GoogleAuthURL:
    """
    Get the Google OAuth authorization URL.

    The frontend should redirect the user to this URL to start the OAuth flow.
    """
    flow = get_google_flow(redirect_uri)

    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )

    logger.info("Generated Google OAuth URL")
    return GoogleAuthURL(authorization_url=authorization_url)


@router.post("/google/callback", response_model=AuthResponse)
async def google_callback(
    db: DbSession,
    request: GoogleAuthRequest,
) -> AuthResponse:
    """
    Handle Google OAuth callback.

    Exchange the authorization code for tokens, create/update user, and return JWT.
    """
    try:
        flow = get_google_flow(request.redirect_uri)

        # Exchange authorization code for tokens
        flow.fetch_token(code=request.code)
        credentials = flow.credentials

        # Verify the ID token and get user info
        # Note: credentials._id_token is the raw ID token from the OAuth flow
        raw_id_token = getattr(credentials, "_id_token", None) or getattr(
            credentials, "id_token", None
        )
        if not raw_id_token:
            raise AuthenticationError(message="No ID token received from Google")

        id_info = id_token.verify_oauth2_token(
            raw_id_token,
            google_requests.Request(),
            settings.google_client_id,
        )

        # Extract user info
        google_id = id_info["sub"]
        email = id_info["email"]
        name = id_info.get("name", email.split("@")[0])
        picture_url = id_info.get("picture")

        # Find or create user
        result = await db.execute(select(User).where(User.google_id == google_id))
        user = result.scalar_one_or_none()

        if user:
            # Update existing user
            user.email = email
            user.name = name
            user.picture_url = picture_url
            user.access_token = credentials.token
            user.refresh_token = credentials.refresh_token
            user.token_expires_at = credentials.expiry
            user.updated_at = datetime.now(timezone.utc)
            logger.info("Updated existing user", user_id=user.id, email=email)
        else:
            # Create new user
            user = User(
                google_id=google_id,
                email=email,
                name=name,
                picture_url=picture_url,
                access_token=credentials.token,
                refresh_token=credentials.refresh_token,
                token_expires_at=credentials.expiry,
            )
            db.add(user)
            await db.flush()  # Get the user ID
            logger.info("Created new user", user_id=user.id, email=email)

        # Create JWT token
        access_token = create_access_token(data={"sub": str(user.id)})

        return AuthResponse(
            user=UserResponse.model_validate(user),
            token=TokenResponse(
                access_token=access_token,
                expires_in=settings.jwt_expiration_hours * 3600,
            ),
        )

    except Exception as e:
        logger.exception("Google OAuth callback failed", error=str(e))
        raise AuthenticationError(
            message="Failed to authenticate with Google",
            details={"error": str(e)},
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: CurrentUser) -> UserResponse:
    """Get the currently authenticated user's information."""
    return UserResponse.model_validate(current_user)


@router.post("/logout")
async def logout() -> dict:
    """
    Logout the current user.

    Note: Since we use JWTs, this is primarily for client-side token removal.
    The token will remain valid until expiration.
    """
    return {"message": "Logged out successfully"}
