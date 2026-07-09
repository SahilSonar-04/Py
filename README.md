# Py — LLM Workflow Builder

A focused clone of the Galaxy.ai workflow builder, scoped to LLM workflows: auth → dashboard → canvas, four node types (Request-Inputs, Crop Image, Gemini, Response), Trigger.dev-driven execution, Postgres-backed history.

## Stack

Next.js (App Router, TS strict) · Clerk · Prisma + Neon Postgres · React Flow · Zustand · Zod · Trigger.dev v3 SDK · `@google/generative-ai` · `fluent-ffmpeg` (shells out to real `ffmpeg`/`ffprobe`, Crop Image) · Tailwind v4 · Lucide React

## Quick start

### 1. Install

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in real values:

```bash
cp .env.example .env.local
```

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | clerk.com → your app → API Keys |
| `DATABASE_URL` | Neon dashboard → connection string (use the pooled one) |
| `TRIGGER_SECRET_KEY` | trigger.dev → project settings → API keys |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio → Get API Key |
| `TRANSLOADIT_*` | transloadit.com (see upload note below) |
| `USE_LOCAL_UPLOAD_FALLBACK` | `false` by default (real Transloadit required); set `true` to store uploads under `public/uploads/` instead, for local testing without Transloadit credentials |
| `NEXT_PUBLIC_CANDIDATE_LINKEDIN` | your LinkedIn profile URL |

Note: the Trigger.dev **project ref** (`proj_...`) is not an env var — it's hardcoded in `trigger.config.ts`. Only the secret key comes from `.env.local`.

**Image uploads**: with `USE_LOCAL_UPLOAD_FALLBACK=false` (the shipped default), real `TRANSLOADIT_AUTH_KEY` / `TRANSLOADIT_AUTH_SECRET` are required — this matters in particular for the Crop Image task, whose Trigger.dev runner has no shared filesystem with Vercel or your local machine and can only read/write images via real http(s) URLs.

### 3. Database

```bash
npx prisma generate
npx prisma db push   # or `npx prisma migrate dev` if you want migration history
```

If `prisma generate` fails to fetch engine binaries, that's a network/proxy issue on whatever machine you're running it on (it needs outbound HTTPS to `binaries.prisma.sh`), not a code problem.

### 4. Install ffmpeg locally

Crop Image shells out to real `ffmpeg`/`ffprobe` via `fluent-ffmpeg`. In production this is provisioned automatically by the `aptGet({ packages: ["ffmpeg"] })` build extension in `trigger.config.ts` (see [Deploying](#deploying) below) — but that extension only runs on a deployed Trigger.dev build, **not** on `trigger.dev dev`. For local development you need the real binaries on your own machine's `PATH`:

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg

# Windows — install from ffmpeg.org and add to PATH
```

### 5. Run the app

Two processes, two terminals:

```bash
npm run dev                 # Next.js app (dashboard, canvas, API routes)
npx trigger.dev@latest dev  # Trigger.dev task runner — required for Crop Image / Gemini to actually execute
```

Without the second one running, "Run" does nothing — there's no task runner to receive the trigger calls.

## Deploying

This project has **two separate deployment surfaces** — pushing to `main` only covers one of them automatically.

- **Vercel** (the Next.js app: dashboard, canvas, API routes, auth) auto-builds/deploys on every push, if the repo is connected. Env vars for this side live in Vercel's project settings.
- **Trigger.dev** (the task runtime: `crop-image.ts`, `gemini.ts`, `orchestrator.ts`) does **not** deploy with Vercel. It runs on Trigger.dev's own cloud infrastructure and needs its own deploy step:

  ```bash
  npx trigger.dev@latest deploy
  ```

  This is what actually builds the deployed task image and installs `ffmpeg` via `aptGet` (see `trigger.config.ts`). Env vars for this side (`DATABASE_URL`, Gemini key, Transloadit keys, etc.) must be set separately in the Trigger.dev dashboard's Environment Variables — Vercel's env vars are not visible to Trigger.dev's runners.

  If you want Trigger.dev deploys automated on push too, set up their GitHub Actions integration (a `TRIGGER_ACCESS_TOKEN` secret + workflow file) — check trigger.dev's CI docs, since this isn't wired up by default here.

## Architecture notes

- **Graph storage**: the full React Flow graph (nodes + edges) is stored as a single JSON column on `Workflow.graph`. This was a deliberate simplification for the time budget — normalizing nodes/edges into their own tables would be the next step for a production version, but JSON keeps reads/writes trivial and the graph is never queried piecemeal.
- **Execution model**: `src/trigger/orchestrator.ts` resolves the DAG via a promise-per-node graph — each node `await`s only its direct upstream dependencies, so independent branches genuinely execute concurrently and a finished node fans out to dependents immediately, without waiting on unrelated siblings at the same nominal "level." Selective runs (single-node / multi-select) pass a `targetNodeIds` set; nodes outside that set are skipped and their last-cached output is passed through so downstream nodes in scope still resolve correctly.
- **Crop Image**: implemented with `fluent-ffmpeg`, shelling out to real `ffmpeg`/`ffprobe` binaries (per the spec's "FFmpeg via Trigger.dev" requirement). The task downloads the input image to a scratch file (`os.tmpdir()`), runs `ffprobe` to read its dimensions, applies ffmpeg's `crop=w:h:x:y` filter (a still image is a 1-frame video to ffmpeg), then uploads the result via Transloadit — plus the mandatory hard `wait.for({ seconds: 31 })`. See [Deploying](#deploying) for how the binaries get provisioned in production.
- **Type-safe connections**: handle data types (text/image/video/audio/file/number/boolean/any) are checked client-side in the Zustand store's `onConnect` before an edge is created; incompatible drags are silently rejected. DAG-only is enforced both client-side (cycle check before adding an edge) and server-side (orchestrator throws on cycle detection as a safety net).
- **History**: every node execution within a run is written to `NodeExecution` as it happens (not batched at the end), so the history panel's polling reflects live progress, including the pulsing glow on currently-running nodes.

## Known limitations / deviations from spec

- **Gemini node's Settings section is visual only.** The collapsed Settings panel on the Gemini node (temperature / max tokens / top-p, see `src/components/canvas/nodes/gemini-node.tsx`) renders and stores values in node data, but nothing in `src/trigger/gemini.ts` reads them into the actual `generateContent` call — every run uses the SDK's defaults regardless of what's set in the UI.
- **History panel's "API Runs" tab is a placeholder.** See `src/components/canvas/history-panel.tsx` — it shows a static "not tracked yet" message. There's currently no mechanism distinguishing API-triggered runs from UI-triggered runs; every run in the history list today originated from the canvas UI.
- Undo/redo is a simple snapshot stack (50 entries), not a command/diff pattern — fine for this scope, would need revisiting for very large graphs.
- The node picker's Video/Audio categories show disabled placeholder entries to match the reference UI's categorization, since only Crop Image and Gemini 3.1 Pro are required to be functional per spec.

## Sample workflow

From the dashboard, click **Load Sample Workflow** to create a pre-built workflow matching the spec exactly: Request-Inputs (text + image fields) → two parallel Crop Image nodes + a Gemini copywriter node → a condenser Gemini node → a final Gemini node combining everything → Response.