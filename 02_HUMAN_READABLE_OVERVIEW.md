# WorkshopSolutionizer - Overview

**A plain-English guide to understanding what this application does and how it works.**

---

## What Is This?

**WorkshopSolutionizer** is an AI-powered tool that turns workshop recordings into professional documents. Specifically, it takes audio or video recordings of client meetings and automatically creates structured **Zuora Solution Design Documents**.

Think of it as having an AI assistant that:
1. Listens to your workshop recordings
2. Understands what was discussed
3. Writes up a formal technical document

---

## Who Is It For?

- **Zuora Implementation Consultants** who conduct client workshops
- **Solution Architects** who need to document technical requirements
- **Anyone** who records meetings and needs structured documentation

---

## How Does It Work?

### The Simple Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Upload     │     │   AI        │     │    AI       │     │   Download   │
│   Recording  │────▶│   Listens   │────▶│   Writes    │────▶│   Document   │
│   (MP3/MP4)  │     │   (Whisper) │     │   (GPT-4)   │     │   (Word)     │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Step-by-Step

1. **You upload a file** - Drag and drop an audio (MP3, WAV) or video (MP4, MOV) file
2. **AI transcribes it** - OpenAI's Whisper converts speech to text
3. **AI analyzes it** - GPT-4 reads the transcript and extracts key information
4. **AI looks up references** - Searches example documents for proper formatting
5. **Document is generated** - A Word document is created with all sections filled in
6. **You download it** - Get your completed Solution Design Document

---

## Where Do Videos/Audio Come From?

**Direct upload only.** Users upload files from their computer via:
- Drag and drop
- File picker button
- Chunked upload for large files (up to 600MB)

**Supported formats:**
- Audio: MP3, WAV, M4A, OGG, FLAC, AAC
- Video: MP4, MOV, AVI, WebM, WMV

**No external sources.** The system does not pull from YouTube, Zoom, Google Drive, etc. All files must be uploaded directly.

---

## The AI System Explained

### Three AI Components

| Component | What It Does | Technology |
|-----------|--------------|------------|
| **Transcription** | Converts speech to text | OpenAI Whisper |
| **Analysis** | Extracts structured content | OpenAI GPT-4o/5 |
| **Reference Search** | Finds formatting examples | ChromaDB + Embeddings |

### How Analysis Works

1. **Transcript + References** - The AI receives both the transcription AND examples of well-written documents
2. **Structured Output** - It outputs JSON that matches a predefined document structure
3. **Priority Rules** - The transcript always takes priority over reference examples
4. **Section Focus** - Each section (Business Overview, Requirements, etc.) is analyzed separately

### The "Hybrid Search" for References

When analyzing content, the system searches for relevant reference documents using two methods:
- **Semantic Search**: "What documents are similar in meaning?"
- **Keyword Search**: "What documents contain these exact words?"

These are combined (60% semantic + 40% keyword) for best results.

---

## The Database

### What Gets Stored

| Table | What It Holds |
|-------|---------------|
| **projects** | Project name, client, status |
| **audioFiles** | Uploaded files, transcriptions, processing status |
| **documents** | Generated document content |
| **documentTemplates** | Document structure templates |
| **documentSessions** | Links between recordings and documents |
| **users** | User accounts |

### Database Technology

- **PostgreSQL** via Neon (serverless cloud database)
- **Drizzle ORM** for type-safe database queries

### Key Relationships

```
Projects
   │
   ├── Audio Files (many recordings per project)
   │
   ├── Documents (generated output)
   │
   └── Templates (document structure)
```

---

## The Document Structure

Every generated document follows this structure:

1. **Document Purpose**
   - Business Overview
   - Project Overview

2. **Requirements**
   - Business Requirements

3. **Proposed Architecture**
   - Architecture Overview
   - Systems Involved
   - Process Flow

4. **Zuora Administration**
   - Security Policies
   - User Roles
   - Notifications

5. **Zuora Q2R Requirements** (Quote-to-Revenue)
   - Price to Offer (Product Catalog, Billing, etc.)
   - Order to Subscription Management
   - Billing Settings
   - And more...

6. **Data Migration**
   - Account Migration
   - Subscription Migration
   - Payment Method Migration

7. **Integration**
   - Platform Integration
   - Workflow

8. **Assumptions/Limitations/Open Questions**

---

## Technology Stack Summary

### Frontend (What You See)
- **React** - User interface framework
- **TypeScript** - Type-safe JavaScript
- **TailwindCSS** - Styling
- **shadcn/ui** - Pre-built components

### Backend (Server)
- **Node.js + Express** - Web server
- **TypeScript** - Type-safe code
- **Multer** - File upload handling

### AI/ML
- **OpenAI Whisper** - Speech-to-text
- **OpenAI GPT-4o/5** - Text analysis
- **ChromaDB** - Vector database for search

### Database
- **PostgreSQL** (Neon Serverless)
- **Drizzle ORM** - Database queries

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Multi-file upload** | Upload multiple recordings for one project |
| **Section targeting** | Specify which document section a recording covers |
| **Transcript merging** | Multiple recordings are combined intelligently |
| **Reference documents** | Upload example documents for better formatting |
| **Quality metrics** | See completeness scores for generated content |
| **Word export** | Download as properly formatted .docx file |
| **PDF export** | Export documents as PDF |
| **Project management** | Organize work into projects with multiple recordings |

---

## Configuration Required

To run this application, you need:

```env
# Required
DATABASE_URL=postgresql://...     # PostgreSQL connection string
OPENAI_API_KEY=sk-...            # OpenAI API key

# Optional (defaults shown)
OPENAI_GPT_MODEL=gpt-5           # Can also use gpt-4o
OPENAI_WHISPER_MODEL=whisper-1   # Speech-to-text model
OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # For vector search
```

---

## Common Workflows

### Starting a New Project

1. Go to Dashboard → Projects tab
2. Click "New Project"
3. Enter project name and client info
4. Start uploading recordings

### Processing a Recording

1. Select a project
2. Choose which section the recording covers (e.g., "Business Overview")
3. Upload the audio/video file
4. Wait for processing (typically 2-5 minutes)
5. Review the generated content

### Downloading the Document

1. Go to your project
2. Click "Download Word Document"
3. Open in Microsoft Word
4. Make any final edits
5. Save and share

---

## Limitations

- **File size limit**: 600MB per file
- **Language**: English only (Whisper limitation)
- **No live recording**: Must upload pre-recorded files
- **No external sources**: No YouTube/Zoom integration
- **Processing time**: Large files may take several minutes

---

## Quick Reference

| Action | How To |
|--------|--------|
| Upload audio | Dashboard → Upload tab → Drag & drop |
| Upload reference doc | Dashboard → Upload tab → Reference Documents |
| Create project | Dashboard → Projects tab → New Project |
| Download Word doc | Project → Download button |
| Check progress | Dashboard → Overview tab |
| View quality score | Dashboard → Quality tab |

---

*This overview provides a high-level understanding. For technical details, see the full technical documentation.*
