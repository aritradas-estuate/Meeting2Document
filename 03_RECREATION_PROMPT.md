# WorkshopSolutionizer - Recreation Specification

**A comprehensive prompt/specification for recreating this application from scratch.**

---

## Project Overview

### Goal
Build an AI-powered web application that converts workshop recordings (audio/video) into structured professional documents. The system should transcribe recordings, analyze content using AI, and generate formatted Word documents following a predefined schema.

### Target Users
- Implementation consultants who conduct client workshops
- Solution architects documenting technical requirements
- Project managers tracking documentation progress

### Core Value Proposition
- **Time savings**: Reduce document creation from hours to minutes
- **Consistency**: Ensure all documents follow the same structure
- **Accuracy**: AI extracts details that might be missed manually
- **Scalability**: Handle multiple projects and recordings simultaneously

---

## Functional Requirements

### 1. File Upload System

#### 1.1 Audio Upload
- Accept audio files: MP3, WAV, M4A, OGG, FLAC, AAC
- Maximum file size: 600MB
- Store files on server filesystem
- Generate unique filenames to prevent collisions
- Associate uploads with projects (optional)
- Allow section/subsection targeting for specific document sections

#### 1.2 Video Upload
- Accept video files: MP4, MOV, AVI, WebM, WMV
- Maximum file size: 600MB
- Support chunked upload for large files
- Chunk assembly logic: receive chunks, reassemble when complete
- Same project/section association as audio

#### 1.3 Reference Document Upload
- Accept: DOCX, TXT, MD files (max 50MB)
- Ingest into vector database for semantic search
- Support document deletion
- List all uploaded reference documents

### 2. Transcription System

#### 2.1 Speech-to-Text
- Use OpenAI Whisper API for transcription
- Handle files >24MB by compressing with FFmpeg
- Compression settings: 16kHz mono, 64kbps MP3
- Return both transcript text and duration
- Store transcript in database

#### 2.2 Error Handling
- Retry failed transcriptions
- Mark files as "failed" if unrecoverable
- Log detailed error information

### 3. AI Analysis System

#### 3.1 Content Analysis
- Use OpenAI GPT-4o/5 for analysis
- Provide transcript + reference documents as context
- Output structured JSON matching document schema
- Enforce schema compliance with validation and retry

#### 3.2 Reference Document Search
- Use vector database (ChromaDB) for semantic search
- Implement hybrid search: semantic + keyword matching
- Weight: 60% semantic, 40% keyword
- Return top relevant chunks from reference documents
- Filter out table-of-contents patterns

#### 3.3 Token Management
- Estimate tokens for all prompt components
- Target 26,000 tokens per API call (leave buffer for response)
- Split large templates into processable chunks
- Process chunks in parallel (3 concurrent)

#### 3.4 Global Context
- Extract workshop-wide context once:
  - Workshop overview
  - Key entities (companies, products, systems)
  - Business constraints
  - Technical requirements
  - Decisions made
  - Risks identified
  - Timeline references
  - Acronyms/definitions
- Reuse context across all analysis chunks

### 4. Document Generation

#### 4.1 Word Document Export
- Generate properly formatted .docx files
- Include:
  - Title page
  - Table of contents
  - Numbered sections (1., 1.1, 1.1.1)
  - Page numbers in footer
  - Times New Roman font
- Page breaks between major sections
- Handle tables for structured data

#### 4.2 PDF Export
- Generate PDF documents on-demand
- Stream directly to HTTP response
- Include title, sections, content

### 5. Project Management

#### 5.1 Projects
- Create, read, update, delete projects
- Project fields: name, description, client name, status
- Status options: active, completed, on-hold, archived
- Archive/restore functionality

#### 5.2 Project Organization
- Associate audio files with projects
- Associate documents with projects
- Associate templates with projects
- Get all related data for a project

### 6. Processing Queue

#### 6.1 Queue Management
- Single-threaded queue with polling (5-second intervals)
- Reset stuck processes on startup
- Status progression: uploaded → transcribing → transcribed → analyzing → completed

#### 6.2 Transcript Grouping
- Group transcripts by project + section + subsection
- Wait for all files in group before processing
- Merge multiple transcripts with clear separation

#### 6.3 Automatic Document Generation
- Generate Word document after analysis completes
- Store in project-specific directory

### 7. Quality Assessment

#### 7.1 Content Validation
- Check for required sections
- Validate content length minimums
- Return errors and warnings

