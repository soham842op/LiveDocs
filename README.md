# LiveDocs

A realtime collaborative document editor with an AI writing copilot — CRDT-based sync (Yjs), JWT auth, and an LLM layer (Gemini) for inline suggestions, RAG-grounded Q&A, and cross-document inconsistency detection.

**Live demo:** [live-docs-ten-neon.vercel.app](https://live-docs-ten-neon.vercel.app)
*(Backend runs on Render's free tier — the first request after idle can take 30–60s to cold-start.)*

---

## Architecture

Three independently deployed services, two purpose-built transports, two data stores:

```
┌────────────┐   WebSocket (Yjs sync)   ┌──────────────┐
│  Next.js    │ ───────────────────────▶│  sync-server  │──┐
│  frontend   │                          │  (Node, y-ws) │  │  binary CRDT state
│  (Vercel)   │                          └──────────────┘  ▼
│             │                                          ┌─────┐
│  TipTap +   │      HTTPS (REST/JSON)   ┌──────────────┐│ S3  │
│  Yjs editor │ ───────────────────────▶│   FastAPI     │└─────┘
└────────────┘                          │   backend     │
                                         │   (Render)    │
                                         └──────┬───────┘
                                                │
                                    ┌───────────┴───────────┐
                                    │ Supabase Postgres      │
                                    │ + pgvector             │
                                    │ (users, docs, chunks,  │
                                    │  llm_events, cache)    │
                                    └────────────────────────┘
```

- **Frontend (Next.js + TipTap + Yjs)** — owns the editor UI and the live document model. Talks to the sync server over WebSocket for CRDT sync, and to FastAPI over HTTPS for everything else (auth, doc CRUD, AI features).
- **sync-server (Node + `y-websocket`)** — the actual data gate for document content. Verifies the JWT and checks document ownership *during the WebSocket upgrade handshake*, before any CRDT bytes can flow. Debounce-persists Yjs binary snapshots to S3 and writes the S3 key reference to Postgres.
- **backend (FastAPI)** — auth, document metadata CRUD, and all LLM-backed endpoints (suggestions, inconsistency detection, RAG Q&A, embeddings). Stateless with respect to document content — the frontend reads the live TipTap JSON and POSTs plain text, so the backend never has to decode Yjs binary.

## Features

- **Realtime collaborative editing** — multiple cursors, conflict-free merges via Yjs (CRDT), no central lock or operational-transform server.
- **Durable persistence** — CRDT binary state debounce-saved to S3; metadata (title, timestamps, ownership) in Postgres.
- **Auth & sharing** — email/password signup with bcrypt hashing, JWT (HS256) sessions, per-document ownership and explicit collaborator sharing.
- **Inline AI suggestions** — pauses in typing trigger a Gemini call over the current paragraph; returns 3 structured (Pydantic-validated) continuation options with rationale, insertable directly into the live doc.
- **Inconsistency detection** — full-document-context LLM pass that flags contradictions between sections, with severity ratings.
- **Document Q&A (RAG)** — embeds document sections into `pgvector`, retrieves top-k relevant chunks for a question, and generates a cited answer grounded in those chunks.
- **Observability & caching** — every LLM call is logged (latency, token counts, model) to Postgres; identical suggestion requests are served from a Postgres-backed cache instead of re-calling the model.
- **Document management** — rename, delete, and upload (`.txt`/`.md`) to seed a new document.

## Tech stack

| Layer | Technology |
|---|---|
| Editor | Next.js (App Router) · TypeScript · Tailwind · TipTap (ProseMirror) |
| Realtime sync | Yjs (CRDT) · `y-websocket` · Node |
| API / AI backend | FastAPI · Pydantic · `python-jose` (JWT) · `passlib`/`bcrypt` |
| LLM | Gemini 2.5 Flash — chat via OpenAI-compatible endpoint, embeddings via `google-genai` |
| Database | Supabase Postgres + `pgvector` |
| Blob storage | AWS S3 (Yjs binary snapshots) |
| Deployment | Vercel (frontend) · Render (FastAPI + sync-server) |

## Design decisions

A few choices worth calling out (more detail and full interview-style write-ups live in [`CHECKPOINT.md`](./CHECKPOINT.md)):

- **CRDT over Operational Transformation** — Yjs lets every peer merge concurrent edits independently with no central server deciding canonical order; OT requires that server. Document state and ephemeral presence (cursors) are deliberately kept in separate systems — only one of them needs to survive a disconnect.
- **Binary CRDT state in S3, metadata in Postgres** — storing the full `Y.encodeStateAsUpdate()` output (not HTML/plain text) preserves every operation's vector clock, which is what makes future merges correct. Blob storage and relational metadata are different problems; they get different stores.
- **Custom JWT instead of Supabase Auth** — Supabase's `auth.uid()` only recognizes Supabase-issued tokens, so RLS policies would silently deny everything under self-issued JWTs. Authorization is enforced at the app layer instead (FastAPI routes and the WebSocket upgrade handler both check `owner_id`/`document_collaborators` directly).
- **Auth in the WebSocket `upgrade` handler, not `connection`** — the Yjs client sends its first sync message within a millisecond of the socket opening. Doing an async DB check in the `connection` handler lets that first message arrive before a listener is attached, silently dropping it. The `upgrade` handler runs before the handshake completes, so it's the only safe place for the async ownership check.
- **Full document context for inconsistency detection, retrieval (RAG) for Q&A** — a portfolio-scale document fits whole inside Gemini's context window, so contradiction-checking gets to see every section at once (retrieval could miss a contradiction between two non-adjacent sections). Q&A is the opposite case: grounding the answer in a small set of retrieved, citable passages is the correct pattern, not just the more "RAG-shaped" one.
- **Structured outputs over freeform streaming for suggestions** — the first version streamed raw text over SSE; it was replaced with a single JSON response validated against a Pydantic schema (with a retry-on-invalid loop), because partial JSON can't be validated mid-stream and the latency cost of waiting for ~300 tokens is imperceptible.

## Project structure

```
LiveDocs/
├── frontend/        Next.js app — editor UI, auth pages, document dashboard
├── sync-server/     Node y-websocket server — CRDT sync + S3/Postgres persistence
├── backend/         FastAPI — auth, document CRUD, LLM endpoints
├── supabase/migrations/   SQL schema (documents, auth, embeddings, observability)
├── render.yaml       Render blueprint for backend + sync-server
└── CHECKPOINT.md      Build log — architectural decisions per milestone
```

## Running locally

Prerequisites: Node 18+, Python 3.12, a Supabase project (Postgres + `pgvector` enabled), an AWS S3 bucket, and a [Gemini API key](https://aistudio.google.com/app/apikey) (free tier).

1. **Database** — run the migrations in `supabase/migrations/` (in order) via the Supabase SQL Editor.

2. **Backend** (`/backend`)
   ```bash
   cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, GEMINI_API_KEY
   python -m venv .venv && .venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

3. **Sync server** (`/sync-server`)
   ```bash
   cp .env.example .env   # DATABASE_URL, JWT_SECRET (must match backend), AWS_*, S3_BUCKET
   npm install
   npm run dev             # ws://localhost:1234
   ```

4. **Frontend** (`/frontend`)
   ```bash
   npm install
   npm run dev              # http://localhost:3000
   ```
   Create `frontend/.env` with:
   ```
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_ANON_KEY=<your-anon-key>
   NEXT_PUBLIC_SYNC_SERVER=ws://localhost:1234
   ```

`JWT_SECRET` must be identical across `backend/.env` and `sync-server/.env` — both sides sign/verify the same HS256 tokens.

## Deployment

- **Backend + sync-server** deploy from [`render.yaml`](./render.yaml) as a Render Blueprint (two free-tier web services).
- **Frontend** deploys to Vercel from the `frontend/` directory.
- The backend's `ALLOWED_ORIGINS` env var must list the deployed frontend origin(s), comma-separated — CORS preflight fails otherwise.
