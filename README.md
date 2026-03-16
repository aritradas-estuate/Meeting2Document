# MeetingsToDocument

AI-powered application that transforms meeting recordings from Google Drive into structured documents.

## Features

- Google OAuth integration with Drive access
- Browse and select meeting recordings from Shared Drives
- AI-powered transcription (AssemblyAI)
- Structured information extraction and synthesis (OpenAI GPT-5.4)
- AI-assisted section writing and review (Claude Opus 4.6)
- Real-time updates across all connected clients
- Export to Google Docs

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Convex (database, functions, real-time sync) |
| **Frontend** | React 19, TanStack Router, Tailwind v4, shadcn/ui |
| **Auth** | Convex Auth with Google OAuth |
| **AI** | OpenAI GPT-5.4, Claude Opus 4.6, AssemblyAI |
| **Storage** | Google Drive API |

## Prerequisites

- **Node.js 18+** with [bun](https://bun.sh/) package manager
- **Convex account** - [convex.dev](https://convex.dev)
- **Google Cloud Console project** with OAuth 2.0 credentials
- **AssemblyAI API key** - [assemblyai.com](https://assemblyai.com)
- **OpenAI API key** - [platform.openai.com](https://platform.openai.com)
- **Anthropic API key** - [console.anthropic.com](https://console.anthropic.com)

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd MeetingsToDocumet
```

### 2. Set Up Google Cloud OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth 2.0 Client IDs**
6. Configure the OAuth consent screen if prompted
7. Set application type to **Web application**
8. Add authorized redirect URIs (check Convex Auth docs for specifics)
9. Copy the **Client ID** and **Client Secret**

### 3. Set Up Backend (Convex)

```bash
cd Backend

# Install dependencies
bun install

# Copy and configure environment
cp .env.example .env.local
# Edit .env.local with your API keys and model selections

# Start Convex dev server (will prompt for login/project setup)
bunx convex dev
```

Set the same backend environment variables in Convex for your deployment, either in the dashboard or with the CLI:
- `npx convex env set --from-file .env.convex`
- `npx convex env set --prod --from-file .env.convex`

Required backend environment variables:
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
- Use `Backend/.env.local` for local development.
- Keep a deployment-specific env file such as `Backend/.env.convex` if you want to sync values with `npx convex env set --from-file ...` without including local-only variables.

### 4. Set Up Frontend

In a new terminal:

```bash
cd Frontend

# Install dependencies
bun install

# Create environment file
echo "VITE_CONVEX_URL=<your-convex-url>" > .env

# Start the frontend dev server
bun run dev
```

Frontend will be available at http://localhost:3000

## Project Structure

```
MeetingsToDocumet/
├── Backend/
│   ├── convex/
│   │   ├── _generated/       # Auto-generated Convex files
│   │   ├── schema.ts         # Database schema
│   │   ├── auth.ts           # Auth configuration
│   │   ├── users.ts          # User queries/mutations
│   │   ├── projects.ts       # Project CRUD
│   │   ├── jobs.ts           # Job processing
│   │   ├── documents.ts      # Document management
│   │   ├── actions/          # External API integrations
│   │   │   └── drive.ts      # Google Drive API
│   │   └── lib/              # Shared utilities
│   ├── package.json
│   └── .env.example
│
├── Frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── lib/              # Utilities
│   │   ├── routes/           # TanStack Router pages
│   │   ├── stores/           # State management
│   │   └── types/            # TypeScript types
│   ├── convex/               # Symlink to backend_JS/convex
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

## Development Commands

### Backend (Convex)

```bash
cd Backend

# Start dev server with hot reload
bunx convex dev

# Deploy to production
bunx convex deploy

# View logs
bunx convex logs

# Open dashboard
bunx convex dashboard
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

## Processing Pipeline

1. **Select Files** - User browses Google Drive and selects video files
2. **Create Job** - Job created in Convex database
3. **Transcription** - AssemblyAI processes audio with speaker diarization
4. **Extraction** - GPT-5.4 extracts structured information (decisions, action items, etc.)
5. **Document Generation** - Claude Opus 4.6 writes and reviews document sections
6. **Complete** - Results stored, UI updates in real-time

## Troubleshooting

### "Invalid redirect URI" error
Check your Google Cloud Console OAuth settings match your Convex auth configuration, and ensure `REDIRECT_ALLOWED_ORIGINS` includes every approved app origin.

### Convex connection issues
Make sure `VITE_CONVEX_URL` in Frontend/.env matches your Convex deployment URL.

### Google Drive access issues
Ensure the Google Drive API is enabled and OAuth scopes include Drive access.
