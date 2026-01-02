# WorkshopSolutionizer - Detailed Technical Documentation

**Version:** 1.0  
**Last Updated:** December 29, 2025  
**Document Type:** Comprehensive Technical Reference

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Technology Stack](#3-technology-stack)
4. [Environment Variables & Configuration](#4-environment-variables--configuration)
5. [Database Schema](#5-database-schema)
6. [API Endpoints Reference](#6-api-endpoints-reference)
7. [Video/Audio Upload System](#7-videoaudio-upload-system)
8. [AI System Architecture](#8-ai-system-architecture)
9. [Document Processing Pipeline](#9-document-processing-pipeline)
10. [Word/PDF Export System](#10-wordpdf-export-system)
11. [Frontend Architecture](#11-frontend-architecture)
12. [Error Handling & Recovery](#12-error-handling--recovery)
13. [File Structure](#13-file-structure)

---

## 1. System Overview

### 1.1 What is WorkshopSolutionizer?

WorkshopSolutionizer is an AI-powered document generation system that converts workshop recordings (audio/video files) into structured **Zuora Solution Design Documents**. It is specifically designed for Zuora implementation projects, automating the process of transforming recorded client workshops into professional technical documentation.

### 1.2 Core Capabilities

| Capability | Description |
|------------|-------------|
| **Audio/Video Transcription** | Converts workshop recordings to text using OpenAI Whisper |
| **AI-Powered Analysis** | Extracts structured content from transcriptions using GPT-4o/5 |
| **Reference Document Search** | Uses ChromaDB vector store for semantic search on reference documents |
| **Multi-Section Processing** | Processes content into 9 predefined Zuora document sections |
| **Document Generation** | Produces Word (.docx) and PDF documents with proper formatting |
| **Project Management** | Organizes work into projects with multiple recordings per project |
| **Quality Assessment** | Validates generated content for completeness and accuracy |

### 1.3 Target Users

- **Zuora Implementation Consultants**: Primary users who conduct client workshops
- **Solution Architects**: Review and edit generated documents
- **Project Managers**: Track document generation progress across projects

### 1.4 Business Value

- **Time Savings**: Reduces document creation time from hours to minutes
- **Consistency**: Ensures all solution design documents follow the same structure
- **Accuracy**: AI extracts specific details that might be missed manually
- **Scalability**: Handles multiple projects and recordings simultaneously

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         React Frontend                                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │
│  │  │Dashboard │  │ Project  │  │  Upload  │  │ Document │  │ Quality  │  │   │
│  │  │   Page   │  │  Manager │  │Component │  │  Editor  │  │Dashboard │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │   │
│  │                                                                          │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │               TanStack Query (State Management)                     │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ HTTP/REST
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXPRESS.JS SERVER (Port 5000)                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                          API Routes Layer                                │   │
│  │   /api/audio/upload    /api/video/upload    /api/projects/*             │   │
│  │   /api/documents/*     /api/reference/*     /api/templates/*            │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                        │                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐  │
│  │  Processing      │  │   AI Analysis    │  │      Vector Store            │  │
│  │  Queue           │  │   Engine         │  │      (ChromaDB)              │  │
│  │  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────────────────┐ │  │
│  │  │ Transcribe │  │  │  │ OpenAI     │  │  │  │ Python Bridge          │ │  │
│  │  │ Analyze    │  │  │  │ GPT-4o/5   │  │  │  │ chromadb-test.py       │ │  │
│  │  │ Generate   │  │  │  │ Whisper    │  │  │  │ Hybrid Search          │ │  │
│  │  └────────────┘  │  │  │ Embeddings │  │  │  │ (Semantic + Keyword)   │ │  │
│  └──────────────────┘  │  └────────────┘  │  │  └────────────────────────┘ │  │
│                         └──────────────────┘  └──────────────────────────────┘  │
│                                        │                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        Document Generation                               │   │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │   │
│  │   │ Token        │  │ Chunked      │  │ Word/PDF     │                  │   │
│  │   │ Budgeting    │  │ Analyzer     │  │ Export       │                  │   │
│  │   └──────────────┘  └──────────────┘  └──────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                        │                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                          Storage Layer                                   │   │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │   │
│  │   │ Drizzle ORM  │  │ File System  │  │ Document     │                  │   │
│  │   │ (PostgreSQL) │  │ (Uploads)    │  │ Store (JSON) │                  │   │
│  │   └──────────────┘  └──────────────┘  └──────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
            ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
            │  PostgreSQL  │   │   OpenAI     │   │  ChromaDB    │
            │  (Neon)      │   │   API        │   │  (Local)     │
            │              │   │              │   │              │
            │ - Projects   │   │ - Whisper    │   │ - Vectors    │
            │ - Documents  │   │ - GPT-4o/5   │   │ - Embeddings │
            │ - AudioFiles │   │ - Embeddings │   │ - Chunks     │
            │ - Templates  │   │              │   │              │
            └──────────────┘   └──────────────┘   └──────────────┘
```

### 2.1 Data Flow Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Upload    │     │  Transcribe │     │   Analyze   │     │  Generate   │
│   File      │────▶│   (Whisper) │────▶│   (GPT-4o)  │────▶│    Word     │
│             │     │             │     │             │     │   Document  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
     │                    │                    │                    │
     ▼                    ▼                    ▼                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Store in   │     │  Store      │     │  Query      │     │  Save to    │
│  /uploads   │     │  transcript │     │  ChromaDB   │     │  /uploads/  │
│             │     │  in DB      │     │  references │     │  projects/  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

---

## 3. Technology Stack

### 3.1 Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3.1 | UI framework |
| **TypeScript** | 5.6.3 | Type safety |
| **Vite** | 5.4.11 | Build tool & dev server |
| **TailwindCSS** | 3.4.17 | Utility-first CSS |
| **Radix UI** | Various | Accessible UI primitives |
| **shadcn/ui** | - | Component library built on Radix |
| **TanStack Query** | 5.60.6 | Server state management |
| **Lucide React** | 0.462.0 | Icon library |
| **react-dropzone** | 14.3.8 | File drag & drop |

### 3.2 Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20+ | Runtime environment |
| **Express.js** | 4.21.1 | Web framework |
| **TypeScript** | 5.6.3 | Type safety |
| **Drizzle ORM** | 0.39.1 | Database ORM |
| **Multer** | 1.4.5 | File upload handling |
| **OpenAI SDK** | 4.77.0 | AI API integration |
| **docx** | 9.1.1 | Word document generation |
| **pdfkit** | 0.15.1 | PDF generation |
| **mammoth** | 1.8.0 | DOCX text extraction |
| **zod** | 3.23.8 | Schema validation |

### 3.3 Database Technologies

| Technology | Purpose |
|------------|---------|
| **PostgreSQL** | Primary database (via Neon Serverless) |
| **Drizzle ORM** | Type-safe SQL queries |
| **Drizzle Kit** | Database migrations |
| **@neondatabase/serverless** | Serverless PostgreSQL driver |

### 3.4 AI/ML Technologies

| Technology | Purpose |
|------------|---------|
| **OpenAI Whisper** | Audio/video transcription |
| **OpenAI GPT-4o/5** | Content analysis and generation |
| **OpenAI Embeddings** | Text vectorization (text-embedding-3-small/large) |
| **ChromaDB** | Vector database for semantic search |
| **Python 3** | ChromaDB bridge (chromadb-test.py) |

### 3.5 Development Tools

| Tool | Purpose |
|------|---------|
| **esbuild** | TypeScript bundling |
| **tsx** | TypeScript execution |
| **concurrently** | Parallel script running |
| **drizzle-kit** | Database schema management |

---

## 4. Environment Variables & Configuration

### 4.1 Required Environment Variables

```env
# ============================================
# REQUIRED - Application will not start without these
# ============================================

# PostgreSQL Database Connection (Neon Serverless)
DATABASE_URL=postgresql://username:password@host:5432/database?sslmode=require

# OpenAI API Key for all AI operations
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 4.2 Optional Environment Variables

```env
# ============================================
# OPTIONAL - Defaults will be used if not set
# ============================================

# OpenAI Model Configuration
OPENAI_GPT_MODEL=gpt-5                    # Default: gpt-5 (also supports gpt-4o)
OPENAI_WHISPER_MODEL=whisper-1            # Default: whisper-1
OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # Default: text-embedding-3-small
                                               # Alternative: text-embedding-3-large

# Server Configuration (hardcoded in code, not configurable via env)
# PORT=5000  # Currently hardcoded in server/index.ts line 110
```

### 4.3 Configuration Details

#### 4.3.1 Database Configuration

**File:** `server/db.ts`
```typescript
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool });
```

#### 4.3.2 OpenAI Configuration

**File:** `server/openai.ts`
```typescript
export const AI_MODELS = {
  GPT: process.env.OPENAI_GPT_MODEL || "gpt-5",
  WHISPER: process.env.OPENAI_WHISPER_MODEL || "whisper-1",
  EMBEDDING: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"
};
```

#### 4.3.3 File Upload Configuration

**File:** `server/routes.ts`
```typescript
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(process.cwd(), "uploads"),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 600 * 1024 * 1024, // 600MB limit for audio/video
  }
});
```

### 4.4 Drizzle ORM Configuration

**File:** `drizzle.config.ts`
```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

---

## 5. Database Schema

### 5.1 Schema Overview

The database consists of 6 tables that manage users, projects, audio files, documents, templates, and document sessions.

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────────────┐
│   users     │       │    projects     │       │  documentTemplates  │
├─────────────┤       ├─────────────────┤       ├─────────────────────┤
│ id (PK)     │       │ id (PK)         │◄──────│ id (PK)             │
│ username    │       │ name            │       │ projectId (FK)      │
│ password    │       │ description     │       │ name                │
└─────────────┘       │ clientName      │       │ description         │
                      │ status          │       │ sections (JSONB)    │
                      │ createdAt       │       │ chunkedSections     │
                      │ updatedAt       │       │ tokenBudget         │
                      └────────┬────────┘       │ totalChunks         │
                               │                │ chunkingMetadata    │
                               │                │ filePath            │
                               │                │ originalFileName    │
                ┌──────────────┼──────────────┐ │ fileSize            │
                │              │              │ │ mimeType            │
                ▼              ▼              ▼ │ createdAt           │
        ┌───────────────┐ ┌───────────┐ ┌─────────────────────┐
        │  audioFiles   │ │ documents │ └─────────────────────┘
        ├───────────────┤ ├───────────┤
        │ id (PK)       │ │ id (PK)   │
        │ projectId(FK) │ │projectId  │◄─────────────────────────┐
        │ filename      │ │(FK)       │                          │
        │ originalName  │ │templateId │                          │
        │ size          │ │(FK)       │                          │
        │ mimeType      │ │ title     │                          │
        │ uploadedAt    │ │ content   │                          │
        │ status        │ │ (JSONB)   │                          │
        │transcription  │ │ status    │                          │
        │ duration      │ │ section   │      ┌──────────────────┐
        │ fileType      │ │subsection │      │documentSessions  │
        │ section       │ │ createdAt │      ├──────────────────┤
        │ subsection    │ │ updatedAt │      │ id (PK)          │
        └───────┬───────┘ └─────┬─────┘      │ documentId (FK)──┤
                │               │            │ audioFileId (FK) │
                │               │            │ sessionDate      │
                │               └───────────▶│ topics (JSONB)   │
                │                            │sectionsUpdated   │
                └───────────────────────────▶│ createdAt        │
                                             └──────────────────┘
```

### 5.2 Table: users

**Purpose:** Authentication and user management

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing user ID |
| username | TEXT | NOT NULL, UNIQUE | User's login name |
| password | TEXT | NOT NULL | Hashed password |

### 5.3 Table: projects

**Purpose:** Organize work into logical project groupings

```sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing project ID |
| name | TEXT | NOT NULL | Project name |
| description | TEXT | - | Project description |
| clientName | TEXT | - | Client company name |
| status | TEXT | NOT NULL, DEFAULT 'active' | Project status: active, completed, on-hold, archived |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

### 5.4 Table: audioFiles

**Purpose:** Track uploaded audio/video files and their processing status

```sql
CREATE TABLE audio_files (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  transcription_text TEXT,
  duration INTEGER,
  file_type TEXT NOT NULL DEFAULT 'audio',
  section TEXT,
  subsection TEXT
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing file ID |
| projectId | INTEGER | FOREIGN KEY → projects.id | Associated project (nullable for global uploads) |
| filename | TEXT | NOT NULL | Server-side filename (with timestamp) |
| originalName | TEXT | NOT NULL | Original uploaded filename |
| size | INTEGER | NOT NULL | File size in bytes |
| mimeType | TEXT | NOT NULL | MIME type (audio/mp3, video/mp4, etc.) |
| uploadedAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Upload timestamp |
| status | TEXT | NOT NULL, DEFAULT 'uploaded' | Processing status (see below) |
| transcriptionText | TEXT | - | Extracted transcription text |
| duration | INTEGER | - | Duration in seconds |
| fileType | TEXT | NOT NULL, DEFAULT 'audio' | Type: 'audio' or 'video' |
| section | TEXT | - | Target section for analysis |
| subsection | TEXT | - | Target subsection for analysis |

**Status Values:**
- `uploaded` - File uploaded, awaiting processing
- `transcribing` - Whisper transcription in progress
- `transcribed` - Transcription complete
- `analyzing` - AI analysis in progress
- `completed` - Processing complete
- `failed` - Processing failed

### 5.5 Table: documentTemplates

**Purpose:** Store document templates with pre-chunking data for instant analysis

```sql
CREATE TABLE document_templates (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  sections JSONB,
  file_path TEXT,
  original_file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  chunked_sections JSONB,
  token_budget JSONB,
  total_chunks INTEGER,
  chunking_metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing template ID |
| projectId | INTEGER | FOREIGN KEY → projects.id | Associated project (null for global templates) |
| name | TEXT | NOT NULL | Template name |
| description | TEXT | - | Template description |
| sections | JSONB | - | Array of section definitions |
| filePath | TEXT | - | Path to uploaded template file |
| originalFileName | TEXT | - | Original template filename |
| fileSize | INTEGER | - | Template file size in bytes |
| mimeType | TEXT | - | Template MIME type |
| chunkedSections | JSONB | - | Pre-chunked template data for instant analysis |
| tokenBudget | JSONB | - | Token allocation metadata |
| totalChunks | INTEGER | - | Number of chunks template splits into |
| chunkingMetadata | JSONB | - | Chunking configuration and version |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**chunkedSections JSONB Structure:**
```typescript
interface TemplateChunk {
  id: string;
  sections: TemplateSection[];
  estimatedTokens: number;
  rootSection: TemplateSection;
}
```

**tokenBudget JSONB Structure:**
```typescript
interface TokenBudget {
  maxTokensPerChunk: number;
  transcriptTokens: number;
  globalContextTokens: number;
  availableForTemplate: number;
}
```

**chunkingMetadata JSONB Structure:**
```typescript
{
  chunkedAt: string;          // ISO timestamp
  chunkingVersion: string;    // e.g., "1.0"
  requiresChunking: boolean;  // Whether template needs chunking
}
```

### 5.6 Table: documents

**Purpose:** Store generated solution design documents

```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  template_id INTEGER REFERENCES document_templates(id),
  title TEXT NOT NULL,
  content JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  section TEXT,
  subsection TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing document ID |
| projectId | INTEGER | FOREIGN KEY → projects.id | Associated project |
| templateId | INTEGER | FOREIGN KEY → documentTemplates.id | Template used (if any) |
| title | TEXT | NOT NULL | Document title |
| content | JSONB | - | Document content (see structure below) |
| status | TEXT | NOT NULL, DEFAULT 'draft' | Document status: draft, complete |
| section | TEXT | - | Target section being processed |
| subsection | TEXT | - | Target subsection being processed |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**content JSONB Structure (Schema-Based):**
```typescript
{
  "Document Purpose": {
    "title": "Document Purpose",
    "subSections": {
      "Business Overview": "Content...",
      "Project Overview": "Content..."
    }
  },
  "Requirements": {
    "title": "Requirements",
    "subSections": {
      "Business Requirements": "Content..."
    }
  },
  // ... other sections
}
```

### 5.7 Table: documentSessions

**Purpose:** Link audio files to documents and track which sections were updated

```sql
CREATE TABLE document_sessions (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id),
  audio_file_id INTEGER REFERENCES audio_files(id),
  session_date TIMESTAMP DEFAULT NOW() NOT NULL,
  topics JSONB,
  sections_updated JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing session ID |
| documentId | INTEGER | FOREIGN KEY → documents.id | Associated document |
| audioFileId | INTEGER | FOREIGN KEY → audioFiles.id | Audio file used in this session |
| sessionDate | TIMESTAMP | NOT NULL, DEFAULT NOW() | Session timestamp |
| topics | JSONB | - | Array of topics discussed |
| sectionsUpdated | JSONB | - | Array of sections updated in this session |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

### 5.8 TypeScript Schema Definitions

**File:** `shared/schema.ts`

```typescript
import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
});

// Projects table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  clientName: text("client_name"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Audio files table
export const audioFiles = pgTable("audio_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mime_type").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  status: text("status").notNull().default("uploaded"),
  transcriptionText: text("transcription_text"),
  duration: integer("duration"),
  fileType: text("file_type").notNull().default("audio"),
  section: text("section"),
  subsection: text("subsection"),
});

// Document templates table
export const documentTemplates = pgTable("document_templates", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  name: text("name").notNull(),
  description: text("description"),
  sections: jsonb("sections").$type<any[]>(),
  filePath: text("file_path"),
  originalFileName: text("original_file_name"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  chunkedSections: jsonb("chunked_sections").$type<any[]>(),
  tokenBudget: jsonb("token_budget").$type<any>(),
  totalChunks: integer("total_chunks"),
  chunkingMetadata: jsonb("chunking_metadata").$type<any>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Documents table
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  templateId: integer("template_id").references(() => documentTemplates.id),
  title: text("title").notNull(),
  content: jsonb("content").$type<any>(),
  status: text("status").notNull().default("draft"),
  section: text("section"),
  subsection: text("subsection"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Document sessions table
export const documentSessions = pgTable("document_sessions", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => documents.id),
  audioFileId: integer("audio_file_id").references(() => audioFiles.id),
  sessionDate: timestamp("session_date").defaultNow().notNull(),
  topics: jsonb("topics").$type<string[]>(),
  sectionsUpdated: jsonb("sections_updated").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type AudioFile = typeof audioFiles.$inferSelect;
export type InsertAudioFile = typeof audioFiles.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type InsertDocumentTemplate = typeof documentTemplates.$inferInsert;
export type DocumentSession = typeof documentSessions.$inferSelect;
export type InsertDocumentSession = typeof documentSessions.$inferInsert;
```

---

## 6. API Endpoints Reference

### 6.1 Audio/Video Upload Endpoints

#### POST /api/audio/upload
Upload a single audio file for processing.

**Request:**
- Content-Type: `multipart/form-data`
- Field: `audio` (file)
- Body:
  - `projectId` (optional): number - Project to associate with
  - `section` (optional): string - Target section (default: "Document Purpose")
  - `subsection` (optional): string - Target subsection

**Response:**
```json
{
  "message": "Audio uploaded successfully",
  "file": {
    "id": 1,
    "filename": "audio-1735501234567-123456789.mp3",
    "originalName": "workshop-recording.mp3",
    "size": 15728640,
    "mimeType": "audio/mpeg",
    "status": "uploaded",
    "projectId": 1,
    "section": "Document Purpose",
    "subsection": "Business Overview"
  }
}
```

#### POST /api/video/upload
Upload a single video file for processing.

**Request:**
- Content-Type: `multipart/form-data`
- Field: `video` (file)
- Body:
  - `projectId` (optional): number
  - `section` (optional): string
  - `subsection` (optional): string

**Response:** Same structure as audio upload

#### POST /api/projects/:id/audio/upload
Upload audio file directly to a specific project.

#### POST /api/projects/:id/video/upload
Upload video file directly to a specific project.

#### POST /api/projects/:id/video/upload-chunk
Chunked video upload for large files.

**Request:**
- Content-Type: `multipart/form-data`
- Field: `chunk` (file)
- Body:
  - `uploadId`: string - Unique upload session ID
  - `chunkIndex`: number - Current chunk index (0-based)
  - `totalChunks`: number - Total number of chunks
  - `fileName`: string - Original filename
  - `fileSize`: number - Total file size
  - `section` (optional): string
  - `subsection` (optional): string

**Response (intermediate):**
```json
{
  "message": "Chunk 0 received, 1/5 complete",
  "uploadId": "abc123",
  "chunksReceived": 1,
  "totalChunks": 5
}
```

**Response (final):**
```json
{
  "message": "Chunked video uploaded and assembled successfully",
  "file": { /* audioFile object */ },
  "assembled": true
}
```

### 6.2 Reference Document Endpoints (ChromaDB)

#### POST /api/reference/upload
Upload reference documents for ChromaDB ingestion.

**Request:**
- Content-Type: `multipart/form-data`
- Field: `reference` (file)
- Accepts: .docx, .txt, .md files (max 50MB)

**Response:**
```json
{
  "success": true,
  "message": "Document 'Blueprint_v2.docx' ingested with 45 chunks",
  "chunks": 45,
  "embedding_model": "text-embedding-3-small"
}
```

#### GET /api/reference/list
List all reference documents in ChromaDB.

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "name": "Blueprint_v2.docx",
      "chunks": 45,
      "metadata": {
        "embedding_function": "openai",
        "model": "text-embedding-3-small"
      }
    }
  ]
}
```

#### GET /api/reference/view/:docName
View content of a specific reference document.

#### DELETE /api/reference/delete/:docName
Delete a reference document from ChromaDB.

### 6.3 Project Management Endpoints

#### POST /api/projects
Create a new project.

**Request:**
```json
{
  "name": "Acme Corp Implementation",
  "description": "Zuora billing implementation for Acme Corp",
  "clientName": "Acme Corporation"
}
```

**Response:**
```json
{
  "id": 1,
  "name": "Acme Corp Implementation",
  "description": "Zuora billing implementation for Acme Corp",
  "clientName": "Acme Corporation",
  "status": "active",
  "createdAt": "2025-12-29T10:30:00.000Z",
  "updatedAt": "2025-12-29T10:30:00.000Z"
}
```

#### GET /api/projects
Get all projects.

#### GET /api/projects/active
Get active projects only.

#### GET /api/projects/with-stats
Get projects with statistics (audio count, document count).

#### GET /api/projects/:id
Get specific project details.

#### PATCH /api/projects/:id
Update project details.

#### DELETE /api/projects/:id
Delete project and all associated data.

#### PATCH /api/projects/:id/archive
Archive a project.

#### PATCH /api/projects/:id/restore
Restore an archived project.

#### GET /api/projects/:id/audio
Get all audio files for a project.

#### GET /api/projects/:id/documents
Get all documents for a project.

#### GET /api/projects/:id/templates
Get all templates for a project.

### 6.4 Document Endpoints

#### GET /api/documents
Get all documents.

#### POST /api/documents
Create a new document.

#### GET /api/documents/:id
Get specific document.

#### PATCH /api/documents/:id
Update document content.

#### DELETE /api/documents/:id/delete
Delete a document.

#### POST /api/documents/:id/reset-processing
Reset document processing status.

#### POST /api/documents/:id/merge-with/:targetId
Merge two documents.

#### GET /api/documents/:id/export
Export document as PDF.

#### GET /api/documents/:id/quality
Get document quality metrics.

#### GET /api/documents/:id/workflow
Get document workflow status.

#### POST /api/documents/:id/validate
Validate document content.

#### PATCH /api/documents/:id/enhanced
Enhanced document update with validation.

#### POST /api/documents/:id/regenerate
Regenerate document content.

### 6.5 Word Document Endpoints

#### HEAD /api/projects/:projectId/document/download
Check if Word document exists for project.

#### GET /api/projects/:projectId/document/download
Download Word document for project.

#### GET /api/document/download
Download Word document (legacy endpoint).

### 6.6 Audio Processing Endpoints

#### GET /api/audio
Get all audio files.

#### POST /api/audio/:id/process
Manually trigger processing for an audio file.

#### POST /api/audio/:id/reprocess
Reprocess an audio file.

### 6.7 Template Endpoints

#### POST /api/projects/:id/templates
Create a template for a project.

#### POST /api/projects/:id/templates/upload
Upload a template file.

#### GET /api/templates/:id/preview
Preview template structure.

### 6.8 Statistics & Metrics Endpoints

#### GET /api/stats
Get system-wide statistics.

**Response:**
```json
{
  "documentsGenerated": 45,
  "hoursTranscribed": 120.5,
  "activeProjects": 8,
  "timeSaved": 360
}
```

#### GET /api/business/metrics
Get business metrics dashboard data.

### 6.9 Testing & Debug Endpoints

#### POST /api/test-post
Simple POST test endpoint.

#### POST /api/test/chromadb
Test ChromaDB vector search.

#### POST /api/test/whisper
Test Whisper transcription.

#### POST /api/test/ai-analyzer
Test AI analyzer with custom input.

#### POST /api/test-analyzer
Test analyzer endpoint.

#### POST /api/debug/generate-word
Debug Word generation.

#### GET /test
Health check endpoint.

#### GET /architecture
Get architecture documentation.

---

## 7. Video/Audio Upload System

### 7.1 Supported File Types

#### Audio Formats
| Format | MIME Type | Extension |
|--------|-----------|-----------|
| MP3 | audio/mpeg | .mp3 |
| WAV | audio/wav | .wav |
| M4A | audio/mp4 | .m4a |
| OGG | audio/ogg | .ogg |
| FLAC | audio/flac | .flac |
| AAC | audio/aac | .aac |

#### Video Formats
| Format | MIME Type | Extension |
|--------|-----------|-----------|
| MP4 | video/mp4 | .mp4 |
| MOV | video/quicktime | .mov |
| AVI | video/x-msvideo | .avi |
| WebM | video/webm | .webm |
| WMV | video/x-ms-wmv | .wmv |

### 7.2 Upload Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT UPLOAD FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                           │
│  │ User drops   │                                                           │
│  │ file or      │                                                           │
│  │ clicks upload│                                                           │
│  └──────┬───────┘                                                           │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ react-       │     │ Validate     │     │ Create       │                │
│  │ dropzone     │────▶│ file type    │────▶│ FormData     │                │
│  │ accepts file │     │ and size     │     │ object       │                │
│  └──────────────┘     └──────────────┘     └──────┬───────┘                │
│                                                    │                        │
│                                                    ▼                        │
│                                            ┌──────────────┐                 │
│                                            │ POST to      │                 │
│                                            │ /api/audio/  │                 │
│                                            │ upload or    │                 │
│                                            │ /api/video/  │                 │
│                                            │ upload       │                 │
│                                            └──────┬───────┘                 │
│                                                    │                        │
└────────────────────────────────────────────────────│────────────────────────┘
                                                     │
                                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SERVER UPLOAD FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ Multer       │     │ Generate     │     │ Save to      │                │
│  │ middleware   │────▶│ unique       │────▶│ /uploads/    │                │
│  │ receives     │     │ filename     │     │ directory    │                │
│  │ file         │     │              │     │              │                │
│  └──────────────┘     └──────────────┘     └──────┬───────┘                │
│                                                    │                        │
│                                                    ▼                        │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ Validate     │     │ Create       │     │ Add to       │                │
│  │ with Zod     │────▶│ DB record    │────▶│ Processing   │                │
│  │ schema       │     │ (audioFiles) │     │ Queue        │                │
│  └──────────────┘     └──────────────┘     └──────┬───────┘                │
│                                                    │                        │
│                                                    ▼                        │
│                                            ┌──────────────┐                 │
│                                            │ Return JSON  │                 │
│                                            │ response     │                 │
│                                            │ with file ID │                 │
│                                            └──────────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Chunked Upload (Large Files)

For files larger than what can be uploaded in a single request, the system supports chunked uploads:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CHUNKED UPLOAD FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CLIENT:                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Generate unique uploadId                                           │  │
│  │ 2. Split file into chunks (e.g., 5MB each)                           │  │
│  │ 3. For each chunk:                                                    │  │
│  │    POST /api/projects/:id/video/upload-chunk                         │  │
│  │    { uploadId, chunkIndex, totalChunks, fileName, fileSize, chunk }  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  SERVER:                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Save chunk to: /uploads/chunks/{uploadId}/chunk_{index}           │  │
│  │ 2. If all chunks received:                                            │  │
│  │    a. Create write stream to final file                               │  │
│  │    b. Read chunks in order (0, 1, 2, ...)                            │  │
│  │    c. Write to final file                                             │  │
│  │    d. Delete chunk directory                                          │  │
│  │    e. Create DB record                                                │  │
│  │    f. Add to processing queue                                         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.4 File Storage Structure

```
/uploads/
├── audio-1735501234567-123456789.mp3    # Audio files
├── video-1735501234567-987654321.mp4    # Video files
├── chunks/                               # Temporary chunk storage
│   └── {uploadId}/
│       ├── chunk_0
│       ├── chunk_1
│       └── chunk_2
├── reference/                            # Reference documents
│   └── reference-1735501234567-111111111.docx
├── video/                                # Assembled chunked videos
│   └── {uploadId}_{fileName}.mp4
└── projects/
    └── {projectId}/
        └── solution-doc.docx             # Generated Word documents
```

### 7.5 Upload Size Limits

| Type | Limit | Configuration |
|------|-------|---------------|
| Audio/Video | 600 MB | `routes.ts` line 155 |
| Templates | 50 MB | `routes.ts` line 178 |
| Reference Documents | 50 MB | `routes.ts` line 218 |

---

## 8. AI System Architecture

### 8.1 Overview

The AI system is the core of WorkshopSolutionizer, consisting of three main components:

1. **Transcription**: OpenAI Whisper converts audio/video to text
2. **Analysis**: OpenAI GPT-4o/5 extracts structured content from transcriptions
3. **Reference Search**: ChromaDB provides semantic search on reference documents

### 8.2 OpenAI Integration

**File:** `server/openai.ts`

#### 8.2.1 Model Configuration

```typescript
export const AI_MODELS = {
  GPT: process.env.OPENAI_GPT_MODEL || "gpt-5",
  WHISPER: process.env.OPENAI_WHISPER_MODEL || "whisper-1",
  EMBEDDING: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"
};
```

#### 8.2.2 Transcription Function

```typescript
export async function transcribeAudio(audioPath: string): Promise<{ text: string; duration: number }> {
  const stats = fs.statSync(audioPath);
  const fileSizeInMB = stats.size / (1024 * 1024);
  
  let fileToTranscribe = audioPath;
  
  // Compress large files (>24MB) using FFmpeg
  if (fileSizeInMB > 24) {
    console.log(`File size (${fileSizeInMB.toFixed(2)}MB) exceeds 24MB, compressing...`);
    const compressedPath = audioPath.replace(/\.[^.]+$/, '_compressed.mp3');
    
    await new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .audioCodec('libmp3lame')
        .audioBitrate('64k')
        .audioFrequency(16000)
        .audioChannels(1)
        .output(compressedPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    
    fileToTranscribe = compressedPath;
  }
  
  // Call Whisper API
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(fileToTranscribe),
    model: AI_MODELS.WHISPER,
    response_format: "verbose_json"
  });
  
  return {
    text: response.text,
    duration: response.duration || 0
  };
}
```

**Key Points:**
- Files >24MB are auto-compressed using FFmpeg
- Compression: 16kHz mono at 64kbps
- Returns both transcription text and duration

#### 8.2.3 Workshop Content Analysis

```typescript
export async function analyzeWorkshopContent(
  transcriptionText: string,
  templateId?: number,
  projectId?: number,
  section?: string,
  subsection?: string
): Promise<NewWorkshopContent> {
  // Route to schema-based analyzer
  return await analyzeTranscript(transcriptionText, section, subsection);
}
```

### 8.3 ChromaDB Vector Store

**Files:** 
- `server/vectorStore.ts` (TypeScript interface)
- `chromadb-test.py` (Python bridge)

#### 8.3.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CHROMADB ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────┐     ┌────────────────┐     ┌────────────────┐          │
│  │   TypeScript   │     │    Python      │     │   ChromaDB     │          │
│  │   vectorStore  │────▶│    Bridge      │────▶│   Database     │          │
│  │   .ts          │     │ chromadb-test  │     │   chroma_data/ │          │
│  │                │     │    .py         │     │                │          │
│  │ - query()      │     │                │     │ - Collections  │          │
│  │ - ingest()     │     │ - spawn()      │     │ - Embeddings   │          │
│  │ - hybrid()     │     │ - JSON I/O     │     │ - Documents    │          │
│  └────────────────┘     └────────────────┘     └────────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 8.3.2 Python Bridge Function

```typescript
async function callPythonChromaDB(operation: string, params: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const args = [CHROMADB_SCRIPT_PATH, operation];
    
    // Build arguments based on operation
    switch (operation) {
      case 'query':
        args.push(params.query, params.numResults?.toString() || '3');
        break;
      case 'hybrid_query':
        args.push(
          params.query,
          JSON.stringify(params.keywords || []),
          params.n_semantic?.toString() || '5',
          params.n_keyword?.toString() || '5',
          params.embedding_model || 'text-embedding-3-small',
          params.chunk_size?.toString() || '1000',
          params.chunk_overlap?.toString() || '200'
        );
        break;
      case 'ingest':
        args.push(
          params.filePath,
          params.docName,
          params.embedding_model || 'text-embedding-3-small',
          params.chunk_size?.toString() || '1000',
          params.chunk_overlap?.toString() || '400'
        );
        break;
    }
    
    const pythonProcess = spawn('python3', args);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve(JSON.parse(stdout));
      } else {
        reject(new Error(`Python process failed: ${stderr}`));
      }
    });
  });
}
```

#### 8.3.3 Hybrid Search (Semantic + Keyword)

The hybrid search combines vector similarity with keyword matching for better results:

```typescript
export async function queryReferenceHybrid(
  query: string,
  numResults: number = 3,
  useHybrid: boolean = true,
  embeddingModel: string = 'text-embedding-3-large',
  chunkSize: number = 1000,
  chunkOverlap: number = 150
): Promise<HybridSearchResult> {
  // Extract keywords from query
  const keywords = extractKeywords(query);
  
  const result = await callPythonChromaDB('hybrid_query', {
    query,
    keywords,
    n_semantic: 5,
    n_keyword: 5,
    embedding_model: embeddingModel,
    chunk_size: chunkSize,
    chunk_overlap: chunkOverlap
  });
  
  // Post-process: filter TOC patterns, truncate long chunks
  const filteredDocs = filterTOCChunks(result.documents);
  const truncatedDocs = truncateLongChunks(filteredDocs, 2000);
  
  return {
    documents: truncatedDocs,
    sourceDocumentCount: result.source_document_count,
    uniqueSourceDocuments: result.unique_source_documents
  };
}
```

**Hybrid Search Algorithm (Python):**

```python
def hybrid_query(query_text, keywords, n_semantic=5, n_keyword=5):
    # Step 1: Semantic search using vector embeddings
    semantic_results = collection.query(
        query_texts=[query_text],
        n_results=n_semantic
    )
    
    # Step 2: Keyword-based search with heading priority
    keyword_matches = []
    for doc in all_docs:
        # Priority 1: Exact phrase match as section heading (first 600 chars)
        if phrase in doc_lower and phrase_pos < 600:
            score += 50  # High weight for heading matches
        
        # Priority 2: Individual keyword matches
        score += sum(1 for kw in keywords if kw in doc_lower)
    
    # Step 3: Combine and deduplicate
    # Semantic results first (if score >= 6.0)
    # Then keyword matches (if score >= 10)
    
    return combined_results
```

#### 8.3.4 Document Ingestion

```typescript
export async function ingestDocument(
  filePath: string, 
  docName: string,
  embeddingModel: string = 'text-embedding-3-small',
  chunkSize: number = 1000,
  chunkOverlap: number = 400
): Promise<{ success: boolean; chunks: number }> {
  // Extract text from DOCX
  let textContent: string;
  if (filePath.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ path: filePath });
    textContent = result.value;
  } else {
    textContent = fs.readFileSync(filePath, 'utf-8');
  }
  
  // Ingest via Python bridge
  const result = await callPythonChromaDB('ingest', {
    filePath: tempTextPath,
    docName,
    embedding_model: embeddingModel,
    chunk_size: chunkSize,
    chunk_overlap: chunkOverlap
  });
  
  return {
    success: result.success,
    chunks: result.chunks
  };
}
```

### 8.4 Token Budgeting System

**File:** `server/token-budgeting.ts`

The token budgeting system ensures that AI prompts fit within GPT-4o's context window (30K tokens).

#### 8.4.1 Budget Calculation

```typescript
export class TokenBudgeter {
  private static readonly TOKENS_PER_WORD = 1.3;        // GPT tokenization approximation
  private static readonly MAX_TOTAL_TOKENS = 30000;     // GPT-4o limit
  private static readonly SAFETY_BUFFER = 2000;         // Reserved for response
  private static readonly TARGET_TOKENS_PER_CHUNK = 26000;  // Conservative target
  
  static calculateBudget(transcriptText: string, globalContextText: string = ""): TokenBudget {
    const transcriptTokens = this.estimateTokens(transcriptText);
    const globalContextTokens = this.estimateTokens(globalContextText);
    const systemPromptTokens = 1000;  // Estimated overhead
    
    const availableForTemplate = this.TARGET_TOKENS_PER_CHUNK - 
                                transcriptTokens - 
                                globalContextTokens - 
                                systemPromptTokens;
    
    return {
      maxTokensPerChunk: this.TARGET_TOKENS_PER_CHUNK,
      transcriptTokens,
      globalContextTokens,
      availableForTemplate: Math.max(availableForTemplate, 6000)  // Minimum 6K
    };
  }
  
  static estimateTokens(text: string): number {
    const words = text.split(/\s+/).length;
    return Math.ceil(words * this.TOKENS_PER_WORD);
  }
}
```

#### 8.4.2 Budget Allocation

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TOKEN BUDGET (26,000 total)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Transcript: ~40-50% (~10,000-13,000 tokens)                  │   │
│  │ - Workshop recording transcription                            │   │
│  │ - Truncated to 8,000 chars if too long                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Global Context: ~5-10% (~1,300-2,600 tokens)                 │   │
│  │ - Workshop overview, key entities, constraints                │   │
│  │ - Extracted once, shared across all chunks                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ System Prompt: ~3-5% (~1,000 tokens)                         │   │
│  │ - Instructions, schema definition                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Template/Reference: ~35-50% (~9,000-13,000 tokens)           │   │
│  │ - Template sections to populate                               │   │
│  │ - Reference document chunks from ChromaDB                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Safety Buffer: ~8% (~2,000 tokens)                           │   │
│  │ - Reserved for AI response                                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.5 Template Chunking

**File:** `server/token-budgeting.ts`

When templates are too large to process in a single API call, they're split into chunks:

```typescript
export class TemplateChunker {
  static chunkBySections(
    rootSections: TemplateSection[], 
    budget: TokenBudget
  ): TemplateChunk[] {
    const chunks: TemplateChunk[] = [];
    
    for (const rootSection of rootSections) {
      const sectionTokens = this.estimateSectionTreeTokens(rootSection);
      
      if (sectionTokens <= budget.availableForTemplate) {
        // Section fits in one chunk
        chunks.push({
          id: `chunk_${rootSection.id}`,
          sections: [rootSection],
          estimatedTokens: sectionTokens,
          rootSection
        });
      } else {
        // Section too large - split by children
        const subChunks = this.splitLargeSection(rootSection, budget);
        chunks.push(...subChunks);
      }
    }
    
    return chunks;
  }
}
```

### 8.6 Chunked Analysis Pipeline

**File:** `server/chunked-analyzer.ts`

The chunked analyzer processes large templates by:
1. Generating a global context pack
2. Splitting the template into chunks
3. Processing chunks in parallel (3x concurrency)
4. Merging results

```typescript
export class ChunkedAnalyzer {
  static async analyzeWorkshopWithChunking(
    transcriptText: string,
    templateSections: TemplateSection[],
    progressCallback?: (progress: Progress) => void
  ): Promise<ChunkedAnalysisResult> {
    
    // Step 1: Generate global context pack
    progressCallback?.({ current: 1, total: 6, stage: "Generating global context pack..." });
    const globalContext = await ContextGenerator.generateGlobalContextPack(transcriptText);
    const contextText = ContextGenerator.formatContextPackForPrompt(globalContext);
    
    // Step 2: Calculate token budget
    progressCallback?.({ current: 2, total: 6, stage: "Calculating token budget..." });
    const budget = TokenBudgeter.calculateBudget(transcriptText, contextText);
    
    // Step 3: Chunk template
    progressCallback?.({ current: 3, total: 6, stage: "Chunking template sections..." });
    const chunks = TemplateChunker.chunkBySections(templateSections, budget);
    
    // Step 4: Process chunks in parallel (3 at a time)
    progressCallback?.({ current: 4, total: 6, stage: "Processing chunks with AI..." });
    const CONCURRENT_CHUNKS = 3;
    const chunkResults: ChunkResult[] = [];
    
    for (let i = 0; i < chunks.length; i += CONCURRENT_CHUNKS) {
      const batchChunks = chunks.slice(i, i + CONCURRENT_CHUNKS);
      
      const batchPromises = batchChunks.map(async (chunk) => {
        // Extract relevant excerpts
        const excerpts = ExcerptExtractor.extractRelevantExcerpts(
          chunk.sections, 
          transcriptText, 
          excerptBudget
        );
        
        // Process chunk
        return this.processChunk(chunk, contextText, excerptText);
      });
      
      const batchResults = await Promise.all(batchPromises);
      chunkResults.push(...batchResults);
      
      // Brief delay between batches
      if (i + CONCURRENT_CHUNKS < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    // Step 5: Analyze and return results
    progressCallback?.({ current: 6, total: 6, stage: "Complete!" });
    
    return {
      chunkResults,
      globalContext,
      totalTokensUsed,
      successful: true,
      partialResults: false
    };
  }
}
```

### 8.7 Global Context Pack

**File:** `server/context-generator.ts`

The global context pack extracts workshop-wide information that's reused across all chunks:

```typescript
export interface GlobalContextPack {
  workshop_overview: string;           // Brief summary
  key_entities: string[];              // Companies, products, systems
  business_constraints: string[];       // Budget, timeline, regulatory
  technical_requirements: string[];     // Integrations, performance, security
  decisions_made: string[];            // Key decisions reached
  risks_identified: string[];          // Concerns, challenges
  timeline_references: string[];       // Dates, deadlines, phases
  acronyms_definitions: Record<string, string>;  // Glossary
  style_preferences: string[];         // Terminology, approaches
  summary: string;                     // Comprehensive summary
}

export class ContextGenerator {
  static async generateGlobalContextPack(transcriptText: string): Promise<GlobalContextPack> {
    const prompt = `
      You are analyzing a workshop transcript to extract key business context...
      
      Extract and return ONLY a JSON object with:
      - workshop_overview
      - key_entities
      - business_constraints
      - technical_requirements
      - decisions_made
      - risks_identified
      - timeline_references
      - acronyms_definitions
      - style_preferences
      - summary
    `;
    
    const response = await openai.chat.completions.create({
      model: AI_MODELS.GPT,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 3000
    });
    
    return JSON.parse(response.choices[0].message.content);
  }
}
```

### 8.8 Template Analyzer

**File:** `server/template-analyzer.ts`

The main analysis function that combines transcripts with ChromaDB references:

```typescript
export async function analyzeTranscript(
  transcript: string, 
  section: string, 
  subsection?: string | null
) {
  // 1. Get schema for section
  const schema = BONSAI_SCHEMA[section];
  
  // 2. Query ChromaDB with hybrid search
  const [structureResults, contentResults] = await Promise.all([
    queryReferenceHybrid(`"${section}" "${subsection}"`, 3, true),
    queryReferenceHybrid(`"${subsection}"`, 3, true)
  ]);
  
  const referenceDocs = [...structureResults.documents, ...contentResults.documents];
  
  // 3. Build prompt
  const instruction = `
    You are an AI content generator...
    
    DATA SOURCES:
    1. **Transcript** (priority):
    ${transcript}
    
    2. **Reference Documents** (for structure only):
    ${referenceDocs.join("\n\n")}
    
    RULES:
    - Transcript takes absolute priority for facts
    - Reference docs only for format and structure
    - Never omit transcript content
    
    Schema:
    ${JSON.stringify({ [section]: schema })}
  `;
  
  // 4. Call GPT-4o
  const response = await openai.chat.completions.create({
    model: AI_MODELS.GPT,
    messages: [
      { role: "system", content: "Return ONLY JSON following schema." },
      { role: "user", content: instruction }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 6000
  });
  
  // 5. Parse and validate
  const result = JSON.parse(response.choices[0].message.content);
  
  // 6. Retry if schema mismatch
  if (!ensureSchemaKeys(result, section)) {
    // Retry with previous output...
  }
  
  return result;
}
```

---

## 9. Document Processing Pipeline

### 9.1 Processing Queue

**File:** `server/queue.ts`

The processing queue orchestrates the entire document generation workflow:

```typescript
class ProcessingQueue {
  private transcriptGroups: Map<string, TranscriptGroup> = new Map();
  
  async start() {
    console.log("Processing queue started");
    
    // Reset stuck processes on startup
    const stuckFiles = await db.select().from(audioFiles)
      .where(or(
        eq(audioFiles.status, 'transcribing'),
        eq(audioFiles.status, 'analyzing')
      ));
    
    for (const file of stuckFiles) {
      await storage.updateAudioFile(file.id, { status: 'uploaded' });
    }
    
    // Start polling
    this.processNext();
  }
  
  async processNext() {
    const [file] = await db.select().from(audioFiles)
      .where(eq(audioFiles.status, 'uploaded'))
      .limit(1);
    
    if (file) {
      await this.processAudioFile(file.id);
    }
    
    // Poll every 5 seconds
    setTimeout(() => this.processNext(), 5000);
  }
  
  async processAudioFile(audioFileId: number) {
    const audioFile = await storage.getAudioFile(audioFileId);
    
    // 1. Transcribe if needed
    if (!audioFile.transcriptionText) {
      await storage.updateAudioFile(audioFileId, { status: 'transcribing' });
      
      const audioPath = path.join(uploadDir, audioFile.filename);
      const { text, duration } = await transcribeAudio(audioPath);
      
      await storage.updateAudioFile(audioFileId, {
        transcriptionText: text,
        duration,
        status: 'transcribed'
      });
    }
    
    // 2. Group transcript
    await this.addToTranscriptGroup(
      audioFile.projectId,
      audioFile.section,
      audioFile.subsection,
      audioFile.transcriptionText,
      audioFileId
    );
    
    // 3. Check if group is complete
    const groupKey = `${audioFile.projectId}:${audioFile.section}:${audioFile.subsection || 'null'}`;
    const group = this.transcriptGroups.get(groupKey);
    
    if (group && this.isGroupComplete(group)) {
      await this.processTranscriptGroup(groupKey);
    }
  }
  
  async processTranscriptGroup(groupKey: string) {
    const group = this.transcriptGroups.get(groupKey);
    
    // Merge transcripts
    const mergedTranscript = group.transcripts
      .map((t, i) => `=== Recording ${i + 1} ===\n${t}`)
      .join("\n\n");
    
    // Analyze
    await storage.updateAudioFile(group.audioFileIds[0], { status: 'analyzing' });
    
    const result = await analyzeTranscript(
      mergedTranscript,
      group.section,
      group.subsection
    );
    
    // Create/update document
    await this.createDocumentFromAnalysis(group.projectId, result);
    
    // Generate Word document
    await this.generateProjectWordDocument(group.projectId);
    
    // Mark complete
    for (const id of group.audioFileIds) {
      await storage.updateAudioFile(id, { status: 'completed' });
    }
    
    // Clean up group
    this.transcriptGroups.delete(groupKey);
  }
  
  async generateProjectWordDocument(projectId: number) {
    const sections = loadSections(projectId);
    await generateWordDocument(sections, projectId);
  }
}

export const processingQueue = new ProcessingQueue();
```

### 9.2 Processing Status Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  uploaded   │────▶│transcribing │────▶│ transcribed │────▶│  analyzing  │────▶│  completed  │
│             │     │             │     │             │     │             │     │             │
│  File saved │     │  Whisper    │     │  Text       │     │  GPT-4o     │     │  Word doc   │
│  to disk    │     │  processing │     │  extracted  │     │  analyzing  │     │  generated  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
                                                            ┌─────────────┐
                                                            │   failed    │
                                                            │             │
                                                            │  Error      │
                                                            │  occurred   │
                                                            └─────────────┘
```

### 9.3 Transcript Grouping

Transcripts are grouped by project, section, and subsection:

```typescript
// Group key format
const groupKey = `${projectId}:${section}:${subsection || 'null'}`;

// Example groups
"1:Document Purpose:Business Overview"     // Project 1, Document Purpose section, Business Overview subsection
"1:Requirements:null"                      // Project 1, Requirements section, no specific subsection
"2:Zuora Q2R Requirements:Price to Offer"  // Project 2, Q2R section, Price to Offer subsection
```

**Merging Logic:**
```typescript
const mergedTranscript = transcripts
  .map((t, i) => `=== Recording ${i + 1} ===\n${t}`)
  .join("\n\n");

// Example merged output:
// === Recording 1 ===
// First workshop recording content...
// 
// === Recording 2 ===
// Second workshop recording content...
```

---

## 10. Word/PDF Export System

### 10.1 Word Document Generation

**File:** `server/exportWord.ts`

```typescript
export async function generateWordDocument(sections: Record<string, any>, projectId: number) {
  const bonsaiSectionNames = getBonsaiSectionNames();
  
  // Title page
  const titlePage = [
    new Paragraph({
      text: "Solution Design Document",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({
      text: `Prepared for: [Client Name]`,
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({
      text: `Prepared by: Zuora Professional Services`,
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({
      text: `Date: ${new Date().toLocaleDateString()}`,
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({ children: [], pageBreakBefore: true })
  ];
  
  // Table of contents
  const tocParas = [
    new Paragraph({
      text: "Table of Contents",
      heading: HeadingLevel.HEADING_1
    }),
    new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-3"
    }),
    new Paragraph({ children: [], pageBreakBefore: true })
  ];
  
  // Process sections
  const documentSections: (Paragraph | Table)[] = [];
  
  bonsaiSectionNames.forEach((sectionName, sectionIndex) => {
    const sectionData = sections[sectionName];
    
    // Section heading
    documentSections.push(new Paragraph({
      text: `${sectionIndex + 1}. ${sectionName}`,
      heading: HeadingLevel.HEADING_1
    }));
    
    // Subsections
    const subsectionNames = getBonsaiSubsectionNames(sectionName);
    subsectionNames.forEach((subName, subIndex) => {
      // Subsection heading
      documentSections.push(new Paragraph({
        text: `${sectionIndex + 1}.${subIndex + 1} ${subName}`,
        heading: HeadingLevel.HEADING_2
      }));
      
      // Content
      const content = sectionData?.subSections?.[subName] || "";
      documentSections.push(new Paragraph({
        children: [new TextRun({ text: content, font: "Times New Roman", size: 24 })]
      }));
    });
    
    // Page break after section
    documentSections.push(new Paragraph({ children: [], pageBreakBefore: true }));
  });
  
  // Create document
  const doc = new Document({
    sections: [{
      children: [...titlePage, ...tocParas, ...documentSections],
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ children: [PageNumber.CURRENT] })]
          })]
        })
      }
    }]
  });
  
  // Save to file
  const buffer = await Packer.toBuffer(doc);
  const wordPath = path.join(uploadDir, "projects", projectId.toString(), "solution-doc.docx");
  fs.writeFileSync(wordPath, buffer);
}
```

### 10.2 PDF Export

```typescript
app.get("/api/documents/:id/export", async (req, res) => {
  const document = await storage.getDocument(parseInt(req.params.id));
  
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${document.title}.pdf"`);
  
  doc.pipe(res);
  
  // Title
  doc.fontSize(24).text(document.title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Status: ${document.status}`, { align: 'center' });
  doc.addPage();
  
  // Content
  if (document.content) {
    const content = document.content as Record<string, any>;
    renderSection(doc, content);
  }
  
  doc.end();
});
```

### 10.3 Bonsai Schema (Document Structure)

**File:** `server/bonsaiSchema.ts`

```typescript
export const BONSAI_SCHEMA = {
  "Document Purpose": {
    "Business Overview": "",
    "Project Overview": ""
  },
  "Requirements": {
    "Business Requirements": ""
  },
  "Proposed Architecture": {
    "Architecture Overview": "",
    "Systems Involved": "",
    "Process Flow": ""
  },
  "Zuora Administration": {
    "Security Policies": "",
    "User Roles": "",
    "Tenant Profile Settings": "",
    "Notification": "",
    "Email notifications to customers": "",
    "Event Notifications": ""
  },
  "Zuora Q2R Requirements": {
    "Price to Offer": {
      "Overview": "",
      "Product Catalog": "",
      "Units of Measurement": "",
      "Currency": "",
      "Custom Fields": "",
      "Billing Periods": "",
      "Billing Rules": "",
      "Charge Types/Models": "",
      "Revenue Recognition": "",
      "Payment Terms": "",
      "Taxation Codes": "",
      "Tax Engine": "",
      "Batch Names": "",
      "Discount Settings": ""
    },
    "Lead to Quotes": { "Overview": "" },
    "Order to Subscription Management": {
      "Overview": "",
      "Create Account and Subscriptions": "",
      "Renew Subscriptions": "",
      "Downgrade Subscription": "",
      "Cancellations": "",
      "Mid-Contract Upgrade/Downgrade": ""
    },
    "Billing settings": { "Overview": "" },
    "Rating to Billing": { "Overview": "" },
    "Cash to Collections": { "Overview": "" },
    "Revenue Recognition to Finance": { "Overview": "" },
    "Record to Report": { "Overview": "" }
  },
  "Data Migration": {
    "Overview": "",
    "Account Migration": "",
    "Subscription Migration": "",
    "Payment Method Migration": ""
  },
  "Integration": {
    "Overview": "",
    "Platform Integration": "",
    "Workflow": ""
  },
  "Workflow": {
    "Overview": ""
  },
  "Assumptions/Limitations/Open Questions": {
    "Assumptions": "",
    "Limitations": "",
    "Open Questions": ""
  }
};
```

---

## 11. Frontend Architecture

### 11.1 Component Structure

```
client/src/
├── components/
│   ├── ui/                    # Base UI components (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── form.tsx
│   │   ├── input.tsx
│   │   ├── progress.tsx
│   │   ├── select.tsx
│   │   ├── tabs.tsx
│   │   └── ... (47 total)
│   │
│   ├── active-projects.tsx         # Active project list
│   ├── business-metrics-dashboard.tsx  # Business metrics
│   ├── detailed-processing-status.tsx  # Processing progress
│   ├── document-editor.tsx         # Document editing
│   ├── document-viewer.tsx         # Document viewing
│   ├── enhanced-file-upload.tsx    # Drag & drop upload
│   ├── enterprise-workshop-demo.tsx # Demo mode
│   ├── file-upload.tsx             # Basic upload
│   ├── processing-status.tsx       # Status display
│   ├── project-card-dashboard.tsx  # Project cards
│   ├── project-detail-view.tsx     # Project details
│   ├── project-manager.tsx         # Project CRUD
│   ├── quality-dashboard.tsx       # Quality metrics
│   ├── recent-documents.tsx        # Recent docs list
│   ├── reference-uploader.tsx      # Reference doc upload
│   ├── stats-cards.tsx             # Statistics display
│   ├── template-document-editor.tsx # Template editing
│   ├── template-selector.tsx       # Template selection
│   ├── template-viewer.tsx         # Template preview
│   └── workflow-timeline.tsx       # Workflow visualization
│
├── hooks/
│   ├── use-mobile.tsx         # Mobile detection
│   └── use-toast.ts           # Toast notifications
│
├── lib/
│   ├── queryClient.ts         # TanStack Query setup
│   ├── types.ts               # TypeScript types
│   └── utils.ts               # Utility functions
│
├── pages/
│   ├── dashboard.tsx          # Main dashboard
│   ├── not-found.tsx          # 404 page
│   └── TestingPage.tsx        # Testing/debug page
│
├── App.tsx                    # Root component
├── index.css                  # Global styles
└── main.tsx                   # Entry point
```

### 11.2 State Management

**TanStack Query** is used for server state management:

```typescript
// lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes
      refetchOnWindowFocus: false
    }
  }
});

export async function apiRequest(
  url: string,
  options?: RequestInit & { timeout?: number }
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options || {};
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  const response = await fetch(url, {
    ...fetchOptions,
    signal: controller.signal
  });
  
  clearTimeout(id);
  return response;
}
```

### 11.3 Key Components

#### EnhancedFileUpload Component

```typescript
// components/enhanced-file-upload.tsx
export function EnhancedFileUpload() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStages, setProcessingStages] = useState<ProcessingStage[]>([]);
  
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      const isVideo = file.type.startsWith('video/');
      const endpoint = isVideo ? "/api/video/upload" : "/api/audio/upload";
      
      formData.append(isVideo ? "video" : "audio", file);
      
      // Initialize processing stages
      setProcessingStages([
        { stage: "File Upload", status: 'processing' },
        { stage: "Transcription", status: 'pending' },
        { stage: "Content Analysis", status: 'pending' },
        { stage: "Document Generation", status: 'pending' },
        { stage: "Quality Assessment", status: 'pending' }
      ]);
      
      const response = await apiRequest(endpoint, {
        method: "POST",
        body: formData,
        timeout: 300000
      });
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/audio'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    }
  });
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => uploadMutation.mutate(files[0]),
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'],
      'video/*': ['.mp4', '.mov', '.avi', '.webm', '.wmv']
    },
    maxFiles: 1,
    maxSize: 600 * 1024 * 1024
  });
  
  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {/* UI */}
    </div>
  );
}
```

### 11.4 Dashboard Layout

```typescript
// pages/dashboard.tsx
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header>...</header>
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <ProcessingStatus />
            <DocumentEditor />
            <ActiveProjects />
            <RecentDocuments />
          </TabsContent>
          
          <TabsContent value="projects">
            <ProjectCardDashboard />
          </TabsContent>
          
          <TabsContent value="upload">
            <EnhancedFileUpload />
            <ReferenceUploader />
          </TabsContent>
        </Tabs>
      </div>
      
      <footer>...</footer>
    </div>
  );
}
```

---

## 12. Error Handling & Recovery

### 12.1 Processing Queue Recovery

On startup, stuck processes are automatically reset:

```typescript
async start() {
  // Find files stuck in processing states
  const stuckFiles = await db.select().from(audioFiles)
    .where(or(
      eq(audioFiles.status, 'transcribing'),
      eq(audioFiles.status, 'analyzing')
    ));
  
  // Reset to 'uploaded' for reprocessing
  for (const file of stuckFiles) {
    await storage.updateAudioFile(file.id, { status: 'uploaded' });
    console.log(`Reset stuck file ${file.id} from ${file.status} to uploaded`);
  }
}
```

### 12.2 AI Analysis Retry Logic

**File:** `server/template-analyzer.ts`

```typescript
async function callModelOnce(prompt: string) {
  const response = await openai.chat.completions.create({
    model: AI_MODELS.GPT,
    messages: [
      { role: "system", content: "Return ONLY JSON following schema." },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 6000
  });
  
  return JSON.parse(response.choices[0].message.content || "{}");
}

// Main analysis with retry
let parsedResult = await callModelOnce(instruction);

// Schema validation
if (!ensureSchemaKeys(parsedResult, section)) {
  console.warn("Schema mismatch, retrying...");
  
  // Retry with previous output appended
  const retryInstr = instruction + "\nPrevious output:\n" + safeStringify(parsedResult, 2000);
  parsedResult = await callModelOnce(retryInstr);
}

// Final validation - fill defaults if still failing
if (!ensureSchemaKeys(parsedResult, section)) {
  console.error("Model failed schema twice, filling defaults");
  const minimal = { [section]: {} };
  Object.keys(schema).forEach(k => minimal[section][k] = "");
  return minimal;
}
```

### 12.3 Chunked Analysis Error Handling

```typescript
const batchPromises = batchChunks.map(async (chunk) => {
  try {
    const chunkResult = await this.processChunk(chunk, contextText, excerptText);
    return chunkResult;
  } catch (error) {
    console.error(`Error processing chunk ${chunk.id}:`, error);
    return {
      chunkId: chunk.id,
      content: {},
      success: false,
      error: (error as Error).message,
      tokensUsed: 0,
      sectionsProcessed: []
    };
  }
});

// Partial results are still useful
const successful = chunkResults.filter(r => r.success).length > 0;
const partialResults = chunkResults.some(r => !r.success);
```

### 12.4 Validation

**File:** `server/validation.ts`

```typescript
export class ContentValidator {
  static validateContent(content: Record<string, any>) {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required sections check
    const requiredSections = ['document_purpose', 'project_overview'];
    for (const section of requiredSections) {
      if (!content[section] || content[section].trim().length === 0) {
        errors.push(`Required section '${section}' is missing or empty`);
      }
    }
    
    // Zuora-specific validations
    const zuoraSections = ['price_to_offer', 'rating_to_billing'];
    const zuoraCount = zuoraSections.filter(s => content[s]?.length > 0).length;
    if (zuoraCount < 2) {
      warnings.push("Consider adding more Zuora implementation details");
    }
    
    return { isValid: errors.length === 0, errors, warnings };
  }
  
  static calculateQualityScore(content: Record<string, any>): QualityMetrics {
    return {
      completeness: /* 0-100 */,
      clarity: /* 0-100 */,
      technicalDepth: /* 0-100 */,
      businessAlignment: /* 0-100 */,
      overallScore: /* average */
    };
  }
}
```

---

## 13. File Structure

```
WorkshopSolutionizer/
├── client/                          # Frontend application
│   ├── src/
│   │   ├── assets/                  # Static assets
│   │   │   └── estuate-logo.svg
│   │   ├── components/              # React components
│   │   │   ├── ui/                  # Base UI components (47 files)
│   │   │   └── *.tsx                # Feature components (21 files)
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── lib/                     # Utilities and config
│   │   ├── pages/                   # Page components
│   │   ├── App.tsx                  # Root component
│   │   ├── index.css                # Global styles
│   │   └── main.tsx                 # Entry point
│   └── index.html                   # HTML template
│
├── server/                          # Backend application
│   ├── bonsaiSchema.ts              # Document schema definitions
│   ├── business-integration.ts      # Business logic
│   ├── chunked-analyzer.ts          # Parallel chunk processing
│   ├── context-generator.ts         # Global context extraction
│   ├── db.ts                        # Database connection
│   ├── documentStore.ts             # JSON document storage
│   ├── error-handling.ts            # Error utilities
│   ├── excerpt-extractor.ts         # Transcript excerpt extraction
│   ├── exportWord.ts                # Word document generation
│   ├── index.ts                     # Server entry point
│   ├── openai.ts                    # OpenAI integration
│   ├── queue.ts                     # Processing queue
│   ├── referenceDoc.json            # Reference data
│   ├── result-merger.ts             # Chunk result merging
│   ├── routes.ts                    # API routes (3000+ lines)
│   ├── schemas.ts                   # Validation schemas
│   ├── simple-analyzer.ts           # Simple analysis fallback
│   ├── storage.ts                   # Database storage layer
│   ├── template-analyzer.ts         # Main AI analyzer
│   ├── template-parser.ts           # DOCX template parsing
│   ├── template-preprocessor.ts     # Template pre-chunking
│   ├── token-budgeting.ts           # Token management
│   ├── validation.ts                # Content validation
│   ├── vectorStore.ts               # ChromaDB integration
│   ├── vite.ts                      # Vite middleware
│   └── zuora-template-parser.ts     # Zuora-specific parsing
│
├── shared/                          # Shared code
│   ├── schema.ts                    # Database schema (Drizzle)
│   └── sectionsConfig.ts            # Section configuration
│
├── migrations/                      # Database migrations
│   ├── meta/
│   │   └── _journal.json
│   └── 0000_rare_starjammers.sql
│
├── chroma_data/                     # ChromaDB storage
│   ├── {collection-id}/
│   │   ├── data_level0.bin
│   │   ├── header.bin
│   │   ├── length.bin
│   │   └── link_lists.bin
│   └── chroma.sqlite3
│
├── uploads/                         # File uploads (gitignored)
│   ├── audio-*.mp3
│   ├── video-*.mp4
│   ├── reference/
│   ├── chunks/
│   └── projects/{projectId}/
│       └── solution-doc.docx
│
├── attached_assets/                 # Sample documents
│
├── chromadb-test.py                 # Python ChromaDB bridge
├── drizzle.config.ts                # Drizzle ORM config
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── vite.config.ts                   # Vite config
├── tailwind.config.ts               # Tailwind config
├── postcss.config.js                # PostCSS config
└── components.json                  # shadcn/ui config
```

---

## Appendix A: Complete API Endpoint List

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/audio/upload | Upload audio file |
| POST | /api/video/upload | Upload video file |
| POST | /api/projects/:id/audio/upload | Upload audio to project |
| POST | /api/projects/:id/video/upload | Upload video to project |
| POST | /api/projects/:id/video/upload-chunk | Chunked video upload |
| POST | /api/reference/upload | Upload reference document |
| GET | /api/reference/list | List reference documents |
| GET | /api/reference/view/:docName | View reference document |
| DELETE | /api/reference/delete/:docName | Delete reference document |
| POST | /api/projects | Create project |
| GET | /api/projects | List all projects |
| GET | /api/projects/active | Get active projects |
| GET | /api/projects/with-stats | Get projects with statistics |
| GET | /api/projects/:id | Get project |
| PATCH | /api/projects/:id | Update project |
| DELETE | /api/projects/:id | Delete project |
| PATCH | /api/projects/:id/archive | Archive project |
| PATCH | /api/projects/:id/restore | Restore project |
| GET | /api/projects/:id/audio | Get project audio files |
| GET | /api/projects/:id/documents | Get project documents |
| GET | /api/projects/:id/templates | Get project templates |
| POST | /api/projects/:id/templates | Create template |
| POST | /api/projects/:id/templates/upload | Upload template |
| POST | /api/projects/:projectId/generate-document | Generate document |
| HEAD | /api/projects/:projectId/document/download | Check Word doc exists |
| GET | /api/projects/:projectId/document/download | Download Word doc |
| GET | /api/audio | List all audio files |
| POST | /api/audio/:id/process | Process audio file |
| POST | /api/audio/:id/reprocess | Reprocess audio file |
| GET | /api/documents | List documents |
| POST | /api/documents | Create document |
| GET | /api/documents/:id | Get document |
| PATCH | /api/documents/:id | Update document |
| DELETE | /api/documents/:id/delete | Delete document |
| POST | /api/documents/:id/reset-processing | Reset processing |
| POST | /api/documents/:id/merge-with/:targetId | Merge documents |
| GET | /api/documents/:id/export | Export as PDF |
| GET | /api/documents/:id/quality | Get quality metrics |
| GET | /api/documents/:id/workflow | Get workflow status |
| POST | /api/documents/:id/validate | Validate document |
| PATCH | /api/documents/:id/enhanced | Enhanced update |
| POST | /api/documents/:id/regenerate | Regenerate document |
| GET | /api/templates/:id/preview | Preview template |
| GET | /api/stats | Get statistics |
| GET | /api/business/metrics | Get business metrics |
| HEAD | /api/document/download | Check Word doc (legacy) |
| GET | /api/document/download | Download Word doc (legacy) |
| POST | /api/test-post | Test POST |
| POST | /api/test/chromadb | Test ChromaDB |
| POST | /api/test/whisper | Test Whisper |
| POST | /api/test/ai-analyzer | Test AI analyzer |
| POST | /api/test-analyzer | Test analyzer |
| POST | /api/debug/generate-word | Debug Word gen |
| GET | /test | Health check |
| GET | /architecture | Architecture docs |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Bonsai Schema** | The predefined document structure for Zuora solution design documents |
| **ChromaDB** | Open-source vector database used for semantic search |
| **Chunked Analysis** | Processing large templates by splitting into smaller chunks |
| **Global Context Pack** | Workshop-wide context extracted once and shared across chunks |
| **Hybrid Search** | Combining semantic (vector) search with keyword matching |
| **Q2R** | Quote-to-Revenue, a Zuora business process |
| **Token Budget** | Allocated token count for each component of an AI prompt |
| **Transcript Group** | Collection of transcripts for the same project/section/subsection |
| **Whisper** | OpenAI's speech-to-text model |

---

*End of Technical Documentation*
