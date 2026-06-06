# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Puzzle Canvas is an infinite canvas app for bookmarking URLs, images, and videos by pasting or drag-and-drop. Built with React 19 + @xyflow/react on the frontend and Hono + Bun on the backend, with SQLite via Drizzle ORM.

The UI language is **Chinese** — all user-facing strings, comments, and README are in Chinese. Maintain this convention.

## Development Commands

```bash
bun install              # Install dependencies
bun run db:push          # Initialize/migrate SQLite database (puzzle-canvas.db)
bun run dev:all          # Start both frontend (Vite :5175) and backend (Hono :3001)
bun run dev              # Frontend only (Vite dev server)
bun run dev:server       # Backend only (bun --hot server/index.ts)
bun run build            # Type-check + production build (tsc -b && vite build)
bun run lint             # ESLint
bun run db:generate      # Generate Drizzle migration files
bun run db:migrate       # Run Drizzle migrations
bun run db:studio        # Open Drizzle Studio (DB GUI)
```

### Testing

Two separate test runners — **do not mix them**:

```bash
bun run test             # Frontend unit tests (vitest + jsdom) — src/**/*.test.{ts,tsx}
bun run test:watch       # Frontend tests in watch mode
bun run test:server      # Backend tests (bun:test) — server/__tests__/**/*.test.ts
```

- Frontend tests use **vitest** with jsdom environment. Setup in `src/test-setup.ts` (mocks `URL.createObjectURL`, `crypto.subtle.digest`).
- Backend tests use **bun:test**. Setup in `server/__tests__/setup.ts`.
- All test files live next to their source (`src/utils/*.test.ts`) or in `server/__tests__/` mirroring the `server/` directory structure.
- Run a single frontend test: `bunx vitest run src/utils/layout.test.ts`
- Run a single backend test: `bun test server/__tests__/routes/nodes.test.ts`

Production mode: the Hono server at `server/index.ts` serves both the API and the built `dist/` static files on port 3001.

## Architecture

### Frontend (src/)

- **Single-page canvas** — no router. The entire UI is a ReactFlow canvas.
- **`App.tsx`** wraps the `Canvas` component in `ReactFlowProvider`. `Canvas` is a thin orchestrator that composes stores, hooks, and child components.
- **State management** — **zustand** stores in `src/stores/`:
  - `canvasStore` — nodes, selection, interaction mode, loading/initialized state
  - `uiStore` — dark mode, AI modal state, settings modal, error toast
  - `inputStore` — keyboard (spaceHeld) and mouse position tracking
  - `authStore` — auth/account state
- **Custom hooks** in `src/hooks/` bridge ReactFlow hooks with zustand stores:
  - `useCanvasActions` — event bridge (paste, drop, viewport) composing useNodeActions + useDownload
  - `useNodeActions` — URL creation, file upload orchestration, AI generation (needs `screenToFlowPosition`)
  - `useDownload` — selected node download (pure fetch, no ReactFlow dependency)
  - `useInputListeners` — window event listeners for mouse/keyboard + system theme changes
  - `useNodeLoader` — initial node loading from backend
  - `useSelectionToolbar` — computes floating toolbar position
- **Icon system** — React Context in `src/icons/` with pluggable registries (fluent, lucide, antd). `useAppIcon(name)` returns the current icon set's component.
- **Custom node types** in `src/components/` — `UrlNode` (bookmark card), `MediaNode` (image/video, differentiated by `data.type`), `DocNode` (file with extension-based icon). Toolbars: `ModeToolbar` (right-side), `SelectionToolbar` (floating, batch ops). Modals: `AIModal`, `SettingsModal` with `IconPanel`.
- **Styling**: CSS split into `src/styles/` (variables, toolbar, modal, nodes, canvas). Dark mode uses `html.dark` class toggled on `<html>`. CSS custom property `--node-width: 320px` controls node sizing.
- **Utility modules** in `src/utils/`: `constants.ts`, `layout.ts` (waterfall/masonry), `media.ts` (height pre-computation), `upload.ts` (chunked upload), `api.ts` (backend persistence), `validation.ts` (file/URL validation), `format.ts`.
- **React Compiler** is enabled via `@rolldown/plugin-babel` with `reactCompilerPreset()` in `vite.config.ts`.

### Backend (server/)

The backend is modular — routes, utilities, and DB layer are in separate files:

```
server/
  index.ts          # Hono app setup: CORS, error handler, route registration, static serving
  routes/
    nodes.ts        # Node CRUD endpoints
    upload.ts       # Chunked file upload endpoints
    metadata.ts     # OG metadata scraping
    ai.ts           # AI image generation
  utils/
    upload.ts       # Upload helpers (chunk handling, SHA-256 fingerprinting)
  db/
    index.ts        # Database connection
    schema.ts       # Drizzle schema (all tables)
```

**API endpoints**:
- `GET /api/nodes` — list all nodes
- `POST/PATCH/DELETE /api/nodes[/:id]` — node CRUD
- `POST /api/upload/*` — chunked file upload (init → chunk → complete/cancel)
- `GET /api/metadata?url=` — OG metadata scraping
- AI generation endpoint via `ai.ts`

**Database schema** (`server/db/schema.ts`) — 4 tables:
- `nodes` — polymorphic canvas nodes (urlNode/imageNode/videoNode/docNode). Nullable type-specific columns: `url`/`title`/`description`/`image`/`favicon` for URL nodes; `src`/`fileName`/`fileSize` for media/doc nodes. Each node has a `userId` FK.
- `users` — accounts with email, username, passwordHash, role (admin/member), status.
- `accounts` — OAuth/credential provider links with token storage.
- `refresh_tokens` — JWT refresh tokens (revocable, cascade-deleted with user).

Drizzle config is in `drizzle.config.ts` — SQLite dialect, schema at `./server/db/schema.ts`, DB file `puzzle-canvas.db`.

### Key Technical Details

- **Chunked upload**: 5MB chunks, SHA-256 fingerprinting for deduplication, exponential backoff retry (3 attempts), `AbortController`-based cancellation, 800MB max file size.
- **Node positioning**: new nodes use viewport-aware calculations (current zoom and pan offset). Drag-and-drop nodes auto-arrange in a waterfall layout.
- **Stale closure solution**: zustand's `getState()` in async callbacks always reads the latest state — no refs needed.
- **Node IDs**: `crypto.randomUUID()` for collision-free identifiers.
- **Selection**: Space+drag for box selection, Shift+click for toggle. Floating toolbar for batch organize/download/delete.
- **Vite proxy**: in dev, `/api` and `/uploads` are proxied to the Hono backend at `localhost:3001` with a 60s timeout on `/api`.
