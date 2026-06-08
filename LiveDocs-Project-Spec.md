# LiveDocs — Realtime Collaborative Writing Copilot

> A project specification and parallel learning roadmap, designed to be fed to Claude Code.

---

## How to use this document

This file is both a **build spec** and a **learning path**. It is broken into **10 checkpoints**. Each checkpoint is a self-contained milestone that:

- builds on the previous one,
- produces something you can run and see working,
- teaches one or two core concepts you should be able to explain in an interview,
- ends with a **"Definition of Done"** and **"What you should be able to explain"** section.

**Recommended workflow with Claude Code:**
1. Open this file in your project root as `LiveDocs-Project-Spec.md`.
2. Tell Claude Code: *"Read LiveDocs-Project-Spec.md. We are working on Checkpoint N. Help me implement it. Explain decisions as we go — don't just write code."*
3. Do **one checkpoint per session**. Don't let it build everything at once — the point is for *you* to learn it in parallel.
4. After each checkpoint, write a short note in your own words answering the "What you should be able to explain" prompts. This becomes your interview prep.

**A note on learning:** Ask Claude Code to explain *why*, not just generate code. The single most valuable interview skill here is being able to explain the CRDT and the debounce/cost tradeoffs in your own words. If you can only paste code you don't understand, the project loses most of its value.

---

## Project summary

**One-liner:** A web app where multiple people edit a document together in realtime, and an LLM acts as a copilot — offering suggestions as you write, catching contradictions between different sections of the document, and answering questions about the document's content.

**Why this project is a strong portfolio piece:**
- The hard part is **realtime collaboration** (conflict-free editing), not the LLM call — most candidate projects are simple request/response, so this differentiates you.
- It naturally forces a **proper backend, an end-to-end pipeline, and real architecture decisions** (WebSockets vs SSE, decoupling sync from AI, debouncing to control cost).
- It produces **demoable, explainable engineering tradeoffs** — exactly what hiring managers probe.