#### 7.2 Quality Scoring
- Calculate scores for:
  - Completeness (0-100)
  - Clarity (0-100)
  - Technical depth (0-100)
  - Business alignment (0-100)
  - Overall score (average)

#### 7.3 Improvement Suggestions
- Generate actionable suggestions based on scores

---

## Technical Specifications

### 1. Frontend Requirements

#### 1.1 Technology Stack
```
- React 18+ (with TypeScript)
- Vite (build tool)
- TailwindCSS (styling)
- Radix UI / shadcn/ui (component library)
- TanStack Query (server state management)
- react-dropzone (file uploads)
- Lucide React (icons)
```

#### 1.2 Pages
```
1. Dashboard (main page)
   - Overview tab: Processing status, document editor, active projects
   - Projects tab: Project card grid with CRUD
   - Quality tab: Quality metrics for selected document
   - Workflow tab: Processing timeline visualization
   - Metrics tab: Business metrics dashboard
   - Upload tab: File upload + reference upload
```

#### 1.3 Key Components

**File Upload Component**
```typescript
interface Props {
  onUploadComplete: (fileId: number) => void;
  projectId?: number;
  section?: string;
  subsection?: string;
}

Features:
- Drag and drop zone
- File type validation
- Size limit enforcement
- Progress indication
- Processing stage visualization
- Error handling
```

**Document Editor Component**
```typescript
interface Props {
  document: Document | null;
  isLoading: boolean;
}

Features:
- Display document content by section
- Edit capability
- Save changes
- Section navigation
```

**Processing Status Component**
```typescript
interface Props {
  currentStep: string;
  progress: number;
}

Features:
- Visual pipeline stages
- Progress bar
- Status icons
- Time estimates
```

#### 1.4 State Management
```typescript
// Use TanStack Query for server state
const { data: projects } = useQuery({
  queryKey: ['/api/projects'],
  refetchInterval: 2000
});

const uploadMutation = useMutation({
  mutationFn: uploadFile,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/audio'] });
  }
});
```

### 2. Backend Requirements

#### 2.1 Technology Stack
```
- Node.js 20+
- Express.js
- TypeScript
- Multer (file uploads)
- OpenAI SDK
- docx (Word generation)
- pdfkit (PDF generation)
- mammoth (DOCX text extraction)
- zod (validation)
- Drizzle ORM
```

#### 2.2 API Design

**File Upload Endpoints**
```
POST /api/audio/upload              - Upload audio file
POST /api/video/upload              - Upload video file
POST /api/projects/:id/audio/upload - Project-specific audio
POST /api/projects/:id/video/upload - Project-specific video
POST /api/projects/:id/video/upload-chunk - Chunked video
```

**Reference Document Endpoints**
```
POST   /api/reference/upload        - Upload reference doc
GET    /api/reference/list          - List all references
GET    /api/reference/view/:name    - View reference content
DELETE /api/reference/delete/:name  - Delete reference
```

**Project Endpoints**
```
POST   /api/projects                - Create project
GET    /api/projects                - List all projects
GET    /api/projects/:id            - Get project
PATCH  /api/projects/:id            - Update project
DELETE /api/projects/:id            - Delete project
GET    /api/projects/:id/audio      - Get project audio files
GET    /api/projects/:id/documents  - Get project documents
```

**Document Endpoints**
```
GET    /api/documents               - List documents
POST   /api/documents               - Create document
GET    /api/documents/:id           - Get document
PATCH  /api/documents/:id           - Update document
DELETE /api/documents/:id/delete    - Delete document
GET    /api/documents/:id/export    - Export as PDF
GET    /api/documents/:id/quality   - Get quality metrics
```

**Word Document Endpoints**
```
HEAD   /api/projects/:id/document/download - Check if exists
GET    /api/projects/:id/document/download - Download Word doc
```

**Statistics Endpoints**
```
GET    /api/stats                   - System statistics
GET    /api/business/metrics        - Business metrics
```

#### 2.3 Request/Response Formats

**Audio Upload Request**
```
POST /api/audio/upload
Content-Type: multipart/form-data

Fields:
- audio: File
- projectId: number (optional)
- section: string (optional)
- subsection: string (optional)
```

**Audio Upload Response**
```json
{
  "message": "Audio uploaded successfully",
  "file": {
    "id": 1,
    "filename": "audio-1735501234567-123456789.mp3",
    "originalName": "workshop.mp3",
    "size": 15728640,
    "mimeType": "audio/mpeg",
    "status": "uploaded",
    "projectId": 1,
    "section": "Document Purpose",
    "subsection": "Business Overview"
  }
}
```

