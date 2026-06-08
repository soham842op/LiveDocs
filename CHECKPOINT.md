# LiveDocs — Build Checkpoint Tracker

> Updated by Claude Code as we move through each checkpoint. Use this to resume sessions quickly.
> Interview Q&A for all checkpoints: **[INTERVIEW-PREP.md](./INTERVIEW-PREP.md)**

---

## Current Status

**Active Checkpoint:** 2 — CRDTs & local Yjs (next up)
**Last Completed:** 1 — Project skeleton & plain text editor
**Date Started:** 2026-06-07
**Last Updated:** 2026-06-07

---

## Checkpoint Progress

| # | Name | Status | Key Files |
|---|------|--------|-----------|
| 1 | Project skeleton & plain text editor | ✅ Done | `/frontend`, `/backend`, `/sync-server` |
| 2 | CRDTs & local Yjs | 🔜 Up Next | — |
| 3 | Realtime sync over WebSockets | ⏳ Not Started | — |
| 4 | Persistence: saving & loading docs | ⏳ Not Started | — |
| 5 | Auth & document ownership | ⏳ Not Started | — |
| 6 | First AI feature: inline suggestions + SSE | ⏳ Not Started | — |
| 7 | Structured outputs & real suggestion UI | ⏳ Not Started | — |
| 8 | RAG: inconsistency detection & doc Q&A | ⏳ Not Started | — |
| 9 | Observability, evals & caching | ⏳ Not Started | — |
| 10 | Deploy, MCP server & polish | ⏳ Not Started | — |

---

## Checkpoint 1 — Detail Log

### Goal
Stand up the monorepo structure and render a working TipTap rich-text editor in Next.js. No collaboration, no AI — just one user typing into a styled editor.

### What we're building
- Monorepo layout: `/frontend` (Next.js + TS + Tailwind), `/backend` (FastAPI stub), `/sync-server` (Node stub)
- TipTap editor with Bold, Italic, Headings, Lists
- Clean UI shell: sidebar (doc list) + main editing area

### Architectural decisions made
- **Monorepo over separate repos**: single git history, easier cross-layer refactors later, no versioning headaches between services.
- **TipTap over Slate/Quill/Draft.js**: TipTap is the only editor with first-class Yjs CRDT integration (Checkpoint 2) and ProseMirror-level power without the raw API surface.
- **Next.js App Router**: server components for the layout shell; client components for the editor (Yjs & browser APIs are client-only).

### Files created
- `CHECKPOINT.md` (this file)
- `frontend/` — Next.js app (to be created)
- `backend/` — FastAPI stub (to be created)
- `sync-server/` — Node stub (to be created)

### Definition of Done
- [x] `npm run dev` starts the frontend — running at http://localhost:3000
- [x] Browser shows a styled editor where you can type formatted text
- [x] Folder structure for backend and sync-server exists (stubs created)

### Interview answers
**Why is rich text not stored as a plain string?**
A string can't represent structure unambiguously. `**bold**` could be Markdown, HTML, or just two asterisks — you'd need a parser to know. ProseMirror models the document as a tree: `doc → paragraph → text("Hello", [mark: bold])`. This tree is unambiguous, cursor-aware (positions are integer offsets in the tree), and diffable (Yjs can compute exactly which nodes changed). HTML is a *rendering format* derived from this tree, not the source of truth.

**What is the relationship between TipTap and ProseMirror?**
TipTap is a React wrapper around ProseMirror. ProseMirror gives you the document model, transaction system, and DOM view — but its API is very low-level (you build everything yourself). TipTap wraps it with an extension system (bold, headings, etc.), a React hook (`useEditor`), and first-class Yjs integration via `@tiptap/extension-collaboration`. We chose TipTap because its Yjs extension is what enables Checkpoint 2 without a rewrite.

### Files created in CP1
- `frontend/src/app/globals.css` — TipTap prose styles (.tiptap ruleset)
- `frontend/src/app/layout.tsx` — Root Server Component, HTML shell
- `frontend/src/app/page.tsx` — Root page (Server Component, composes layout)
- `frontend/src/components/Sidebar.tsx` — Static sidebar (Server Component)
- `frontend/src/components/Toolbar.tsx` — Formatting toolbar (Client Component)
- `frontend/src/components/Editor.tsx` — TipTap editor (Client Component)
- `backend/main.py` — FastAPI stub
- `backend/requirements.txt`
- `sync-server/index.js` — Node HTTP stub
- `sync-server/package.json`

---

## Notes & Decisions Log

| Date | Decision | Why |
|------|----------|-----|
| 2026-06-07 | Chose TipTap over Slate/Quill | First-class Yjs integration needed for CP2; ProseMirror underneath gives schema control |
| 2026-06-07 | Monorepo (single folder) | Simpler for a solo portfolio project; one git history |
| 2026-06-07 | Next.js App Router | Server/client split aligns with our needs: shell = server, editor = client |
| 2026-06-07 | Gemini Flash via OpenAI-compatible endpoint | Free tier, no credit card, swappable to any provider by changing base_url |
