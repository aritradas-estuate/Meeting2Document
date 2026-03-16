# MeetingsToDocument - Convex Backend

TypeScript backend powered by Convex for AI-powered document generation from meeting recordings.

## Tech Stack

- **Backend**: Convex (database, functions, scheduling)
- **Auth**: Clerk with Google OAuth
- **Transcription**: AssemblyAI
- **Extraction & synthesis**: OpenAI GPT-5.4 with structured outputs
- **Section generation**: Claude Opus 4.6
- **Storage**: Google Drive API

## Prerequisites

- Node.js 18+
- npm or bun
- Clerk account
- Google Cloud project with OAuth credentials
- AssemblyAI API key
- OpenAI API key
- Anthropic API key

## Quick Start

### 1. Install Dependencies

```bash
cd Backend
bun install
```

### 2. Set Up Clerk

1. Go to [clerk.com](https://clerk.com) and create an account
2. Create a new application
3. Enable Google OAuth provider:
   - Go to User & Authentication > Social Connections
   - Enable Google
   - Add these scopes: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/drive`
4. Create a JWT template for Convex:
   - Go to JWT Templates
   - Create new template named "convex"
   - Copy the Issuer URL

### 3. Set Up Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google Drive API
4. Go to APIs & Services > Credentials
5. Create OAuth 2.0 Client ID (Web application)
6. Add authorized redirect URIs for Clerk
7. Copy Client ID and Client Secret

### 4. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Use the `MODEL_*` variables in `.env.local` to change AI models without editing code.

### 5. Initialize Convex

```bash
npx convex dev
```

This will:
- Log you into Convex
- Create a new project (or link to existing)
- Generate the `_generated` folder
- Start the development server

### 6. Configure Convex Dashboard

Set the same backend environment variables in Convex for each deployment, either in the dashboard or with the CLI:
- `npx convex env set --from-file .env.convex`
- `npx convex env set --prod --from-file .env.convex`

Required backend environment variables:
- `CLERK_JWT_ISSUER_DOMAIN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ASSEMBLYAI_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY` (required for section generation)
- `MODEL_EXTRACTION`
- `MODEL_SYNTHESIS`
- `MODEL_SECTION_WRITER`
- `MODEL_SECTION_REVIEWER`
- `WEBHOOK_SECRET` (required for webhook processing)
- `REDIRECT_ALLOWED_ORIGINS` (comma-separated redirect origin allowlist)

Recommended workflow:
- Use `.env.local` for local development.
- Keep a deployment-specific env file such as `.env.convex` if you want to sync values with `npx convex env set --from-file ...` without including local-only variables.

## Project Structure

```
Backend/
├── convex/
│   ├── _generated/           # Auto-generated Convex files
│   ├── schema.ts             # Database schema
│   ├── auth.config.ts        # Clerk auth configuration
│   ├── http.ts               # HTTP endpoints (webhooks)
│   │
│   ├── users.ts              # User queries/mutations
│   ├── projects.ts           # Project CRUD
│   ├── jobs.ts               # Job processing
│   ├── documents.ts          # Document management
│   │
│   ├── actions/
│   │   ├── drive.ts          # Google Drive API
│   │   ├── transcription.ts  # AssemblyAI integration
│   │   └── extraction.ts     # OpenAI extraction
│   │
│   └── lib/
│       └── prompts.ts        # Extraction prompts & schemas
│
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## API Overview

### Queries (Real-time)

```typescript
// Projects
api.projects.list
api.projects.get
api.projects.getWithStats

// Jobs
api.jobs.list
api.jobs.get
api.jobs.getProgress

// Documents
api.documents.list
api.documents.get
api.documents.getWithSections
```

### Mutations

```typescript
// Projects
api.projects.create
api.projects.update
api.projects.archive
api.projects.restore
api.projects.permanentDelete

// Jobs
api.jobs.create    // Starts processing pipeline
api.jobs.cancel
api.jobs.retry

// Documents
api.documents.create
api.documents.update
api.documents.remove
```

### Actions (External APIs)

```typescript
// Google Drive
api.actions.drive.listSharedDrives
api.actions.drive.listFiles
api.actions.drive.navigate
api.actions.drive.getFile
```

## Processing Pipeline

1. **Job Created** - User selects video files
2. **Make Public** - Files temporarily made public on Drive
3. **Transcribe** - AssemblyAI processes audio (webhook notification)
4. **Fallback Poll** - If no webhook after 15 min, poll for status
5. **Extract** - OpenAI GPT-5.4 extracts structured information
6. **Generate Sections** - Claude Opus 4.6 writes and reviews document sections
7. **Revoke Access** - Public access removed from files
8. **Complete** - Results stored, UI updates in real-time

## Development Commands

```bash
# Start Convex dev server
npx convex dev

# Deploy to production
npx convex deploy

# View logs
npx convex logs

# Open dashboard
npx convex dashboard
```

## Frontend Integration

In your React frontend:

```typescript
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

function App() {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {/* Your app */}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

Using Convex queries (real-time updates automatic):

```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function ProjectList() {
  const projects = useQuery(api.projects.list, { status: "active" });
  const createProject = useMutation(api.projects.create);

  // projects updates automatically when data changes!
}
```

## Migration from Python Backend

This Convex backend replaces:
- FastAPI server
- PostgreSQL database
- Redis + Celery job queue
- Docker Compose setup

Benefits:
- Single TypeScript codebase
- Real-time updates by default
- No infrastructure to manage
- Automatic scaling
- Built-in scheduling for background jobs
