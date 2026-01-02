# MeetingsToDocument

AI-powered application that transforms meeting recordings from Google Drive into structured Zuora Solution Design Documents.

## Features

- Google OAuth integration with Drive access
- Browse and select meeting recordings from Shared Drives
- AI-powered transcription (AssemblyAI)
- Video analysis (Google Gemini 2.0 Flash)
- Document synthesis and generation (GPT-4o)
- Section review loop (Claude)
- Export to Google Docs

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python 3.12, FastAPI, SQLAlchemy (async), Celery |
| **Frontend** | React 19, TanStack Router/Start, Tailwind v4, shadcn/ui, Zustand |
| **Database** | PostgreSQL 16 |
| **Queue** | Redis 7 |
| **AI** | OpenAI GPT-4o, Anthropic Claude, Google Gemini, AssemblyAI |

## Prerequisites

- **Docker & Docker Compose** - For PostgreSQL and Redis
- **Python 3.12+** with [uv](https://docs.astral.sh/uv/) package manager
- **Node.js 18+** with [bun](https://bun.sh/) package manager
- **Google Cloud Console project** with OAuth 2.0 credentials

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd MeetingsToDocumet
```

### 2. Set Up Google Cloud OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable these APIs:
   - Google Drive API
   - Google Docs API
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth 2.0 Client IDs**
6. Configure the OAuth consent screen if prompted
7. Set application type to **Web application**
8. Add authorized redirect URIs:
   - `http://localhost:3000/` (for frontend callback)
9. Copy the **Client ID** and **Client Secret**

### 3. Start Database Services

```bash
cd Backend
docker compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379

### 4. Set Up Backend

```bash
cd Backend

# Install uv if you haven't
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv sync

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys (see Environment Variables section)

# Run database migrations
uv run alembic upgrade head

# Start the backend server
uv run uvicorn app.main:app --reload --port 8000
```

Backend will be available at http://localhost:8000

### 5. Set Up Frontend

In a new terminal:

```bash
cd Frontend

# Install bun if you haven't
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Create environment file
echo "VITE_API_URL=http://localhost:8000" > .env

# Start the frontend dev server
bun run dev
```

Frontend will be available at http://localhost:3000

### 6. Start Celery Worker (Optional - for AI processing)

In a new terminal:

```bash
cd Backend
uv run celery -A workers.celery_app worker -l info -Q processing,default
```

## Environment Variables

### Backend (`Backend/.env`)

```bash
# Required - Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret

# Required - AI API Keys
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GOOGLE_AI_API_KEY=your-google-ai-key
ASSEMBLYAI_API_KEY=your-assemblyai-key

# Database (defaults work with docker-compose)
DATABASE_URL=postgresql+asyncpg://mtd_user:mtd_password@localhost:5432/meetingstodoc

# Redis (defaults work with docker-compose)
REDIS_URL=redis://localhost:6379/0

# Security (change in production)
SECRET_KEY=your-secret-key-at-least-32-characters-long
```

### Frontend (`Frontend/.env`)

```bash
VITE_API_URL=http://localhost:8000
```

## Project Structure

```
MeetingsToDocumet/
├── Backend/
│   ├── app/
│   │   ├── api/           # FastAPI routes
│   │   ├── core/          # Utilities, logging, security
│   │   ├── db/            # Database connection
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic
│   │   ├── config.py      # Settings
│   │   └── main.py        # FastAPI app
│   ├── workers/
│   │   ├── ai_pipeline/   # CrewAI agents (TODO)
│   │   ├── tasks/         # Celery tasks
│   │   └── celery_app.py
│   ├── alembic/           # Database migrations
│   ├── docker-compose.yml
│   ├── pyproject.toml
│   └── .env.example
│
├── Frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── lib/           # API client, utilities
│   │   ├── routes/        # TanStack Router pages
│   │   ├── stores/        # Zustand stores
│   │   └── types/         # TypeScript types
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
└── README.md              # This file
```

## API Documentation

Once the backend is running:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Development Commands

### Backend

```bash
cd Backend

# Start server
uv run uvicorn app.main:app --reload

# Run migrations
uv run alembic upgrade head

# Create new migration
uv run alembic revision --autogenerate -m "description"

# Add dependency
uv add <package-name>

# Start Celery worker
uv run celery -A workers.celery_app worker -l info
```

### Frontend

```bash
cd Frontend

# Start dev server
bun run dev

# Build for production
bun run build

# Add dependency
bun add <package-name>
```

### Docker Services

```bash
cd Backend

# Start services
docker compose up -d

# Stop services
docker compose down

# Reset data
docker compose down -v

# View logs
docker compose logs -f postgres
```

## Troubleshooting

### "redirect_uri_mismatch" error
Add `http://localhost:3000/` to your Google Cloud Console authorized redirect URIs.

### "invalid_client" error
Check that `GOOGLE_CLIENT_SECRET` in `.env` is correct (not the placeholder value).

### Database connection errors
Make sure Docker is running: `docker compose up -d`

### Port already in use
- Backend default: 8000
- Frontend default: 3000
- PostgreSQL: 5432
- Redis: 6379
