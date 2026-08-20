# Py — Visual LLM Workflow Builder

A node-based canvas for building and running LLM workflows: drag nodes onto a graph, wire their inputs/outputs together, and execute the DAG server-side with full run history.

## Stack

- **Next.js 16** (App Router, TypeScript strict)
- **Clerk** — auth
- **Prisma + Neon Postgres** (with `pgvector` extension)
- **React Flow** — canvas/graph UI
- **Zustand** — canvas state, undo/redo, connection validation
- **Trigger.dev v3** — background task execution
- **Google Generative AI SDK** — Gemini calls + embeddings
- **fluent-ffmpeg** — real ffmpeg/ffprobe for image cropping
- **Transloadit** — image upload storage (with a local-disk fallback for dev)
- **Tailwind v4**, **Zod**, **Vitest**

## Features

### Canvas / editor
- Drag-and-drop node placement, right-click context menu to spawn nodes at cursor
- Typed connection handles (text / image / video / audio / file / number / boolean / any) — incompatible connections are rejected client-side, both visually (red dashed line while dragging) and on drop
- Cycle detection prevents non-DAG graphs, both client-side (before the edge is created) and server-side (orchestrator throws as a safety net)
- Undo/redo (50-entry snapshot stack), copy/paste, duplicate (with or without edges), lock/unlock nodes
- Multi-select with rubber-band selection mode, select-all, keyboard delete
- Auto-arrange: layered BFS layout that lays out nodes by dependency depth
- Minimap, zoom/pan controls, fit-view, keyboard shortcuts modal
- Sticky notes with color, bold, font size, and font family options
- Export/import workflows as JSON (round-trips name + full graph)

### Node types
| Node | Purpose |
|---|---|
| **Request-Inputs** | Defines the workflow's input parameters (text / number / image fields). Locked, always present. |
| **Crop Image** | Percentage-based image crop, executed via real ffmpeg (`crop=w:h:x:y`) against fetched image bytes. |
| **Gemini** | Text generation via `gemini-2.5-flash` / `gemini-2.5-pro`, with vision (multi-image), plus placeholder inputs for video/audio/file. |
| **Knowledge (RAG)** | Upload or paste a document (PDF, DOCX, TXT, MD, CSV, JSON, XML, HTML), chunk it, embed with Gemini embeddings, store in Postgres via `pgvector`, and retrieve top-K chunks by cosine similarity at query time. |
| **Agent** | Function-calling node — Gemini autonomously chooses between `search_web` and `knowledge_lookup` tools across multiple turns, with a full tool-call log persisted per run. |
| **Response** | Collects and labels outputs from any upstream node into the workflow's final result. Locked, always present. |
| **Sticky Note** | Free-floating annotation, not part of execution. |

Any numeric/text/image input on a node can be promoted to a Request-Inputs field with one click ("Add to Request"), auto-wiring the connection.

### Execution
- **Run scopes**: full workflow, a multi-selection ("partial" — everything outside the selection is skipped, not re-run), or a single node.
- **Orchestrator** (`src/trigger/orchestrator.ts`) resolves the DAG as a promise-per-node graph: each node awaits only its direct upstream dependencies, so independent branches run concurrently and a finished node fans out to dependents immediately.
- Skipped nodes (outside the run's scope) pass through their last cached output so downstream nodes still resolve correctly.
- Individual nodes can also be run in isolation from their own "Run" button, bypassing the orchestrator entirely.
- **History panel**: every node execution is written to Postgres as it happens (not batched at the end), so the UI's polling shows live progress — including a pulsing glow on currently-running nodes and per-node expandable inputs/output/error/timing.
- A workflow reconnects to its most recent run on page load and resumes polling if it's still in progress.

### Auth & data
- Clerk-gated routes via middleware; every API route re-checks `userId` ownership per-resource
- Workflows, runs, node executions, and knowledge sources are all scoped to the authenticated user
- Image uploads go through Transloadit (unexported, ~24h-expiry URLs) by default, or `public/uploads/` if `USE_LOCAL_UPLOAD_FALLBACK=true`

## Getting started

### 1. Install

```bash
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk dashboard → API Keys |
| `DATABASE_URL` | Neon dashboard → pooled connection string |
| `TRIGGER_SECRET_KEY` | Trigger.dev → project settings → API keys |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio |
| `TRANSLOADIT_AUTH_KEY` / `TRANSLOADIT_AUTH_SECRET` | transloadit.com |
| `USE_LOCAL_UPLOAD_FALLBACK` | `false` by default; set `true` to skip Transloadit and store uploads under `public/uploads/` for local testing |

The Trigger.dev **project ref** (`proj_...`) is hardcoded in `trigger.config.ts`, not an env var.

### 3. Database

```bash
npx prisma generate
npx prisma db push
```

### 4. ffmpeg (local dev only)

Crop Image shells out to real `ffmpeg`/`ffprobe`. In production this is provisioned by the `aptGet` build extension in `trigger.config.ts`, but that only runs on a deployed Trigger.dev build — for `trigger.dev dev` locally, install ffmpeg yourself:

```bash
brew install ffmpeg          # macOS
sudo apt install ffmpeg      # Ubuntu/Debian
```

### 5. Run

Two processes:

```bash
npm run dev                 # Next.js app
npx trigger.dev@latest dev  # task runner — required for any node to actually execute
```

Without the second process, clicking "Run" starts a run that will never complete.

## Deploying

Two separate deploy targets — pushing to `main` only covers one automatically:

- **Vercel** (Next.js app) auto-deploys on push if connected. Env vars live in Vercel's project settings.
- **Trigger.dev** (task runtime: `crop-image.ts`, `gemini.ts`, `knowledge.ts`, `agent.ts`, `orchestrator.ts`) needs its own deploy:
  ```bash
  npx trigger.dev@latest deploy
  ```
  Env vars for this side (`DATABASE_URL`, Gemini key, Transloadit keys) must be set separately in the Trigger.dev dashboard — Vercel's env vars aren't visible to Trigger.dev's runners.

## Project structure

```
src/
  app/
    api/                 # REST routes (workflows, runs, per-node "run single" endpoints, upload)
    dashboard/            # Workflow list
    workflows/[id]/       # Canvas page
    sign-in/, sign-up/    # Clerk auth pages
  components/
    canvas/                # React Flow wrapper, toolbars, node picker, history panel
    canvas/nodes/           # One component per node type
    dashboard/              # Dashboard list UI
  store/
    canvas-store.ts        # Zustand: nodes/edges, undo/redo, connection validation, history
  trigger/
    orchestrator.ts        # DAG resolver / dependency-aware execution
    crop-image.ts, gemini.ts, knowledge.ts, agent.ts   # Individual task definitions
  lib/
    schemas.ts             # Zod validation for all API inputs
    sample-workflow.ts      # Seed data for "Load Sample Workflow"
    workflow-io.ts          # JSON export/import
  types/workflow.ts        # Shared node/edge/data types
prisma/schema.prisma        # Workflow, WorkflowRun, NodeExecution, KnowledgeSource, KnowledgeChunk
```


## Testing

```bash
npm test
```

Covers cycle detection, connection-type compatibility, workflow JSON import/export, response-label formatting, and API input schemas.