**Project Response**
```json
{
  "id": 1,
  "name": "Acme Implementation",
  "description": "Zuora implementation project",
  "clientName": "Acme Corp",
  "status": "active",
  "createdAt": "2025-12-29T10:30:00.000Z",
  "updatedAt": "2025-12-29T10:30:00.000Z"
}
```

**Document Content Structure**
```json
{
  "Document Purpose": {
    "title": "Document Purpose",
    "subSections": {
      "Business Overview": "Content extracted from transcript...",
      "Project Overview": "Content extracted from transcript..."
    }
  },
  "Requirements": {
    "title": "Requirements",
    "subSections": {
      "Business Requirements": "Content..."
    }
  }
}
```

### 3. Database Requirements

#### 3.1 Technology
```
- PostgreSQL (recommend Neon Serverless for cloud deployment)
- Drizzle ORM for type-safe queries
- Drizzle Kit for migrations
```

#### 3.2 Schema

**users**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);
```

**projects**
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

**audio_files**
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

**document_templates**
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

**documents**
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

**document_sessions**
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

### 4. AI Integration Requirements

#### 4.1 OpenAI Configuration
```typescript
const AI_MODELS = {
  GPT: process.env.OPENAI_GPT_MODEL || "gpt-4o",
  WHISPER: process.env.OPENAI_WHISPER_MODEL || "whisper-1",
  EMBEDDING: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"
};
```

#### 4.2 Transcription Function
```typescript
async function transcribeAudio(audioPath: string): Promise<{
  text: string;
  duration: number;
}> {
  // 1. Check file size
  // 2. Compress if >24MB using FFmpeg
  // 3. Call Whisper API
  // 4. Return transcript and duration
}
```

#### 4.3 Analysis Prompt Structure
```typescript
const prompt = `
You are an AI content generator...

DATA SOURCES:
1. **Transcript** (priority):
${transcriptText}

2. **Reference Documents** (structure only):
${referenceDocuments}

RULES:
- Transcript takes absolute priority for factual content
- Reference docs only for format and structure
- Never omit topics from transcript
- Fill missing sections with "[Not discussed]"

SCHEMA:
${JSON.stringify(schema)}

OUTPUT: JSON only
`;
```

#### 4.4 Vector Store Requirements

**ChromaDB Setup**
```python
# Python bridge required for ChromaDB
import chromadb
from chromadb.utils import embedding_functions

client = chromadb.PersistentClient(path='./chroma_data')
openai_ef = embedding_functions.OpenAIEmbeddingFunction(
    api_key=os.getenv('OPENAI_API_KEY'),
    model_name="text-embedding-3-small"
)
collection = client.get_or_create_collection(
    name='reference_docs',
    embedding_function=openai_ef
)
```

**Hybrid Search Algorithm**
```python
def hybrid_query(query_text, keywords, n_semantic=5, n_keyword=5):
    # 1. Semantic search via embeddings
    semantic_results = collection.query(
        query_texts=[query_text],
        n_results=n_semantic
    )
    
    # 2. Keyword search with heading priority
    all_docs = collection.get()
    keyword_matches = []
    for doc in all_docs['documents']:
        # Priority for exact phrase matches in first 600 chars (headings)
        # Then individual keyword matches
        score = calculate_keyword_score(doc, keywords)
        if score > threshold:
            keyword_matches.append((doc, score))
    
    # 3. Combine and deduplicate
    # 4. Return sorted by relevance
