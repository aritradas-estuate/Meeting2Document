# MeetingsToDocument - Comprehensive Implementation Plan

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [API Endpoints](#5-api-endpoints)
6. [AI Pipeline & CrewAI Agents](#6-ai-pipeline--crewai-agents)
7. [Google Drive Integration](#7-google-drive-integration)
8. [Frontend Design](#8-frontend-design)
9. [Environment Configuration](#9-environment-configuration)
10. [Deployment (Railway)](#10-deployment-railway)
11. [Implementation Roadmap](#11-implementation-roadmap)

---

## 1. Executive Summary

### Project Overview
**MeetingsToDocument** is an AI-powered application that transforms meeting recordings from Google Drive into structured Zuora Solution Design Documents.

### MVP Scope
- **Input**: Video files from Google Drive Shared Drives
- **Output**: Markdown document (Q2R Requirements section)
- **Users**: Small team with Google Workspace accounts

### Tech Stack Summary

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + TanStack Router + shadcn/ui |
| **Backend** | Python 3.12 + FastAPI |
| **AI Orchestration** | CrewAI |
| **Video Analysis** | Gemini 2.0 Flash |
| **Transcription** | AssemblyAI |
| **Synthesis** | GPT-4o (configurable) |
| **Section Writing** | GPT-4o (configurable) |
| **Section Review** | Claude (configurable) |
| **Database** | PostgreSQL + pgvector |
| **Job Queue** | Celery + Redis |
| **Auth** | Google OAuth 2.0 |
| **File Storage** | Google Drive API |
| **Hosting** | Railway |

---

## 2. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USERS                                           │
│                    (Google Workspace Accounts)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                                   │
│                     https://meetingstodoc.railway.app                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Google    │  │   Drive     │  │  Processing │  │  Document   │        │
│  │   Sign-In   │  │   Browser   │  │   Status    │  │   Viewer    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ REST API + WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (FastAPI)                                   │
│                   https://api.meetingstodoc.railway.app                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         API LAYER                                     │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │  │
│  │  │  Auth    │ │ Projects │ │  Drive   │ │   Jobs   │ │Documents │   │  │
│  │  │  Routes  │ │  Routes  │ │  Routes  │ │  Routes  │ │  Routes  │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                       SERVICE LAYER                                   │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │  │
│  │  │  Auth    │ │  Drive   │ │ Document │ │  Export  │               │  │
│  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │               │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌─────────────────────────┐ ┌─────────────┐ ┌─────────────────────────┐
│      PostgreSQL         │ │    Redis    │ │     Celery Workers      │
│   (Railway Managed)     │ │  (Railway)  │ │                         │
├─────────────────────────┤ ├─────────────┤ │  ┌───────────────────┐  │
│ • users                 │ │ • Job Queue │ │  │   AI PIPELINE     │  │
│ • projects              │ │ • Sessions  │ │  │   (CrewAI)        │  │
│ • processing_jobs       │ │ • Cache     │ │  │                   │  │
│ • documents             │ │             │ │  │ • Transcription   │  │
│ • document_sections     │ └─────────────┘ │  │ • Video Analysis  │  │
└─────────────────────────┘                 │  │ • Synthesis       │  │
                                            │  │ • Section Writer  │  │
                                            │  │ • Section Review  │  │
                                            │  └───────────────────┘  │
                                            └─────────────────────────┘
                                                        │
                                    ┌───────────────────┼───────────────────┐
                                    ▼                   ▼                   ▼
                            ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
                            │ AssemblyAI  │     │   OpenAI    │     │  Anthropic  │
                            │             │     │   + Google  │     │             │
                            │Transcription│     │   Gemini    │     │   Claude    │
                            └─────────────┘     └─────────────┘     └─────────────┘
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. USER SELECTS FILES                                                       │
│  ────────────────────                                                        │
│  User → Sign in with Google → Browse Shared Drive → Select video files      │
│                                                                              │
│  2. JOB CREATION                                                             │
│  ───────────────                                                             │
│  Frontend → POST /api/jobs → Creates job in PostgreSQL → Queues in Redis    │
│                                                                              │
│  3. FILE DOWNLOAD                                                            │
│  ───────────────                                                             │
│  Celery Worker → Google Drive API → Download to temp storage                │
│                                                                              │
│  4. PARALLEL EXTRACTION                                                      │
│  ──────────────────────                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌─────────────────────┐         ┌─────────────────────┐           │   │
│  │  │    AssemblyAI       │         │  Gemini 2.0 Flash   │           │   │
│  │  │                     │         │                     │           │   │
│  │  │  Input: Audio track │         │  Input: Video file  │           │   │
│  │  │  Output:            │         │  Output:            │           │   │
│  │  │  • Transcript       │         │  • Visual context   │           │   │
│  │  │  • Speaker labels   │         │  • Slide content    │           │   │
│  │  │  • Timestamps       │         │  • Diagrams         │           │   │
│  │  └──────────┬──────────┘         └──────────┬──────────┘           │   │
│  │             │                               │                       │   │
│  │             └───────────────┬───────────────┘                       │   │
│  │                             ▼                                       │   │
│  │                   Combined Extraction                               │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  5. SYNTHESIS                                                                │
│  ───────────                                                                 │
│  GPT-4o receives combined extraction → Outputs structured key points        │
│                                                                              │
│  6. SECTION GENERATION (Per Section, with Review Loop)                      │
│  ─────────────────────────────────────────────────────                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  For each Q2R subsection:                                           │   │
│  │                                                                      │   │
│  │  ┌─────────────┐       Draft        ┌─────────────┐                │   │
│  │  │   GPT-4o    │ ──────────────────▶│   Claude    │                │   │
│  │  │   Writer    │                    │   Reviewer  │                │   │
│  │  │             │◀────────────────── │             │                │   │
│  │  └─────────────┘     Feedback       └─────────────┘                │   │
│  │        │                                                            │   │
│  │        │  Max 3 iterations OR "APPROVED"                           │   │
│  │        ▼                                                            │   │
│  │  Final Section Markdown                                             │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  7. ASSEMBLY & UPLOAD                                                        │
│  ───────────────────                                                         │
│  Combine sections → Generate Markdown → Upload to Google Drive              │
│                                                                              │
│  8. NOTIFICATION                                                             │
│  ────────────                                                                │
│  WebSocket → Frontend → User sees completed document                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Project Structure

```
meetings-to-document/
│
├── backend/                          # Python FastAPI Backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI app entry point
│   │   ├── config.py                 # Centralized configuration
│   │   │
│   │   ├── api/                      # API Routes
│   │   │   ├── __init__.py
│   │   │   ├── deps.py               # Dependency injection
│   │   │   ├── auth.py               # Google OAuth routes
│   │   │   ├── projects.py           # Project CRUD
│   │   │   ├── drive.py              # Google Drive operations
│   │   │   ├── jobs.py               # Processing job management
│   │   │   └── documents.py          # Document operations
│   │   │
│   │   ├── services/                 # Business Logic
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py       # Authentication logic
│   │   │   ├── drive_service.py      # Google Drive API wrapper
│   │   │   ├── project_service.py    # Project operations
│   │   │   ├── job_service.py        # Job management
│   │   │   └── document_service.py   # Document generation
│   │   │
│   │   ├── models/                   # SQLAlchemy Models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── project.py
│   │   │   ├── job.py
│   │   │   └── document.py
│   │   │
│   │   ├── schemas/                  # Pydantic Schemas
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── project.py
│   │   │   ├── job.py
│   │   │   └── document.py
│   │   │
│   │   ├── db/                       # Database
│   │   │   ├── __init__.py
│   │   │   ├── database.py           # Connection setup
│   │   │   └── migrations/           # Alembic migrations
│   │   │
│   │   └── core/                     # Core utilities
│   │       ├── __init__.py
│   │       ├── security.py           # JWT, encryption
│   │       ├── exceptions.py         # Custom exceptions
│   │       └── logging.py            # Structured logging
│   │
│   ├── workers/                      # Celery Workers
│   │   ├── __init__.py
│   │   ├── celery_app.py             # Celery configuration
│   │   ├── tasks.py                  # Task definitions
│   │   │
│   │   └── ai_pipeline/              # CrewAI Pipeline
│   │       ├── __init__.py
│   │       ├── crew.py               # Main crew orchestration
│   │       ├── agents/
│   │       │   ├── __init__.py
│   │       │   ├── transcription_agent.py
│   │       │   ├── video_analysis_agent.py
│   │       │   ├── synthesis_agent.py
│   │       │   ├── section_writer_agent.py
│   │       │   └── section_reviewer_agent.py
│   │       ├── tasks/
│   │       │   ├── __init__.py
│   │       │   ├── extraction_tasks.py
│   │       │   ├── synthesis_tasks.py
│   │       │   └── generation_tasks.py
│   │       ├── tools/
│   │       │   ├── __init__.py
│   │       │   ├── assemblyai_tool.py
│   │       │   ├── gemini_tool.py
│   │       │   └── drive_tool.py
│   │       └── prompts/
│   │           ├── __init__.py
│   │           ├── synthesis_prompts.py
│   │           └── q2r_section_prompts.py   # Baked-in from examples
│   │
│   ├── document_schemas/             # Configurable Document Schemas
│   │   ├── __init__.py
│   │   ├── base.py                   # Base schema class
│   │   ├── zuora_q2r.py              # Zuora Q2R schema (MVP)
│   │   └── zuora_full.py             # Full Zuora schema (future)
│   │
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py
│   │   ├── test_api/
│   │   ├── test_services/
│   │   └── test_ai_pipeline/
│   │
│   ├── alembic.ini
│   ├── pyproject.toml                # Python dependencies
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                         # React Frontend (existing structure)
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui (existing)
│   │   │   ├── auth/
│   │   │   │   └── GoogleSignIn.tsx
│   │   │   ├── drive/
│   │   │   │   ├── DriveBrowser.tsx
│   │   │   │   ├── FileSelector.tsx
│   │   │   │   └── FolderTree.tsx
│   │   │   ├── projects/
│   │   │   │   ├── ProjectCard.tsx
│   │   │   │   ├── ProjectList.tsx
│   │   │   │   └── NewProjectDialog.tsx
│   │   │   ├── jobs/
│   │   │   │   ├── JobProgress.tsx
│   │   │   │   ├── JobStatusBadge.tsx
│   │   │   │   └── ProcessingPipeline.tsx
│   │   │   └── documents/
│   │   │       ├── DocumentViewer.tsx
│   │   │       ├── MarkdownRenderer.tsx
│   │   │       └── SectionNav.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useDrive.ts
│   │   │   ├── useProjects.ts
│   │   │   ├── useJobs.ts
│   │   │   └── useWebSocket.ts
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts                # API client
│   │   │   ├── google.ts             # Google SDK setup
│   │   │   └── utils.ts
│   │   │
│   │   ├── routes/
│   │   │   ├── __root.tsx
│   │   │   ├── index.tsx             # Landing/Sign-in
│   │   │   ├── dashboard.tsx         # Main dashboard
│   │   │   ├── projects/
│   │   │   │   ├── index.tsx         # Project list
│   │   │   │   └── $projectId.tsx    # Project detail
│   │   │   └── documents/
│   │   │       └── $documentId.tsx   # Document viewer
│   │   │
│   │   ├── router.tsx
│   │   ├── routeTree.gen.ts
│   │   └── styles.css
│   │
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── Dockerfile
│
├── docker-compose.yml                # Local development
├── railway.toml                      # Railway deployment config
└── README.md
```

---

## 4. Database Schema

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATABASE SCHEMA                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐          ┌─────────────────┐                          │
│  │     users       │          │    projects     │                          │
│  ├─────────────────┤          ├─────────────────┤                          │
│  │ id (PK)         │──────┐   │ id (PK)         │                          │
│  │ google_id       │      │   │ user_id (FK)    │◀─────┐                   │
│  │ email           │      │   │ name            │      │                   │
│  │ name            │      └──▶│ description     │      │                   │
│  │ picture_url     │          │ drive_folder_id │      │                   │
│  │ access_token    │          │ drive_folder_name│     │                   │
│  │ refresh_token   │          │ schema_type     │      │                   │
│  │ token_expires_at│          │ model_config    │      │                   │
│  │ created_at      │          │ status          │      │                   │
│  │ updated_at      │          │ created_at      │      │                   │
│  └─────────────────┘          │ updated_at      │      │                   │
│                               └────────┬────────┘      │                   │
│                                        │               │                   │
│                    ┌───────────────────┴───────────────┤                   │
│                    │                                   │                   │
│                    ▼                                   │                   │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐       │
│  │      processing_jobs        │    │        documents            │       │
│  ├─────────────────────────────┤    ├─────────────────────────────┤       │
│  │ id (PK)                     │    │ id (PK)                     │       │
│  │ project_id (FK)             │◀──▶│ project_id (FK)             │───────┘
│  │ status                      │    │ job_id (FK)                 │◀──┐
│  │ video_files (JSONB)         │    │ title                       │   │
│  │ supporting_files (JSONB)    │    │ schema_type                 │   │
│  │ current_stage               │    │ content (JSONB)             │   │
│  │ stage_progress (JSONB)      │    │ markdown_content            │   │
│  │ extraction_result (JSONB)   │    │ drive_file_id               │   │
│  │ synthesis_result (JSONB)    │    │ drive_file_url              │   │
│  │ error_message               │    │ version                     │   │
│  │ started_at                  │    │ status                      │   │
│  │ completed_at                │    │ created_at                  │   │
│  │ created_at                  │    │ updated_at                  │   │
│  │ updated_at                  │    └─────────────────────────────┘   │
│  └─────────────────────────────┘                                      │
│                    │                                                   │
│                    │                                                   │
│                    ▼                                                   │
│  ┌─────────────────────────────┐                                      │
│  │     document_sections       │                                      │
│  ├─────────────────────────────┤                                      │
│  │ id (PK)                     │                                      │
│  │ document_id (FK)            │──────────────────────────────────────┘
│  │ section_id                  │  (e.g., "price_to_offer.product_catalog")
│  │ section_title               │
│  │ content                     │
│  │ status                      │  (pending/generating/reviewing/complete)
│  │ generation_history (JSONB)  │  (stores all drafts and feedback)
│  │ review_count                │
│  │ final_draft_number          │
│  │ created_at                  │
│  │ updated_at                  │
│  └─────────────────────────────┘
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SQLAlchemy Models

```python
# backend/app/models/user.py

from sqlalchemy import Column, String, DateTime, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    google_id = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    picture_url = Column(String, nullable=True)
    
    # OAuth tokens (encrypted at rest)
    access_token = Column(String, nullable=True)
    refresh_token = Column(String, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    projects = relationship("Project", back_populates="user")
```

```python
# backend/app/models/project.py

from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base
import enum

class ProjectStatus(str, enum.Enum):
    ACTIVE = "active"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ARCHIVED = "archived"

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    
    # Google Drive folder reference
    drive_folder_id = Column(String, nullable=True)
    drive_folder_name = Column(String, nullable=True)
    
    # Document configuration
    schema_type = Column(String, default="zuora_q2r")  # configurable schema
    model_config = Column(JSON, nullable=True)  # per-project model overrides
    
    status = Column(Enum(ProjectStatus), default=ProjectStatus.ACTIVE)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="projects")
    jobs = relationship("ProcessingJob", back_populates="project")
    documents = relationship("Document", back_populates="project")
```

```python
# backend/app/models/job.py

from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Enum, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base
import enum

class JobStatus(str, enum.Enum):
    PENDING = "pending"
    DOWNLOADING = "downloading"
    EXTRACTING = "extracting"
    SYNTHESIZING = "synthesizing"
    GENERATING = "generating"
    REVIEWING = "reviewing"
    ASSEMBLING = "assembling"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    FAILED = "failed"

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    status = Column(Enum(JobStatus), default=JobStatus.PENDING)
    
    # Selected files from Google Drive
    video_files = Column(JSON, nullable=False)  # [{id, name, mimeType, size}]
    supporting_files = Column(JSON, nullable=True)  # optional docs, notes
    
    # Progress tracking
    current_stage = Column(String, nullable=True)
    stage_progress = Column(JSON, default=dict)  # {stage: {progress, message}}
    
    # Results storage
    extraction_result = Column(JSON, nullable=True)  # transcript + visual analysis
    synthesis_result = Column(JSON, nullable=True)   # key points
    
    # Error handling
    error_message = Column(Text, nullable=True)
    
    # Timing
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="jobs")
    documents = relationship("Document", back_populates="job")
```

```python
# backend/app/models/document.py

from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Enum, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base
import enum

class DocumentStatus(str, enum.Enum):
    DRAFT = "draft"
    GENERATING = "generating"
    COMPLETE = "complete"

class SectionStatus(str, enum.Enum):
    PENDING = "pending"
    GENERATING = "generating"
    REVIEWING = "reviewing"
    COMPLETE = "complete"
    SKIPPED = "skipped"

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("processing_jobs.id"), nullable=True)
    
    title = Column(String, nullable=False)
    schema_type = Column(String, nullable=False)  # "zuora_q2r"
    
    # Full document content (assembled from sections)
    content = Column(JSON, nullable=True)  # structured by section
    markdown_content = Column(Text, nullable=True)  # final markdown
    
    # Google Drive output
    drive_file_id = Column(String, nullable=True)
    drive_file_url = Column(String, nullable=True)
    
    version = Column(Integer, default=1)
    status = Column(Enum(DocumentStatus), default=DocumentStatus.DRAFT)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="documents")
    job = relationship("ProcessingJob", back_populates="documents")
    sections = relationship("DocumentSection", back_populates="document")


class DocumentSection(Base):
    __tablename__ = "document_sections"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    
    section_id = Column(String, nullable=False)  # e.g., "price_to_offer.product_catalog"
    section_title = Column(String, nullable=False)
    
    content = Column(Text, nullable=True)  # final markdown content
    status = Column(Enum(SectionStatus), default=SectionStatus.PENDING)
    
    # Generation history for review loop
    generation_history = Column(JSON, default=list)
    # [
    #   {draft: 1, content: "...", reviewer_feedback: "...", approved: false},
    #   {draft: 2, content: "...", reviewer_feedback: "...", approved: true},
    # ]
    
    review_count = Column(Integer, default=0)
    final_draft_number = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="sections")
```

---

## 5. API Endpoints

### Authentication Routes

```
GET  /api/auth/google
     → Redirects to Google OAuth consent screen
     → Params: redirect_uri (frontend callback URL)

GET  /api/auth/google/callback
     → Handles OAuth callback from Google
     → Exchanges code for tokens
     → Creates/updates user in DB
     → Returns: {access_token, user}

POST /api/auth/refresh
     → Refreshes expired access token
     → Body: {refresh_token}
     → Returns: {access_token, expires_at}

GET  /api/auth/me
     → Returns current user info
     → Requires: Bearer token
     → Returns: {id, email, name, picture_url}

POST /api/auth/logout
     → Revokes tokens, clears session
```

### Google Drive Routes

```
GET  /api/drive/shared-drives
     → Lists all shared drives user has access to
     → Returns: [{id, name, kind}]

GET  /api/drive/files
     → Lists files/folders in a location
     → Params: parent_id (folder or shared drive ID)
     → Params: page_token (for pagination)
     → Returns: {files: [{id, name, mimeType, size, modifiedTime}], nextPageToken}

GET  /api/drive/files/{file_id}
     → Get file metadata
     → Returns: {id, name, mimeType, size, webViewLink}

GET  /api/drive/files/{file_id}/download
     → Download file content (internal use by workers)
     → Returns: file stream

POST /api/drive/files/upload
     → Upload file to Drive
     → Body: {parent_id, name, content, mimeType}
     → Returns: {id, name, webViewLink}
```

### Project Routes

```
GET  /api/projects
     → List all projects for current user
     → Params: status (filter), page, limit
     → Returns: {projects: [...], total, page, limit}

POST /api/projects
     → Create new project
     → Body: {name, description, drive_folder_id, schema_type}
     → Returns: {project}

GET  /api/projects/{project_id}
     → Get project details with recent jobs and documents
     → Returns: {project, jobs: [...], documents: [...]}

PATCH /api/projects/{project_id}
      → Update project
      → Body: {name?, description?, model_config?, status?}
      → Returns: {project}

DELETE /api/projects/{project_id}
       → Delete project (soft delete / archive)
       → Returns: {success: true}

GET  /api/projects/{project_id}/config
     → Get project configuration (models, schema)
     → Returns: {schema_type, model_config, available_models}

PATCH /api/projects/{project_id}/config
      → Update project model configuration
      → Body: {model_video_analysis?, model_synthesis?, ...}
      → Returns: {model_config}
```

### Processing Job Routes

```
POST /api/projects/{project_id}/jobs
     → Create new processing job
     → Body: {
         video_files: [{id, name}],
         supporting_files?: [{id, name}]
       }
     → Returns: {job}
     → Side effect: Queues Celery task

GET  /api/projects/{project_id}/jobs
     → List all jobs for project
     → Returns: {jobs: [...]}

GET  /api/jobs/{job_id}
     → Get job details and progress
     → Returns: {job, stage_progress, current_stage}

GET  /api/jobs/{job_id}/status
     → Get real-time job status (lightweight)
     → Returns: {status, current_stage, progress_percent}

POST /api/jobs/{job_id}/cancel
     → Cancel running job
     → Returns: {success: true}

POST /api/jobs/{job_id}/retry
     → Retry failed job
     → Returns: {job} (new job created)

WebSocket: /api/ws/jobs/{job_id}
           → Real-time progress updates
           → Messages: {type: "progress", stage, percent, message}
           → Messages: {type: "complete", document_id}
           → Messages: {type: "error", message}
```

### Document Routes

```
GET  /api/projects/{project_id}/documents
     → List all documents for project
     → Returns: {documents: [...]}

GET  /api/documents/{document_id}
     → Get full document with sections
     → Returns: {document, sections: [...]}

GET  /api/documents/{document_id}/markdown
     → Get document as markdown
     → Returns: markdown string (text/markdown)

GET  /api/documents/{document_id}/sections
     → Get all sections with generation history
     → Returns: {sections: [...with history...]}

GET  /api/documents/{document_id}/sections/{section_id}
     → Get specific section
     → Returns: {section, generation_history}

PATCH /api/documents/{document_id}/sections/{section_id}
      → Update section content (manual edit)
      → Body: {content}
      → Returns: {section}

POST /api/documents/{document_id}/regenerate
     → Regenerate entire document
     → Returns: {job} (new processing job)

POST /api/documents/{document_id}/sections/{section_id}/regenerate
     → Regenerate specific section
     → Returns: {section} (queues background task)

POST /api/documents/{document_id}/upload-to-drive
     → Upload/update document in Google Drive
     → Body: {folder_id?}
     → Returns: {drive_file_id, drive_file_url}
```

---

## 6. AI Pipeline & CrewAI Agents

### Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CREWAI PIPELINE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        DOCUMENT CREW                                 │   │
│  │                                                                      │   │
│  │  Process: Sequential (with parallel extraction)                     │   │
│  │                                                                      │   │
│  │  STAGE 1: EXTRACTION (Parallel)                                     │   │
│  │  ┌───────────────────┐    ┌───────────────────┐                    │   │
│  │  │ Transcription     │    │ Video Analysis    │                    │   │
│  │  │ Agent             │    │ Agent             │                    │   │
│  │  │ Model: AssemblyAI │    │ Model: Gemini     │                    │   │
│  │  └───────────────────┘    └───────────────────┘                    │   │
│  │                                                                      │   │
│  │  STAGE 2: SYNTHESIS                                                 │   │
│  │  ┌───────────────────────────────────────────────────────┐         │   │
│  │  │ Synthesis Agent                                        │         │   │
│  │  │ Model: GPT-4o (configurable)                           │         │   │
│  │  └───────────────────────────────────────────────────────┘         │   │
│  │                                                                      │   │
│  │  STAGE 3: SECTION GENERATION (Per Section, with Review)            │   │
│  │  ┌───────────────────┐         ┌───────────────────┐               │   │
│  │  │ Section Writer    │ Draft   │ Section Reviewer  │               │   │
│  │  │ Agent             │────────▶│ Agent             │               │   │
│  │  │ Model: GPT-4o     │◀────────│ Model: Claude     │               │   │
│  │  └───────────────────┘ Feedback└───────────────────┘               │   │
│  │                                                                      │   │
│  │  STAGE 4: ASSEMBLY                                                  │   │
│  │  Combine all sections → Markdown → Upload to Drive                 │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Agent Definitions

See the full implementation plan for detailed agent code including:
- Transcription Agent (AssemblyAI)
- Video Analysis Agent (Gemini 2.0 Flash)
- Synthesis Agent (GPT-4o)
- Section Writer Agent (GPT-4o with section-specific prompts)
- Section Reviewer Agent (Claude)

### Section-Specific Prompts

The Q2R section prompts are baked into the codebase based on analysis of 10 example Zuora Blueprint documents. Each section has:
- Guidelines (what to include)
- Format (expected structure)
- Standard phrases (consistent terminology)

Sections covered:
- Price to Offer (13 subsections)
- Lead to Quotes
- Order to Subscription Management (6 subsections)
- Billing Settings
- Rating to Billing
- Cash to Collections
- Revenue Recognition to Finance
- Record to Report

---

## 7. Google Drive Integration

The Google Drive service provides:
- List shared drives
- Browse folders and files
- Download files for processing
- Upload generated documents

Authentication uses OAuth 2.0 with the following scopes:
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/drive.file`

---

## 8. Frontend Design

### Key Components

1. **Landing Page**: Google Sign-In button
2. **Dashboard**: Project list, recent activity
3. **Project View**: 
   - Drive browser with file selection
   - Jobs tab with processing status
   - Documents tab with generated docs
4. **Document Viewer**: 
   - Section navigation sidebar
   - Markdown renderer
   - Download/Upload buttons

---

## 9. Environment Configuration

### Required Environment Variables

```bash
# APPLICATION
APP_NAME=MeetingsToDocument
APP_ENV=development
DEBUG=true
LOG_LEVEL=INFO

# SERVER
HOST=0.0.0.0
PORT=8000
FRONTEND_URL=http://localhost:5173

# DATABASE
DATABASE_URL=postgresql://user:password@localhost:5432/meetingstodoc

# REDIS
REDIS_URL=redis://localhost:6379/0

# GOOGLE OAUTH
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback

# AI MODEL API KEYS
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GOOGLE_AI_API_KEY=your-google-ai-key
ASSEMBLYAI_API_KEY=your-assemblyai-key

# AI MODEL CONFIGURATION (Easily Changeable)
MODEL_VIDEO_ANALYSIS=gemini-2.0-flash
MODEL_TRANSCRIPTION=best
MODEL_SYNTHESIS=gpt-4o
MODEL_SECTION_WRITER=gpt-4o
MODEL_SECTION_REVIEWER=claude-3-5-sonnet-20241022

# PROCESSING
MAX_REVIEW_LOOPS=3
DEFAULT_DOCUMENT_SCHEMA=zuora_q2r

# SECURITY
SECRET_KEY=your-secret-key-at-least-32-characters
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
```

---

## 10. Deployment (Railway)

### Services to Deploy

1. **Frontend** (React) - Static site
2. **Backend** (FastAPI) - Web service
3. **Celery Worker** - Background processing
4. **PostgreSQL** - Database (Railway plugin)
5. **Redis** - Queue/Cache (Railway plugin)

### Estimated Costs

- Railway Hosting: $30-75/month
- OpenAI API: $20-100/month
- Anthropic API: $20-80/month
- Google AI: $10-50/month
- AssemblyAI: $0.65/hour of audio

**Total: ~$100-350/month**

---

## 11. Implementation Roadmap

### Phase Summary

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 1 | Week 1-2 | Foundation (Setup, Auth, DB) |
| Phase 2 | Week 3-4 | Core Features (Drive, Projects, Jobs) |
| Phase 3 | Week 5-6 | AI Pipeline (Extraction, Synthesis) |
| Phase 4 | Week 7-8 | Document Generation (Writer/Reviewer) |
| Phase 5 | Week 9-10 | Polish & Deploy |

### Total Estimated Effort

- **354 hours** (~9-10 weeks)

### MVP Deliverables

- Google Sign-In authentication
- Google Drive Shared Drives browser
- Multi-file video selection
- AI-powered transcription (AssemblyAI)
- AI-powered video analysis (Gemini 2.0 Flash)
- Content synthesis (GPT-4o)
- Section generation with review loop (GPT + Claude)
- Zuora Q2R Requirements document generation
- Markdown output with upload to Drive
- Real-time processing progress
- Configurable AI models via environment variables

---

## Quick Start

### Prerequisites

1. Set up Google Cloud project with OAuth credentials
2. Get API keys: OpenAI, Anthropic, Google AI, AssemblyAI
3. Install Python 3.12+, Node.js 20+, Redis

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install poetry
poetry install
cp .env.example .env  # Edit with your values
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend
bun install
bun run dev
```

### Celery Worker

```bash
cd backend
celery -A workers.celery_app worker --loglevel=info
```

---

*Last Updated: December 31, 2025*
