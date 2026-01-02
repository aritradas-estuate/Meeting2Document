# MeetingsToDocument - Backend

FastAPI backend for AI-powered document generation from meeting recordings.

## Tech Stack

- **Runtime**: Python 3.12
- **Package Manager**: [uv](https://docs.astral.sh/uv/) (REQUIRED - do not use pip/poetry)
- **Framework**: FastAPI with async SQLAlchemy
- **Database**: PostgreSQL 16
- **Task Queue**: Celery with Redis
- **AI**: CrewAI, OpenAI, Anthropic, Google Gemini, AssemblyAI

## Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) package manager
- Docker & Docker Compose (for local services)

## Quick Start

### 1. Start Local Services

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 2. Install Dependencies

```bash
# Install uv if you haven't
curl -LsSf https://astral.sh/uv/install.sh | sh

# Sync dependencies (creates .venv automatically)
uv sync
```

### 3. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your API keys:
# - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (for OAuth)
# - OPENAI_API_KEY
# - ANTHROPIC_API_KEY
# - GOOGLE_AI_API_KEY (for Gemini)
# - ASSEMBLYAI_API_KEY
```

### 4. Run Database Migrations

```bash
# Run Alembic migrations
uv run alembic upgrade head
```

### 5. Start the Server

```bash
# Development server with auto-reload
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or use the main.py entry point
uv run python main.py
```

### 6. Start Celery Worker (separate terminal)

```bash
# Start worker for background processing
uv run celery -A workers.celery_app worker -l info -Q processing,default
```

## API Documentation

Once running, access:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

```
Backend/
├── app/
│   ├── api/              # API routes
│   │   ├── auth.py       # Google OAuth
│   │   ├── projects.py   # Project CRUD
│   │   ├── drive.py      # Google Drive browser
│   │   ├── jobs.py       # Processing jobs
│   │   └── documents.py  # Document management
│   ├── core/             # Core utilities
│   │   ├── exceptions.py # Custom exceptions
│   │   ├── logging.py    # Structlog setup
│   │   └── security.py   # JWT handling
│   ├── db/               # Database
│   │   └── database.py   # Async SQLAlchemy
│   ├── models/           # SQLAlchemy models
│   ├── schemas/          # Pydantic schemas
│   ├── services/         # Business logic (TODO)
│   ├── config.py         # Settings from env
│   └── main.py           # FastAPI app
├── workers/
│   ├── ai_pipeline/      # CrewAI agents (TODO)
│   ├── tasks/            # Celery tasks
│   └── celery_app.py     # Celery config
├── alembic/              # Database migrations
├── document_schemas/     # Zuora Q2R schema (TODO)
├── tests/                # Test suite (TODO)
├── docker-compose.yml    # Local services
├── pyproject.toml        # Dependencies
└── .env.example          # Environment template
```

## Development Commands

```bash
# Add a new dependency
uv add <package-name>

# Add dev dependency
uv add --dev <package-name>

# Run type checking
uv run pyright

# Create new migration
uv run alembic revision --autogenerate -m "description"

# Apply migrations
uv run alembic upgrade head

# Rollback migration
uv run alembic downgrade -1
```

## Environment Variables

See `.env.example` for all available configuration options. Key variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key | Yes |
| `GOOGLE_AI_API_KEY` | Google Gemini API key | Yes |
| `ASSEMBLYAI_API_KEY` | AssemblyAI API key | Yes |
| `SECRET_KEY` | JWT signing key | Yes (change in prod) |

## Notes for AI Agents

> **IMPORTANT**: This project uses `uv` as its package manager.
> 
> - Always use `uv run <command>` to run Python commands
> - Use `uv add <package>` to add dependencies (not pip install)
> - Use `uv sync` to install dependencies
> - The virtual environment is at `.venv/`
> - Do NOT use pip, poetry, or conda

## Docker Services

The `docker-compose.yml` provides:

- **PostgreSQL 16**: Port 5432, user `mtd_user`, password `mtd_password`, database `meetingstodoc`
- **Redis 7**: Port 6379

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Stop and remove volumes (reset data)
docker-compose down -v

# View logs
docker-compose logs -f postgres
docker-compose logs -f redis
```
