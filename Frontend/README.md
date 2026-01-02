# MeetingsToDocument - Frontend

React frontend for the AI-powered meeting transcription application.

## Tech Stack

- **Runtime**: Node.js 18+ with [bun](https://bun.sh/)
- **Framework**: React 19 with TanStack Start/Router
- **Styling**: Tailwind CSS v4, shadcn/ui
- **State**: Zustand
- **Icons**: Phosphor Icons

## Prerequisites

- Node.js 18+
- [bun](https://bun.sh/) package manager

## Quick Start

### 1. Install Dependencies

```bash
# Install bun if you haven't
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install
```

### 2. Configure Environment

Create a `.env` file:

```bash
VITE_API_URL=http://localhost:8000
```

### 3. Start Development Server

```bash
bun run dev
```

The app will be available at http://localhost:3000

## Project Structure

```
Frontend/
├── public/              # Static assets
├── src/
│   ├── components/
│   │   ├── ui/          # shadcn/ui components
│   │   └── drive/       # Google Drive browser
│   ├── lib/
│   │   ├── api.ts       # API client
│   │   └── utils.ts     # Utility functions
│   ├── routes/          # TanStack Router pages
│   │   ├── __root.tsx   # Root layout
│   │   ├── index.tsx    # Landing page
│   │   ├── dashboard.tsx
│   │   └── projects/
│   │       ├── new.tsx
│   │       └── $projectId.tsx
│   ├── stores/
│   │   └── auth.ts      # Zustand auth store
│   ├── types/
│   │   └── api.ts       # TypeScript types
│   └── styles.css       # Global styles
├── .env                 # Environment variables (create this)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Development Commands

```bash
# Start dev server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Run tests
bun run test

# Lint code
bun run lint

# Format code
bun run format
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8000` |

## Notes for AI Agents

> **IMPORTANT**: This project uses `bun` as its package manager.
> 
> - Always use `bun run <command>` to run scripts
> - Use `bun add <package>` to add dependencies
> - Use `bun install` to install dependencies
> - Do NOT use npm, yarn, or pnpm
