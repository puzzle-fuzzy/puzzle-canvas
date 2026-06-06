# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Puzzle Canvas is an infinite canvas app for bookmarking URLs, images, and videos by pasting or drag-and-drop. Built with React 19 + @xyflow/react on the frontend and Hono + Bun on the backend, with SQLite via Drizzle ORM.

The UI language is **Chinese** — all user-facing strings, comments, and README are in Chinese. Maintain this convention.

## Development Commands

```bash
bun install              # Install dependencies
bun run db:push          # Initialize/migrate SQLite database
bun run dev:all          # Start both frontend (Vite :5175) and backend (Hono :3001)
bun run dev              # Frontend only (Vite dev server)
bun run dev:server       # Backend only (bun --hot server/index.ts)
bun run build            # Type-check + production build (tsc -b && vite build)
bun run lint             # ESLint
bun run db:generate      # Generate Drizzle migration files
bun run db:migrate       # Run Drizzle migrations
bun run db:studio        # Open Drizzle Studio (DB GUI)
```

Production mode: the Hono server at `server/index.ts` serves both the API and the built `dist/` static files on port 3001.

## Architecture

### Frontend (src/)

- **Single-page canvas** — no router. The entire UI is a ReactFlow canvas.
- **`App.tsx`** wraps the `Canvas` component in `ReactFlowProvider`. `Canvas` (~160 lines) is a thin orchestrator that composes stores, hooks, and child components.
- **State management** — **zustand** stores in `src/stores/`:
  - `canvasStore` — nodes, selection, interaction mode, loading/initialized state
  - `uiStore` — dark mode, AI modal state, settings modal, error toast
  - `inputStore` — keyboard (spaceHeld) and mouse position tracking
  - `authStore` — placeholder for future auth/account features
- **Custom hooks** in `src/hooks/` bridge ReactFlow hooks with zustand stores:
  - `useCanvasActions` — all async flows (paste, upload, AI generate) that need `screenToFlowPosition`/`getViewport`
  - `useInputListeners` — window event listeners for mouse/keyboard
  - `useDarkModeSync` — syncs darkMode to DOM and localStorage
  - `useNodeLoader` — initial node loading from backend
  - `useSelectionToolbar` — computes floating toolbar position
- **Icon system** — React Context in `src/icons/` with pluggable registries (fluent, lucide, antd). `useAppIcon(name)` returns the current icon set's component.
- **Custom node types** in `src/components/`:
  - `UrlNode` — bookmark card with favicon, title, description, OG image
  - `MediaNode` — shared component for both image and video nodes (differentiated by `data.type`)
  - `DocNode` — file document node with extension-based icon detection
  - `ModeToolbar` — right-side toolbar (pan/select/AI/dark mode/settings)
  - `SelectionToolbar` — floating toolbar for batch organize/download/delete
  - `AIModal` — AI image generation modal
  - `SettingsModal` — settings modal with icon panel
- **Styling**: plain CSS in `App.css` + `index.css`. Dark mode uses `html.dark` class toggled on `<html>`, with `html.dark` descendant selectors throughout `App.css`. CSS custom property `--node-width: 320px` controls node sizing.
- **React Compiler** is enabled via `@rolldown/plugin-babel` with `reactCompilerPreset()` in `vite.config.ts`.

### Backend (server/)

- **`server/index.ts`** — single-file Hono server with all REST endpoints:
  - `GET /api/nodes` — list all nodes
  - `POST/PATCH/DELETE /api/nodes[/:id]` — node CRUD
  - `POST /api/upload/*` — chunked file upload (init → chunk → complete/cancel) with SHA-256 fingerprinting, 5MB chunks, and resume support
  - `GET /api/metadata?url=` — OG metadata scraping
- **`server/db/schema.ts`** — single polymorphic `nodes` table. All node types share one table with nullable type-specific columns (`url`/`title`/`description`/`image`/`favicon` for URL nodes; `src`/`fileName`/`fileSize` for media/doc nodes).

### Key Technical Details

- **Chunked upload**: 5MB chunks, SHA-256 fingerprinting for deduplication, exponential backoff retry (3 attempts), `AbortController`-based cancellation, 800MB max file size.
- **Node positioning**: new nodes are placed using viewport-aware calculations (accounting for current zoom and pan offset). Drag-and-drop nodes auto-arrange in a waterfall layout.
- **Stale closure solution**: zustand's `getState()` replaces the old `nodesRef` mirror pattern — async callbacks always read the latest state without refs.
- **Selection**: Space+drag for box selection, Shift+click for toggle selection. A floating toolbar appears on selection for batch organize/download/delete operations.
- **Vite proxy**: in dev, `/api` and `/uploads` are proxied to the Hono backend at `localhost:3001` with a 60s timeout on `/api`.