```

### 5. Document Schema

#### 5.1 Predefined Structure
```typescript
const DOCUMENT_SCHEMA = {
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

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

1. **Project Setup**
   - Initialize Node.js/Express backend
   - Initialize React/Vite frontend
   - Set up PostgreSQL database
   - Configure Drizzle ORM
   - Create basic project structure

2. **Database Schema**
   - Create all tables
   - Set up migrations
   - Implement storage layer

3. **Basic API**
   - Project CRUD endpoints
   - File upload endpoints (without processing)
   - Document CRUD endpoints

### Phase 2: File Processing (Week 3-4)

4. **Upload System**
   - Multer configuration
   - File validation
   - Chunked upload support
   - File storage management

5. **Transcription**
   - OpenAI Whisper integration
   - FFmpeg compression
   - Processing queue
   - Status tracking

6. **Basic Analysis**
   - Simple GPT-4 analysis
   - JSON schema validation
   - Document storage

### Phase 3: AI Enhancement (Week 5-6)

7. **Vector Store**
   - ChromaDB setup
   - Python bridge
   - Reference document ingestion
   - Semantic search

8. **Advanced Analysis**
   - Hybrid search
   - Token budgeting
   - Template chunking
   - Parallel processing
   - Global context extraction

9. **Result Merging**
   - Chunk result combination
   - Transcript grouping
   - Multi-file support

### Phase 4: Document Generation (Week 7-8)

10. **Word Export**
    - docx library integration
    - Template formatting
    - Table of contents
    - Page numbering

11. **PDF Export**
    - pdfkit integration
    - Streaming export

12. **Quality Assessment**
    - Validation rules
    - Scoring system
    - Improvement suggestions

### Phase 5: Frontend & Polish (Week 9-10)

13. **Dashboard UI**
    - Main layout
    - Tab navigation
    - Responsive design

14. **Upload Interface**
    - Drag and drop
    - Progress tracking
    - Section selection

15. **Document Viewer/Editor**
    - Content display
    - Edit functionality
    - Download buttons

16. **Project Management UI**
    - Project cards
    - CRUD operations
    - Status management

### Phase 6: Testing & Deployment (Week 11-12)

17. **Testing**
    - Unit tests
    - Integration tests
    - End-to-end tests

18. **Deployment**
    - Production build
    - Environment configuration
    - Monitoring setup

---

## Environment Configuration

### Required Environment Variables
```env
# Database (Required)
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# OpenAI (Required)
OPENAI_API_KEY=sk-your-api-key

# Optional (with defaults)
OPENAI_GPT_MODEL=gpt-4o
OPENAI_WHISPER_MODEL=whisper-1
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### Development Setup
```bash
# Install dependencies
npm install

# Generate database
npm run db:push

# Start development
npm run dev
```

### Production Build
```bash
# Build frontend
npm run build

# Start production server
npm start
```

---

## Alternative Technology Choices

If you want to use different technologies, here are alternatives:

### Frontend Alternatives
| Original | Alternative |
|----------|-------------|
| React | Vue.js, Svelte, SolidJS |
| TailwindCSS | CSS Modules, Styled Components |
| shadcn/ui | Chakra UI, Mantine, Ant Design |
| TanStack Query | SWR, Apollo Client |

### Backend Alternatives
| Original | Alternative |
|----------|-------------|
| Express.js | Fastify, Hono, NestJS |
| Multer | Busboy, Formidable |
| docx | officegen, Carbone |

### Database Alternatives
| Original | Alternative |
|----------|-------------|
| PostgreSQL | MySQL, SQLite, MongoDB |
| Drizzle ORM | Prisma, TypeORM, Kysely |
| Neon | Supabase, PlanetScale, AWS RDS |

### AI Alternatives
| Original | Alternative |
|----------|-------------|
| OpenAI GPT | Anthropic Claude, Google Gemini |
| OpenAI Whisper | Google Speech-to-Text, AWS Transcribe |
| ChromaDB | Pinecone, Weaviate, Qdrant |

---

## Best Practices

### Error Handling
- Always wrap external API calls in try-catch
- Implement retry logic for transient failures
- Log detailed error information
- Return meaningful error messages to frontend

### Performance
- Use streaming for large file downloads
- Process chunks in parallel (limit concurrency)
- Implement caching where appropriate
- Use database indexes

### Security
- Validate all file uploads
- Sanitize file names
- Implement rate limiting
- Use parameterized queries
- Store secrets in environment variables

### Scalability
- Design for horizontal scaling
- Use job queues for heavy processing
- Consider serverless functions for spiky loads
- Implement health checks

---

## Testing Checklist

### Upload Tests
- [ ] Audio upload (various formats)
- [ ] Video upload (various formats)
- [ ] Large file upload (chunked)
- [ ] Invalid file rejection
- [ ] Size limit enforcement

### Processing Tests
- [ ] Transcription accuracy
- [ ] Analysis quality
- [ ] Reference search relevance
- [ ] Token budget compliance
- [ ] Error recovery

### Export Tests
- [ ] Word document formatting
- [ ] Table of contents
- [ ] PDF generation
- [ ] File download

### API Tests
- [ ] All CRUD operations
- [ ] Input validation
- [ ] Error responses
- [ ] Authentication (if applicable)

### UI Tests
- [ ] File drag and drop
- [ ] Form submissions
- [ ] Navigation
- [ ] Responsive design
- [ ] Error displays

---

*This specification provides everything needed to recreate WorkshopSolutionizer from scratch. Adjust technologies and implementation details as needed for your specific requirements.*
