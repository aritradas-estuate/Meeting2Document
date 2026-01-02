"""
FastAPI application entry point.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.core.exceptions import AppException
from app.core.logging import get_logger, setup_logging
from app.db.database import engine, init_db

# Import all models to register them with SQLAlchemy
from app.models import Document, DocumentSection, ProcessingJob, Project, User  # noqa: F401

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup and shutdown events."""
    # Startup
    setup_logging()
    logger.info("Starting application", app_name=settings.app_name, env=settings.app_env)

    # Initialize database tables (dev only - use Alembic in production)
    if settings.is_development:
        logger.info("Initializing database tables")
        await init_db()

    yield

    # Shutdown
    logger.info("Shutting down application")
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description="AI-powered meeting recordings to Zuora Solution Design Documents",
    version="0.1.0",
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handle custom application exceptions."""
    logger.warning(
        "Application error",
        code=exc.code,
        message=exc.message,
        status_code=exc.status_code,
        path=request.url.path,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions."""
    logger.exception(
        "Unhandled exception",
        exc_info=exc,
        path=request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred" if settings.is_production else str(exc),
                "details": {},
            }
        },
    )


# Health check endpoints
@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    """Basic health check endpoint."""
    return {"status": "healthy", "app": settings.app_name}


@app.get("/health/ready", tags=["Health"], response_model=None)
async def readiness_check() -> dict | JSONResponse:
    """
    Readiness check - verifies database connectivity.
    Used by orchestrators to determine if the app can receive traffic.
    """
    from sqlalchemy import text

    from app.db.database import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        logger.error("Readiness check failed", error=str(e))
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "database": "disconnected", "error": str(e)},
        )


# API routes
from app.api import auth, documents, drive, jobs, projects

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(drive.router, prefix="/api/drive", tags=["Google Drive"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["Processing Jobs"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
