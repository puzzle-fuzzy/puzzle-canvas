# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Puzzle Canvas is an infinite canvas app for bookmarking URLs, images, videos, and text notes by pasting or drag-and-drop. Built with React 19 + @xyflow/react (Vite 8 with Rolldown) on the frontend and Hono + Bun on the backend, with SQLite via Drizzle ORM.

The UI language is **Chinese** — all user-facing strings, comments, and README are in Chinese. Maintain this convention.

Design principles are documented in `PRODUCT.md` — brand personality is "简洁 · 高效 · 克制" (concise, efficient, restrained). Content-first UI that recedes when not needed. Avoid decorative animations, crowded layouts, and nested card patterns.

## Development Commands

```bash
bun install              # Install dependencies
bun run db:push          # Initialize/migrate SQLite database (puzzle-canvas.db)
bun run dev:all          # Start both frontend (Vite :5175) and backend (Hono :4001)
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

- Frontend tests use **vitest** with jsdom environment. Setup in `src/test-setup.ts` (mocks `URL.createObjectURL`, `crypto.subtle.digest`, `window.matchMedia`).
- Backend tests use **bun:test**. Setup in `server/__tests__/setup.ts` provides `createTestApp()` and `createAuthenticatedTestApp()` factories with in-memory SQLite and dependency injection.
- All test files live next to their source (`src/utils/*.test.ts`) or in `server/__tests__/` mirroring the `server/` directory structure.
- Run a single frontend test: `bunx vitest run src/utils/layout.test.ts`
- Run a single backend test: `bun test server/__tests__/routes/nodes.test.ts`

Production mode: the Hono server at `server/index.ts` serves both the API and the built `dist/` static files on port 4001.

## Architecture

### Frontend (src/)

- **Single-page canvas** — no router. The entire UI is a ReactFlow canvas.
- **`App.tsx`** wraps `Canvas` in `ReactFlowProvider` + `IconProvider`. `Canvas` composes stores, hooks, and registers 6 custom node types (`urlNode`, `imageNode`, `videoNode`, `docNode`, `textNode`, `groupNode`).
- **State management** — **zustand** stores in `src/stores/`:
  - `canvasStore` — nodes, selection, interaction mode, loading/initialized state. `onNodesChange` intercepts ReactFlow changes to fire persistence (delete → `persistNodeDelete` + `cancelUpload`; drag-end → `persistNodePosition`).
  - `uiStore` — dark mode, modals (AI, settings, login, fullscreen preview, share, import), error toast, theme color (synced to CSS custom properties), toolbar icon size, text preview content.
  - `inputStore` — keyboard (`spaceHeld`) and mouse position tracking.
  - `authStore` — user state, access token (in-memory only, never persisted to localStorage). Refresh token managed via httpOnly cookie.
- **Custom hooks** in `src/hooks/` bridge ReactFlow hooks with zustand stores:
  - `useCanvasActions` — event bridge (paste, drop, viewport save) composing `useNodeActions` + `useDownload`.
  - `useNodeActions` — URL node creation (fetches OG metadata), text node creation from paste, file upload with progress nodes, AI generation.
  - `useDownload` — batch download selected media/doc nodes.
  - `useInputListeners` — window event listeners for mouse/keyboard + system theme changes.
  - `useNodeLoader` — initial load (`checkAuth()` → `loadNodes()`), visibility-change token refresh.
  - `useSelectionToolbar` — computes floating toolbar position from selected nodes' bounding box.
  - `useFocusTrap` — generic focus trap for modals (Tab/Shift+Tab cycling, focus restore on unmount).
- **Icon system** — React Context in `src/icons/` with pluggable registries (fluent, lucide, antd). `useAppIcon(name)` returns the current icon set's component. Persisted to localStorage, configurable via SettingsModal.
- **Custom node types** in `src/components/` — `UrlNode` (bookmark card with OG metadata), `MediaNode` (image/video, differentiated by `data.type`; video hover-to-play), `DocNode` (file with extension-based icon), `TextNode` (text note with golden ratio max-height, overflow fade, click-to-preview full text). Toolbars: `ModeToolbar` (right-side, includes import button), `SelectionToolbar` (floating, batch ops including share). Modals: `AIModal`, `SettingsModal` with `IconPanel`, `ShareModal` (generate share key from selected nodes), `ImportModal` (import nodes from share key), `TextPreviewModal`.
- **Styling**: CSS split into `src/styles/`. Dark mode uses `html.dark` class toggled on `<html>`, with flash prevention via inline `<script>` in `index.html` that reads localStorage synchronously before React loads. CSS custom property `--node-width: 320px` controls node sizing; `--color-primary` dynamically overridden by uiStore theme color.
- **React Compiler** enabled via `@rolldown/plugin-babel` with `reactCompilerPreset()` in `vite.config.ts` (Vite 8 uses Rolldown internally).

### Backend (server/)

```
server/
  index.ts              # Hono app: CORS, error handler, route registration, static serving, SPA fallback
  middleware/auth.ts     # JWT Bearer token verification, sets userId in context
  routes/
    auth.ts             # Register, login, refresh, logout, me
    nodes.ts            # Node CRUD with auth ownership checks
    upload.ts           # Chunked upload (init/chunk/complete/cancel) + simple upload
    metadata.ts         # OG metadata scraping with SSRF protection
    shares.ts           # Share creation (POST, auth required) + share query (GET, public)
    ai.ts               # AI image generation (stub, returns 501)
  utils/
    auth.ts             # Password hashing, JWT sign/verify, refresh token generation
    upload.ts           # File validation, fingerprint, session management, temp cleanup
  db/
    index.ts            # Drizzle + Bun SQLite factory, WAL mode, foreign keys ON
    schema.ts           # 5 tables: users, accounts, refresh_tokens, nodes, shares
  __tests__/setup.ts    # Test factories with in-memory SQLite
```

**Route factory pattern**: All route modules export factory functions (`createNodeRoutes`, `createUploadRoutes`, etc.) that accept a `deps` parameter with optional `db` and `auth` middleware. This enables test-time dependency injection of in-memory databases.

**API endpoints**:
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` — authentication
- `GET /api/nodes` — list all nodes
- `POST/PATCH/DELETE /api/nodes[/:id]` — node CRUD
- `POST /api/upload/*` — chunked file upload (init → chunk → complete/cancel)
- `POST /api/shares` — create share (auth required, returns 8-char shareKey)
- `GET /api/shares/:key` — query share by key (public, no auth required)
- `GET /api/metadata?url=` — OG metadata scraping

**Database schema** (`server/db/schema.ts`) — 5 tables:
- `nodes` — polymorphic canvas nodes (urlNode/imageNode/videoNode/docNode/textNode/groupNode). Nullable type-specific columns: `url`/`title`/`description`/`image`/`favicon` for URL nodes; `description` for text nodes; `src`/`fileName`/`fileSize` for media/doc nodes; `groupId`/`width`/`height` for group nodes. `userId` FK.
- `shares` — share records with 8-char unique `shareKey`, `userId` FK, `nodesSnapshot` (JSON of node metadata array). Created by authenticated users, queried publicly by key.
- `users` — accounts with email, username, passwordHash, role (admin/member), status.
- `accounts` — OAuth/credential provider links with token storage.
- `refresh_tokens` — JWT refresh tokens (revocable, cascade-deleted with user).

Drizzle config is in `drizzle.config.ts` — SQLite dialect, schema at `./server/db/schema.ts`, DB file `puzzle-canvas.db`.

### Key Technical Details

- **Auth flow**: Access token (15min, stateless JWT) + Refresh token (7 days, stored in DB, httpOnly cookie). Token rotation on every refresh (old deleted, new issued). First registered user automatically becomes admin.
- **Token refresh deduplication**: Both `src/utils/auth.ts` and `src/utils/api.ts` use module-level promise variables (`refreshInFlight`, `tokenRefreshInFlight`) to prevent concurrent refresh requests from causing token rotation races.
- **Chunked upload**: 5MB chunks, SHA-256 fingerprinting (first 2MB + file size) for deduplication and resume, exponential backoff retry (3 attempts), `AbortController`-based cancellation, 800MB max file size.
- **Progress node pattern**: File uploads create placeholder nodes immediately with `uploading` state, then mutate them in-place as upload progresses. On completion, node transitions to final type. On failure/abort, node is removed.
- **Fire-and-forget persistence**: `persistNode`, `persistNodePosition`, `persistNodeDelete` all use `.catch()` without blocking the UI. Backend sync is async and non-blocking.
- **Stale closure solution**: zustand's `getState()` in async callbacks always reads the latest state — no refs needed.
- **Node positioning**: new nodes placed at mouse position via `screenToFlowPosition`. Drag-and-drop nodes auto-arrange in waterfall layout (3 columns, configurable gap).
- **Upload cleanup**: Background interval (1h) in `server/utils/upload.ts` cleans temp chunks older than 24h and sessions older than 1h.
- **SSRF protection**: Metadata route blocks private IPs, 1MB response limit, 10s timeout.
- **Viewport**: Default `{ x: 0, y: 0, zoom: 0.5 }`, range 0.01–4. Saved to localStorage on move-end, restored on mount.
- **Selection**: Space+drag for box selection, Shift+click for toggle. Floating toolbar for batch organize/download/share/delete.
- **Node sharing**: Selected nodes → ShareModal → 8-char shareKey. Import via key or URL (ImportModal), nodes arrive in waterfall layout. Share creation requires auth, share query is public.
- **Vite proxy**: in dev, `/api` and `/uploads` are proxied to the Hono backend at `localhost:4001` with a 60s timeout on `/api`.
- **Environment**: No `.env` files. `JWT_SECRET` defaults to `'dev-secret-change-me'`. Upload dir `./uploads/`. All ports hard-coded (frontend 5175, backend 4001).