**Two decoupled realtime concerns (keep these separate — it's a key design decision):**
1. **Collaboration sync** — who typed what and where cursors are. Must be conflict-free and low-latency. Uses CRDTs over WebSockets.
2. **AI layer** — suggestions, inconsistency detection, doc Q&A. Async, tolerates latency, streams results back. Uses an LLM + SSE.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| CRDT / collab engine | **Yjs** + y-websocket + y-protocols | Industry-standard CRDT; handles conflict-free merging and presence. Don't hand-roll this. |
| Editor | **TipTap** (on ProseMirror) + Collaboration extension | Wires into Yjs out of the box; rich text without gluing hostile systems together. |
| Frontend | **Next.js + React + TypeScript + Tailwind** | Standard, hireable, React-friendly with TipTap/Yjs. |
| Sync server | **Node** (y-websocket server) | Most mature Yjs sync server path. |
| AI/API backend | **Python / FastAPI + Pydantic** | De facto standard for LLM services; native async; structured outputs. |
| Realtime transport | **WebSockets** (collab) + **SSE** (AI stream) | Bidirectional sync needs WS; one-way AI streaming is simpler over SSE. |
| Persistence | **Postgres + pgvector** | Doc metadata, auth, Yjs state snapshots, and section embeddings for RAG. |
| LLM | **Gemini Flash** (default) via OpenAI-compatible endpoint | Free tier (no credit card, no expiry), large context. Swappable. |
| Observability | **Langfuse** | Trace every LLM call: cost, latency, tokens. |
| Evals | **promptfoo** or **DeepEval** | Golden set of docs with known inconsistencies to measure the detector. |
| Auth | **JWT** (or Auth.js/Clerk to move fast) | Standard session handling. |
| Cache | **Redis** | Presence pub/sub if scaling sync; semantic cache for repeated AI calls. |
| Deploy | **Docker** → Render/Railway/Fly (backend + sync) + **Vercel** (frontend) | Live URL is non-negotiable for the portfolio. |

**Architecture note:** Running a small Node sync server alongside the FastAPI AI service is a legitimate two-service microservice split, not over-engineering — it's a good "why" to have ready for interviews. (If you insist on single-language, `pycrdt`/`ypy` exist, but the Node path is better-trodden.)

### LLM provider setup (Gemini default, swappable)

Gemini exposes an OpenAI-compatible endpoint, so the same client code works across Gemini / Grok / OpenAI / local Ollama by changing `base_url` + model name. **Wrap this behind a thin client** — "multi-provider routing" is itself a resume-worthy feature and your fallback when you hit the free daily cap.

```python
from openai import OpenAI
import os

client = OpenAI(
    api_key=os.environ["GEMINI_API_KEY"],
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

resp = client.chat.completions.create(
    model="gemini-flash-latest",
    messages=[...],
    stream=True,
)
```

**Free-tier gotchas to design around:**
- Build on **Flash**, not Pro (Pro is paid-only on the API).
- Keep **billing disabled** on the Google Cloud project — enabling it can remove the free tier.
- Free tier may use prompts for training — **don't send sensitive documents**.
- Limits are ~1,500 req/day, ~15 RPM. This is why **debouncing AI calls is mandatory**, not optional.

---

## System data flow (the whole pipeline)

```
                    ┌─────────────────────────────────────────┐
                    │            Browser (Next.js)             │
                    │   TipTap editor  +  Yjs doc  +  AI panel │
                    └───────┬───────────────────────┬─────────┘
                            │ WebSocket             │ HTTP + SSE
                            │ (CRDT sync)           │ (AI requests/streams)
                            ▼                       ▼
                 ┌──────────────────┐    ┌──────────────────────────┐
                 │  Node sync server│    │   FastAPI AI backend     │
                 │   (y-websocket)  │    │  auth, suggestions,      │
                 │                  │    │  inconsistency, Q&A      │
                 └────────┬─────────┘    └──────┬─────────────┬─────┘
                          │                     │             │
                          ▼                     ▼             ▼
                 ┌──────────────┐      ┌──────────────┐  ┌─────────┐
                 │  Postgres    │      │  LLM (Gemini)│  │ Langfuse│
                 │ + pgvector   │◄─────┤  via wrapper │  │ tracing │
                 │ (snapshots,  │      └──────────────┘  └─────────┘
                 │  embeddings) │
                 └──────────────┘
```

---

# THE 10 CHECKPOINTS

Each checkpoint is a milestone. Do them in order. Ship something runnable at each step.

---

## Checkpoint 1 — Project skeleton & a plain text editor

**Goal:** Stand up the repo structure and get a basic TipTap rich-text editor rendering in a Next.js app. No collaboration yet, no AI. Just one user typing into a styled editor.

**Build:**
- Monorepo or two-folder layout: `/frontend` (Next.js + TS + Tailwind) and `/backend` (FastAPI) and `/sync-server` (Node) — even if backend/sync are empty stubs for now.
- Next.js app with TipTap installed and a working editor component with basic formatting (bold, italic, headings, lists).
- A clean, minimal UI shell (sidebar for docs, main editing area).

**Concepts to learn:**
- What ProseMirror is and how TipTap sits on top of it (schema, nodes, marks).
- Why rich-text editing is modeled as a structured document tree, not a string.

**Definition of Done:** You can type formatted text into the editor in your browser.

**What you should be able to explain:**
- Why rich text isn't stored as a plain string.
- The relationship between TipTap and ProseMirror.

---

## Checkpoint 2 — CRDTs & local Yjs (the conceptual core)

**Goal:** Understand CRDTs and bind a Yjs document to your TipTap editor — *without* any network yet. Two editor instances in the same browser tab (or two components) should stay in sync via a shared in-memory Yjs doc.

**Build:**
- Install `yjs`, `@tiptap/extension-collaboration`.
- Create a `Y.Doc` and bind it to TipTap via the Collaboration extension.
- Render two editors bound to the same `Y.Doc` and watch edits mirror instantly.

**Concepts to learn (this is the most important checkpoint conceptually):**
- What a CRDT (Conflict-free Replicated Data Type) is and the problem it solves.
- **CRDT vs Operational Transform (OT)** — why modern collab tools favor CRDTs (no central transform authority needed, converges automatically).
- How Yjs represents a document and merges concurrent changes deterministically.

**Definition of Done:** Two editors in one browser, sharing one `Y.Doc`, stay perfectly in sync as you type in either.

**What you should be able to explain:**
- "What happens when two people edit the same word at the same time?" (The CRDT merge story — be able to tell this clearly. It's the #1 likely interview question for this project.)
- CRDT vs OT in one or two sentences.

---

## Checkpoint 3 — Realtime sync over WebSockets (multi-user)

**Goal:** Move the Yjs sync off a single browser and onto a real network connection so two *different* browsers/devices edit the same doc live.

**Build:**
- Stand up the **Node y-websocket server**.
- Connect the frontend via `y-websocket` provider to a document "room."
- Open the app in two browser windows → edits propagate across them in realtime.
- Add **awareness/presence**: live remote cursors and user names/colors via `y-protocols/awareness`.

**Concepts to learn:**
- WebSockets vs HTTP — why bidirectional, persistent connections are needed for sync.
- The "room"/document-channel model.
- Awareness state (ephemeral presence) vs document state (persistent content) — and why presence is *not* stored in the CRDT.

**Definition of Done:** Two separate browser windows edit the same document live, and you can see each other's cursors moving.

**What you should be able to explain:**
- Why WebSockets and not polling/SSE for the sync layer.
- The difference between awareness state and document state.

---

## Checkpoint 4 — Persistence: saving & loading documents

**Goal:** Make documents survive a server restart. Persist the Yjs document state to Postgres and reload it when a room opens.

**Build:**
- Postgres set up (Docker Compose for local dev — add Redis here too while you're at it).
- Schema: `users`, `documents` (id, title, owner, created/updated), `document_snapshots` (doc_id, Yjs binary update blob, timestamp).
- On the sync server (or via a small backend hook): persist the encoded Yjs state periodically/on change; load it when a room initializes.
- A document list UI: create, open, and list documents.

**Concepts to learn:**
- How Yjs serializes to a compact binary update (and why you store the binary, not rendered HTML).
- Snapshotting strategy: when to persist (debounced on change vs interval) and the tradeoffs.
- Basic relational schema design.

**Definition of Done:** You can create a doc, type in it, restart everything, reopen it, and your content is still there.

**What you should be able to explain:**
- Why you persist the Yjs binary state rather than the HTML/text.
- Your snapshotting tradeoff (frequency vs write load).

---

## Checkpoint 5 — Auth & document ownership

**Goal:** Real users. People sign in, own documents, and share access to specific docs.

**Build:**
- JWT-based auth on FastAPI (or Auth.js/Clerk if you want speed — note the tradeoff in your README).
- Login/signup flow on the frontend; attach the token to API requests and to the WebSocket connection.
- Authorization: only users with access can open a document room. A simple share mechanism (owner can add collaborators by email/username).

**Concepts to learn:**
- JWT structure, signing, expiry, and where to store tokens safely.
- **Authenticating a WebSocket connection** (it's different from HTTP request auth — you pass the token at connection time and validate before joining a room).
- Authentication vs authorization.

**Definition of Done:** Two real accounts can collaborate on a shared doc; a third unauthorized account cannot open it.

**What you should be able to explain:**
- How you authenticate the WebSocket/sync connection, not just HTTP routes.
- Where the JWT lives and why.

---

## Checkpoint 6 — First AI feature: inline writing suggestions (with SSE streaming)

**Goal:** The copilot's first real feature. As the user pauses typing, send the changed section to the FastAPI backend, call Gemini, and **stream** suggestions back into a side panel.

**Build:**
- Thin **LLM client wrapper** (provider-swappable; default Gemini Flash via the OpenAI-compatible endpoint).
- **Debounce** edits on the frontend — only fire after a pause (e.g., 1.5–2s of inactivity) and only send the **changed region**, not the whole doc. (This is mandatory for cost/rate-limit control — explain why.)
- FastAPI endpoint that calls the LLM and returns a **streamed** response over **SSE**.
- AI suggestions render as non-blocking overlays/side-panel cards — they must never interrupt typing.

**Concepts to learn:**
- **SSE vs WebSockets** — why one-directional server→client streaming uses SSE here while sync uses WS. (Deliberately choosing per use case = maturity signal.)
- Debouncing and the **cost/latency/rate-limit tradeoff** — the single most important engineering decision in this project.
- Async request handling in FastAPI; streaming responses.

**Definition of Done:** You type, pause, and within a couple seconds streamed suggestions appear in a panel without disrupting your editing.

**What you should be able to explain:**
- Why you don't call the LLM on every keystroke, and exactly how your debounce works.
- Why SSE for this and WebSockets for sync.

---

## Checkpoint 7 — Structured outputs & rendering suggestions as real UI

**Goal:** Turn freeform AI text into **validated structured data** so suggestions become actionable inline UI (accept/dismiss, jump-to-location), not a blob of text.

**Build:**
- Define **Pydantic models** for suggestions: e.g., `Suggestion(location, issue_type, original_text, suggested_text, rationale, confidence)`.
- Prompt the model to return structured output; validate with Pydantic (use retry-on-invalid).
- Frontend renders each suggestion as a card with **Accept** (applies the edit to the Yjs doc) and **Dismiss** actions.

**Concepts to learn:**
- Structured outputs / JSON mode and why validated schemas matter for production LLM apps.
- Why you let the LLM propose but the **deterministic code applies** the change to the CRDT (separation of concerns).
- Handling malformed LLM output gracefully (validation + retry).

**Definition of Done:** Suggestions appear as cards; clicking Accept actually edits the document through Yjs.

**What you should be able to explain:**
- Why structured outputs beat parsing freeform text.
- How an accepted suggestion flows back into the CRDT without breaking collaboration.

---

## Checkpoint 8 — RAG: cross-section inconsistency detection & document Q&A

**Goal:** The standout feature. Embed document sections into pgvector, then (a) detect contradictions across sections and (b) answer questions about the document with citations.

**Build:**
- On save/change, chunk the document into sections, embed them, and store vectors in **pgvector** (with metadata: section id, position).
- **Inconsistency detection:** retrieve related sections and have the LLM compare them, flagging contradictions (e.g., "Section 2 says deadline is March; Section 5 says April") as structured findings.
- **Doc Q&A:** a chat box where a question runs RAG over the embedded sections → grounded answer **with citations** back to specific sections.

**Concepts to learn:**
- The full **RAG pipeline**: chunk → embed → store → retrieve → generate.
- Why grounding + citations reduce hallucination.
- Chunking strategy tradeoffs (section-based vs fixed-size) and `recall@k` as a retrieval quality metric.

**Definition of Done:** The app flags a contradiction you deliberately planted between two sections, and you can ask "what does this doc say about X?" and get a cited answer.

**What you should be able to explain:**
- Your chunking strategy and why.
- How retrieval quality affects answer quality (most RAG failures are retrieval, not generation).

---

## Checkpoint 9 — Observability, evals & caching (the production-maturity layer)

**Goal:** Prove you can measure and optimize a non-deterministic system. This is the layer hiring managers specifically screen for and it's what most candidate projects skip.

**Build:**
- **Langfuse**: trace every LLM call (latency, tokens, cost). Add a small dashboard or screenshots to your README.
- **Eval harness** (promptfoo or DeepEval): a **golden dataset** of documents with known inconsistencies + known-good Q&A pairs. Measure faithfulness, answer relevancy, and whether the detector catches planted contradictions. Run it in CI.
- **Redis semantic cache** in front of the LLM for repeated/similar calls; measure and record the cost/latency reduction.
- **Rate limiting** per user (protects your free-tier quota and a public URL).

**Concepts to learn:**
- How you **evaluate a non-deterministic system** — "the single best signal of real LLM experience."
- Observability: tracing, cost attribution, latency percentiles.
- Semantic caching and prompt caching for cost control.

**Definition of Done:** Running your eval suite outputs pass/fail metrics on the inconsistency detector and Q&A; Langfuse shows traced calls with cost; caching shows a measurable hit rate.

**What you should be able to explain:**
- How you measure whether your AI features actually work (your eval methodology + metrics).
- Your cost-optimization story with real numbers.

---

## Checkpoint 10 — Deploy, MCP server & polish

**Goal:** Ship it to a live URL, expose it as an MCP server, and package it so a recruiter "gets it" in 60 seconds.

**Build:**
- **Dockerize** all three services; deploy FastAPI + Node sync to Render/Railway/Fly and the frontend to Vercel. Real, public, live URL.
- Environment-variable secret management; graceful error handling and loading states.
- **MCP server**: expose `ask_document` and `find_inconsistencies` as MCP tools so the backend is callable from Claude Desktop / Cursor — a current, differentiating capability.
- **README**: problem → architecture diagram → tech decisions & tradeoffs → metrics → "what I'd do differently." Add a short demo video/GIF and pin the repo.

**Concepts to learn:**
- Containerization and multi-service deployment.
- What MCP is and why exposing tools via MCP is a 2026-relevant signal.
- Communicating engineering decisions for a non-technical first impression.

**Definition of Done:** Anyone can open your live URL and collaborate in realtime with AI features; the tools work from an MCP client; the README tells the story.

**What you should be able to explain:**
- Your full architecture end-to-end in 2 minutes.
- One thing you'd redesign and why (self-aware reflection beats a sales pitch in interviews).

---

# Resume framing (use after you ship)

Use the **Action + tech + quantified outcome** formula. Lead with the outcome, not the tool list.

Example bullets (fill in real measured numbers — never fabricate):
- "Built and deployed LiveDocs, a realtime collaborative writing copilot (Yjs CRDT sync over WebSockets, Next.js/TipTap, FastAPI), supporting concurrent multi-user editing with conflict-free merging and live presence."
- "Engineered an LLM copilot layer with debounced, streamed (SSE) suggestions and Pydantic structured outputs; cut LLM calls by **[measured]%** via region-diffing and Redis semantic caching."
- "Implemented RAG over document sections (pgvector) for cross-section inconsistency detection and cited Q&A, achieving **[measured]** recall@k on a golden eval set."
- "Built an automated evaluation harness (promptfoo, CI-gated) and Langfuse observability measuring faithfulness, latency, and cost per query."
- "Exposed document Q&A and inconsistency-checking as an **MCP server**, callable from Claude Desktop and Cursor."

**Metrics worth highlighting:** concurrent users supported, % reduction in LLM calls from debounce+cache, recall@k, eval pass-rate, p95 latency / time-to-first-token, cost per session.

**Mistakes to avoid:** no deployed URL; claiming "fine-tuned" when you only prompted; vague "leveraged AI"; listing tools without architecture; no evals or observability; numbers you can't defend in an interview.

---

# Quick reference: dependency checklist

**Frontend:** `next`, `react`, `typescript`, `tailwindcss`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-cursor`, `yjs`, `y-websocket`, `y-protocols`

**Sync server (Node):** `ws`, `yjs`, `y-websocket` (server utilities), persistence hook to Postgres

**Backend (Python):** `fastapi`, `uvicorn`, `pydantic`, `openai` (used with Gemini's OpenAI-compatible base_url), `psycopg`/`asyncpg`, `pgvector`, `redis`, `langfuse`, `python-jose`/auth lib, `sse-starlette`

**Eval/dev:** `promptfoo` or `deepeval`, `docker` + `docker-compose`

**Env vars you'll need:** `GEMINI_API_KEY`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`

---

*Build one checkpoint per session. Ask Claude Code to explain decisions, not just generate code. The goal is that you can defend every architectural choice in an interview.*
