# LiveDocs — Interview Q&A Master Sheet

> One file. Every question this project can generate. Every answer you should be able to say out loud.
>
> **How to use:** Before each interview, read the sections for the checkpoints you've completed.
> Cover the answer, say it aloud, then check. If you stumble, the answer needs another pass.
> Status column tells you if the answer is proven (built & tested) or theoretical (not yet built).

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Built and tested — you can fully defend this |
| 📖 | Not built yet — answer is correct but theoretical |

---

## Checkpoint 1 — Project skeleton & plain text editor ✅

---

**Q1.1 — Why isn't rich text stored as a plain string?**

A plain string is structurally ambiguous. If you store `"**Hello**"`, you don't know whether those asterisks are Markdown syntax, literal characters, or HTML entities — you'd need a parser, and the result depends on which parser you pick. More critically, a string has no concept of *cursor position* in a structured sense, and you can't diff it at the semantic level that a CRDT needs.

ProseMirror (which TipTap sits on) models the document as a typed node tree:

```
doc
 └─ paragraph
     ├─ text("Hello ", marks=[])
     └─ text("world", marks=[bold])
```

This tree is:
- **Unambiguous** — `bold` is an explicit mark, not a convention
- **Cursor-aware** — every position in the document maps to an integer offset within the tree
- **Diffable** — Yjs can represent exactly which node or mark changed, not just which character

HTML is a *rendering format* derived from this tree. It is not the source of truth. Storing HTML would mean parsing it back on every operation, losing structural guarantees in the process.

---

**Q1.2 — What is the relationship between TipTap and ProseMirror?**

ProseMirror is a low-level toolkit: it gives you the document schema, the transaction system (every edit is an atomic transaction on the document tree), and the DOM view. But ProseMirror's raw API requires you to define every node type, every mark, every command, and every keyboard shortcut yourself. It's powerful and correct — but verbose.

TipTap wraps ProseMirror with:
- A pre-built **extension system** (StarterKit ships bold, italic, headings, lists, undo/redo)
- A **React hook** (`useEditor`) that manages the ProseMirror view lifecycle inside a React component
- First-class **Yjs integration** via `@tiptap/extension-collaboration` — this extension patches ProseMirror's history and transaction handling so Yjs becomes the source of truth for document state

The key reason we chose TipTap over Slate or Draft.js: it's the only editor with a maintained, first-class Yjs CRDT extension. Any other editor would require hand-rolling the sync layer.

---

**Q1.3 — Why Next.js App Router, and where is the server/client boundary?**

App Router lets you colocate Server Components (render on the server, ship zero JS) and Client Components (`'use client'`) in the same tree.

For LiveDocs:
- **Server Components**: `layout.tsx`, `page.tsx`, `Sidebar.tsx` — these are pure markup/composition with no interactivity. They render on the server, arrive as HTML, and add nothing to the JS bundle.
- **Client Components**: `Editor.tsx`, `Toolbar.tsx` — TipTap's `useEditor` hook calls `useEffect` to mount the ProseMirror view onto a real DOM node. That's inherently browser-only. The Toolbar reads editor state (`editor.isActive('bold')`) and fires transactions on click — also browser-only.

The rule: push `'use client'` as deep into the tree as possible. The broader the server component tree, the less JavaScript shipped, and the faster the First Contentful Paint.

---

**Q1.4 — Why `immediatelyRender: false` in `useEditor`?**

During SSR, there is no DOM. TipTap's `useEditor` tries to mount a ProseMirror view onto a `ref` — if it does this during server render, the editor state on the server (null editor) and the client's first render diverge, causing a React hydration mismatch error.

Setting `immediatelyRender: false` tells TipTap to return `null` from `useEditor` on the first render and only create the editor after hydration. TipTap v3 auto-detects Next.js and sets this to `false` with a console warning, but we set it explicitly to suppress the warning and document the intent in code.

---

**Q1.5 — Why a monorepo over three separate repos?**

For a portfolio project with one developer, a monorepo means:
- One `git log` tells the full story across all three services
- Cross-cutting changes (e.g., a shared type for a document ID) are a single commit
- No npm/PyPI versioning overhead for shared utilities

The folder structure (`/frontend`, `/backend`, `/sync-server`) preserves the separation of concerns and deployment boundaries — each folder can be independently Dockerized and deployed. The monorepo is a *development* convenience, not an architectural coupling.

In a large team, you'd split into separate repos with a shared package registry (npm workspaces, PyPI). That's a scaling decision, not an architectural one.

---

**Q1.6 — Why TipTap over Quill, Slate, or Draft.js?**

| Editor | Why not |
|--------|---------|
| **Quill** | Largely unmaintained; no Yjs integration |
| **Draft.js** | Facebook-internal, largely abandoned post-2020 |
| **Slate** | Powerful but you hand-roll everything; no maintained Yjs plugin |
| **TipTap** | ProseMirror underneath (correct, battle-tested model); first-class Yjs extension; active maintenance |

The Yjs integration is the deciding factor. The alternative would be implementing a CRDT binding yourself — weeks of work and a major source of bugs.

---

## Checkpoint 2 — CRDTs & local Yjs 📖

---

**Q2.1 — What is a CRDT and what problem does it solve?**

CRDT stands for **Conflict-free Replicated Data Type**. The problem it solves: when two users edit the same document simultaneously without a network connection (or with high latency), and then their changes merge — how do you guarantee the result is meaningful and identical on both sides, without a central server deciding the winner?

A CRDT is a data structure with a **merge function that is commutative, associative, and idempotent**. No matter what order you apply a set of concurrent operations, the result is always the same. This means:
- No central authority is needed to order operations
- Clients can work offline and sync later
- Merge is automatic and deterministic

Yjs implements a specific CRDT called **YATA** (Yet Another Transformation Approach), which models the document as a sequence of *items*, each with a unique ID (client ID + clock). When two clients insert text at the same position, YATA's tie-breaking rules deterministically order them based on their IDs.

---

**Q2.2 — CRDT vs Operational Transform (OT) — what's the difference and why do modern tools prefer CRDTs?**

Both solve the same problem (concurrent edits), but differently:

**OT (Operational Transform):**
- Every operation is transformed against concurrent operations before being applied
- Requires a **central server** to sequence and transform operations — the server is the arbiter
- Complex to implement correctly (Google's OT implementation reportedly took years to get right)
- Used by: Google Docs (originally), Etherpad

**CRDT:**
- Operations carry enough metadata that any peer can merge them independently
- **No central authority needed** — any two peers can sync directly (P2P)
- Easier to reason about formally (provable convergence)
- Slightly more memory overhead (tombstones for deletions, unique IDs per character)
- Used by: Figma, Linear, Notion (partially), Loom

Why modern tools prefer CRDTs: the central-server requirement of OT is a scaling and availability liability. With CRDTs, the sync server becomes a dumb relay — if it goes down, clients keep their state and sync when it comes back. That's a much better resilience story.

---

**Q2.3 — What happens when two people edit the same word at the same time?**

This is the core interview question for this project. Here's the answer you need to be able to tell as a story:

Say Alice and Bob both have `"Hello"` in their document. Alice inserts `" World"` after `"Hello"` at the same moment Bob inserts `"!"` after `"Hello"`.

In Yjs (YATA algorithm):
1. Each character insertion carries a unique ID: `(clientID, clock)` — e.g., Alice's inserts are `(alice, 1)`, `(alice, 2)` etc., Bob's are `(bob, 1)`.
2. Each item also records its **left** and **right** neighbors at the time of insertion — i.e., "I was inserted after item X".
3. When Alice's and Bob's states merge, Yjs has both operations: Alice's " World" was inserted after `"Hello"[4]`, Bob's "!" was also inserted after `"Hello"[4]`.
4. Tie is broken deterministically by comparing client IDs (or clocks). The result is always the same on both sides: `"Hello World!"` or `"Hello! World"` — whichever the tie-breaking rule produces.

The key point: **both clients independently reach the same result**. No server vote, no "last write wins" data loss. The document converges.

---

**Q2.4 — Why does `Y.Doc` exist as a concept separate from the editor?**

`Y.Doc` is the CRDT data structure — it knows nothing about React or the DOM. It's a pure in-memory store that can be serialized to a binary blob, synced over any transport (WebSocket, WebRTC, BroadcastChannel), and merged with any other `Y.Doc` that shares the same document ID.

`@tiptap/extension-collaboration` is the bridge: it binds a `Y.XmlFragment` (the Yjs type that represents the document content) to TipTap's ProseMirror state. When TipTap fires a transaction (user types), the extension writes the change into the `Y.Doc`. When the `Y.Doc` receives a remote update (peer synced), the extension applies it to ProseMirror.

This separation means you can swap the editor (use a different ProseMirror-based editor) without touching the sync layer, or swap the sync transport (WebSocket → WebRTC) without touching the editor.

---

## Checkpoint 3 — Realtime sync over WebSockets 📖

---

**Q3.1 — Why WebSockets for sync and not HTTP polling or SSE?**

| Transport | Direction | Persistent connection | Right for |
|-----------|-----------|----------------------|-----------|
| HTTP polling | Client → Server | No (new request each time) | Infrequent updates where latency doesn't matter |
| SSE | Server → Client only | Yes | One-way server pushes (AI streaming in CP6) |
| WebSocket | Bidirectional | Yes | Realtime sync where both sides need to send |

Collab sync is **bidirectional**: the client sends its local updates to the server, and the server sends other clients' updates back. SSE is one-directional (server → client only), so you'd need SSE for receiving *plus* HTTP POST for sending — two separate channels with synchronization complexity. WebSocket handles both in one persistent connection with low overhead per message.

---

**Q3.2 — What is the difference between awareness state and document state, and why is presence NOT stored in the CRDT?**

**Document state** (stored in `Y.Doc`): The actual content — text, formatting, headings. This is persistent, must survive a page refresh, and is the CRDT's job to merge.

**Awareness state** (stored in `y-protocols/awareness`): Ephemeral presence data — who is online right now, where their cursor is, what their name/color is. This is **not** part the CRDT for two reasons:
1. **It doesn't need to persist** — cursor position is meaningless after a user disconnects
2. **It changes extremely frequently** (every cursor move) — CRDT merge overhead would be wasteful for data that's discarded on disconnect

Awareness uses a simpler gossip protocol with a timestamp. When a client disconnects, its awareness state expires. No merge is needed — last write wins per client ID.

---

**Q3.3 — What is a "room" in the context of y-websocket?**

A room is a named channel that groups clients editing the same document. The y-websocket server is document-agnostic: it routes Yjs update messages between all clients connected to the same room name. The room name is typically the document ID.

When a client connects with `new WebsocketProvider(serverUrl, roomName, ydoc)`, the server:
1. Creates a room if it doesn't exist
2. Sends the client the current document state (loaded from persistence in CP4)
3. Forwards any future updates from this client to all other clients in the room

---

## Checkpoint 4 — Persistence: saving & loading documents 📖

---

**Q4.1 — Why persist the Yjs binary state rather than HTML or plain text?**

Three reasons:

1. **Round-trip fidelity**: Yjs encodes every item with its client ID and clock. If you export to HTML and re-import, those IDs are lost. Any future merge with an older client's state will fail because the shared ancestry is gone — you'll get duplicate content instead of a correct merge.

2. **Efficiency**: Yjs's binary encoding (`Y.encodeStateAsUpdate`) is compact. A document with 10,000 characters might serialize to a few KB of binary, while the equivalent HTML has verbose tag overhead.

3. **Correctness**: The CRDT state includes **tombstones** (records of deleted items). Without tombstones, if client A deleted a character and client B is offline, when B comes back online the deletion can't be applied correctly — the character reappears. The binary state preserves the full history needed for correct merges.

---

**Q4.2 — What is your snapshotting strategy and what are the tradeoffs?**

Two common strategies:

**Debounced on-change**: Persist the Yjs state N seconds after the last edit. Low write overhead, but you risk losing up to N seconds of work if the server crashes.

**Periodic interval**: Persist every M seconds regardless of edits. Simpler to implement, predictable write load, but may write unchanged state.

**Our choice**: Debounced on-change (e.g., 5 seconds). The tradeoff is acceptable for a collaborative editor — losing 5 seconds of work is rare and non-critical for the use case. For a financial or legal document system, you'd want a WAL (write-ahead log) of every Yjs update for point-in-time recovery.

We store the Yjs binary blob in a `document_snapshots` table: `(doc_id, state_bytes, updated_at)`. On room initialization, the sync server loads the latest snapshot and sends it to the first connecting client.

---

**Q4.3 — Why use Docker Compose for local dev?**

Docker Compose runs Postgres and Redis as containers — no manual install, no version conflicts between projects, and the setup is reproducible. Any developer (or a fresh CI runner) can run `docker compose up` and have the full stack running in seconds. The container definitions also double as documentation: they capture exactly which Postgres and Redis versions the app depends on.

---

## Checkpoint 5 — Auth & document ownership 📖

---

**Q5.1 — What is a JWT and where do you store it safely?**

A JWT (JSON Web Token) has three parts: `header.payload.signature`. The header names the signing algorithm (e.g., HS256). The payload carries claims (`user_id`, `exp`, `roles`). The signature is an HMAC of the header+payload using `JWT_SECRET` — the server verifies it on every request without a database lookup.

**Where to store it:**
- **`httpOnly` cookie** — the browser cannot access it via JavaScript, so XSS attacks can't steal it. This is the safest option for browser clients. Requires SameSite and Secure flags.
- **`localStorage`** — accessible to JavaScript, so XSS can steal it. Avoid for anything sensitive.
- **In-memory (React state)** — safest against XSS but lost on page refresh, requiring a refresh-token flow.

We store the JWT in an `httpOnly` cookie. The FastAPI backend sets it via `Set-Cookie` on login. The Next.js frontend sends it automatically on every request (cookies are sent by the browser).

---

**Q5.2 — How do you authenticate a WebSocket connection? Why is it different from HTTP?**

HTTP requests carry the `Authorization` header on every request. WebSocket connections are established with a single HTTP upgrade handshake — after that, it's a raw TCP connection. The browser's WebSocket API (`new WebSocket(url)`) does not let you set custom headers.

The solution: pass the JWT as a **query parameter** in the WebSocket URL at connection time:
```
ws://sync-server/rooms/doc-123?token=eyJ...
```

The sync server validates the token before accepting the connection and joining the client to the room. This is a standard pattern but has a security nuance: query parameters can appear in server logs. Mitigate by using short-lived tokens or a one-time handshake token issued by the API before connecting.

---

**Q5.3 — Authentication vs authorization — what's the difference?**

- **Authentication**: "Who are you?" — verifying identity. JWT validation answers this: the signature proves the token was issued by our server for this user ID.
- **Authorization**: "Are you allowed to do this?" — verifying permission. Checking that the authenticated user has access to the specific document room answers this.

In code: auth middleware runs first (decodes JWT, puts `user_id` in request context). Then the room-join handler checks `SELECT 1 FROM document_access WHERE doc_id=$1 AND user_id=$2` — that's the authorization check.

---

## Checkpoint 6 — First AI feature: inline suggestions + SSE 📖

---

**Q6.1 — Why do you debounce AI calls, and how does your debounce work?**

This is one of the most important design decisions in the project — and an interviewer will push on the exact mechanism.

**Why debounce**: Gemini Flash free tier allows ~15 requests per minute, ~1,500 per day. A user types 60–80 WPM — that's 1 character per second. Sending an LLM request per keystroke would exhaust the daily quota in minutes and produce useless mid-word suggestions.

**How it works**:
1. The editor fires an `onUpdate` callback on every transaction
2. We track the **changed region** (which paragraphs were modified) using ProseMirror's `changedRanges`
3. A `setTimeout` (e.g., 1,500ms) is reset on every update — the timer only fires after 1.5 seconds of inactivity
4. When the timer fires, we extract only the **changed section text** (not the whole doc) and send it to FastAPI

**Why send only the changed region**: Sending the whole document on every debounce is wasteful and costs more tokens. Sending only the paragraph(s) that changed keeps prompts small and focused.

**The tradeoff**: A longer debounce (3s) = fewer API calls but slower feedback. A shorter debounce (500ms) = faster suggestions but higher cost. 1.5s is a reasonable middle ground for a writing tool.

---

**Q6.2 — Why SSE for AI streaming and WebSocket for sync? Why not use one transport for both?**

| Concern | Direction | Right transport |
|---------|-----------|-----------------|
| CRDT sync | Bidirectional (client sends updates, server relays others' updates) | WebSocket |
| AI suggestions | Server → Client only (stream LLM tokens as they arrive) | SSE |

SSE (Server-Sent Events) is a one-way server-push protocol over HTTP/1.1. It's simpler than WebSocket for server→client streaming:
- No upgrade handshake
- Automatic reconnect built into the browser's `EventSource` API
- Works through HTTP/2 multiplexing

Using WebSocket for AI streaming would work, but you'd be adding complexity (connection management, reconnection logic) for something that doesn't need bidirectionality. Using SSE for sync would require a second channel for client→server updates, introducing synchronization headaches.

**Rule of thumb**: SSE for one-way push (AI, notifications), WebSocket for bidirectional (sync, chat).

---

**Q6.3 — How does FastAPI handle streaming responses?**

FastAPI uses `StreamingResponse` with an async generator:

```python
from fastapi.responses import StreamingResponse

async def stream_suggestion(text: str):
    async for chunk in llm_client.stream(text):
        yield f"data: {chunk}\n\n"  # SSE format

@app.post("/suggest")
async def suggest(body: SuggestRequest):
    return StreamingResponse(
        stream_suggestion(body.text),
        media_type="text/event-stream"
    )
```

Each `yield` sends a chunk to the client immediately. The connection stays open until the generator is exhausted. This is why `async` matters: synchronous code would block the event loop during the LLM call, preventing FastAPI from handling other requests.

---

## Checkpoint 7 — Structured outputs & real suggestion UI 📖

---

**Q7.1 — Why use Pydantic structured outputs instead of parsing freeform LLM text?**

If you ask an LLM "suggest an improvement" and get back a prose paragraph, you have to:
1. Parse the paragraph to extract the original text, the suggestion, and the rationale
2. Handle the case where the model doesn't follow your expected format
3. Locate where in the document the suggestion applies (the model might describe it vaguely)

With structured output (JSON mode + Pydantic validation):

```python
class Suggestion(BaseModel):
    location: str          # paragraph text to locate
    original_text: str     # the specific phrase to replace
    suggested_text: str    # what to replace it with
    rationale: str         # why this is better
    confidence: float      # 0.0–1.0
```

The LLM returns valid JSON. Pydantic validates it against the schema. If it's invalid, you retry with an error message. The result is a typed Python object you can use directly — no parsing, no ambiguity.

**Key interview point**: "Structured outputs reduce the surface area where the LLM can hallucinate structure." The model still might hallucinate *content* (wrong suggestion), but it can't hallucinate *format*.

---

**Q7.2 — Why does the deterministic code apply the change to the CRDT, not the LLM?**

The LLM proposes a suggestion: `{ original_text: "the quick fox", suggested_text: "the agile fox" }`. The LLM should **never** directly modify the document — it doesn't know cursor positions, CRDT item IDs, or document structure.

The correct flow:
1. LLM returns a structured `Suggestion` object
2. Frontend uses ProseMirror's `findAll` to locate `original_text` in the document tree
3. If found, the Accept button fires `editor.commands.insertContentAt(range, suggested_text)`
4. TipTap translates that into a ProseMirror transaction → Yjs update → synced to all peers

This separation keeps the LLM in its lane (language generation) and the deterministic code in its lane (document mutation). An LLM editing the CRDT directly would bypass transaction validation, history tracking, and peer sync.

---

## Checkpoint 8 — RAG: inconsistency detection & doc Q&A 📖

---

**Q8.1 — Explain the full RAG pipeline as used in this project.**

RAG = Retrieval-Augmented Generation. The full pipeline:

1. **Chunk**: When the document is saved, split it into sections (e.g., by heading or by paragraph groups of ~300 tokens). Chunking strategy matters — too large and retrieval is imprecise; too small and you lose context.

2. **Embed**: Send each chunk to an embedding model (e.g., `text-embedding-004` via Gemini). This returns a fixed-length vector (e.g., 768 dimensions) that encodes semantic meaning. Similar text → similar vectors.

3. **Store**: Save each vector alongside its chunk text and metadata (section ID, position in doc) in `pgvector`. pgvector adds an HNSW index for approximate nearest-neighbor search.

4. **Retrieve**: When a question arrives (or when inconsistency detection runs), embed the query, then run `SELECT ... ORDER BY embedding <=> query_vector LIMIT k` to find the k most semantically similar chunks.

5. **Generate**: Send the retrieved chunks + query to the LLM as context. The LLM generates an answer grounded in the retrieved text, with citations back to the source sections.

---

**Q8.2 — Why does retrieval quality matter more than generation quality for most RAG failures?**

If you retrieve the wrong chunks, the LLM will either:
- Hallucinate an answer (no relevant context → makes something up)
- Answer from the wrong section (misleading citations)

Even the best LLM can't answer correctly from bad context. Most RAG failures in production are retrieval failures, not generation failures. Common retrieval failure modes:
- **Chunking too large**: The relevant sentence is buried in a 1,000-token chunk; the embedding averages over everything and the chunk ranks poorly
- **Chunking too small**: Context split across chunk boundaries; neither chunk alone is enough to answer
- **Keyword mismatch**: The question uses different words than the document ("decrease" vs "reduce") — dense embeddings handle this, but sparse (BM25) retrieval doesn't

**Metric to watch**: `recall@k` — what fraction of queries have the correct source chunk in the top-k results. If `recall@5` is 70%, your generation can't be more than 70% accurate regardless of model quality.

---

**Q8.3 — How does inconsistency detection work?**

When a document is saved:
1. All sections are embedded and stored in pgvector
2. For each section, retrieve the top-k most semantically similar *other* sections (excluding self)
3. For each pair of highly-similar sections (same topic), prompt the LLM:
   > "Do these two sections contain any contradictory claims? Section A says: [...]. Section B says: [...]."
4. The LLM returns a structured `Finding(section_a_id, section_b_id, contradiction_description, severity)` or null

This works because contradictions tend to occur between thematically related sections (both talk about the same deadline, spec, or constraint) — and semantic similarity retrieval surfaces those pairs efficiently.

---

**Q8.4 — What is your chunking strategy and why?**

We chunk by **document section** (heading boundaries), not by fixed token count.

**Why section-based**:
- A section has coherent meaning; a fixed 512-token window may split a sentence mid-thought
- Section metadata (heading text, position) is naturally available from the ProseMirror tree
- Inconsistencies typically occur between named sections, not within arbitrary windows

**Tradeoff**: Sections can be arbitrarily long (a 2,000-token section has a diluted embedding) or short (a one-sentence section loses context). Mitigation: cap section length at ~500 tokens and split long sections; merge adjacent short sections.

---

## Checkpoint 9 — Observability, evals & caching 📖

---

**Q9.1 — How do you evaluate a non-deterministic system like an LLM feature?**

You can't assert `output == expected_output` because the model's output varies. Instead:

1. **Golden dataset**: A manually curated set of inputs with known-correct outputs. For inconsistency detection: documents with deliberately planted contradictions. For Q&A: questions with known ground-truth answers.

2. **LLM-as-judge**: Run a second LLM call to score the primary output. "Given this question and this answer, is the answer faithful to the provided context? (1-5)". This is called **faithfulness** scoring.

3. **Metrics**:
   - **Faithfulness**: Does the answer only use information from the retrieved context? (catches hallucination)
   - **Answer relevancy**: Is the answer actually responsive to the question?
   - **Recall@k**: Does the retrieval surface the correct source chunk in the top k?
   - **Detector precision/recall**: For inconsistency detection, what fraction of planted contradictions are found vs false positives?

4. **CI gate**: Run the eval suite on every PR. If faithfulness drops below a threshold, the build fails. This is the same discipline as unit tests — except for a non-deterministic system.

---

**Q9.2 — What is semantic caching and how does it reduce cost?**

Standard caching: store `(exact_input_string) → output`. This only helps for identical requests.

Semantic caching: store `(embedding_of_input) → output`. When a new request arrives, embed it and check if any cached entry is within a cosine-similarity threshold (e.g., 0.95). If so, return the cached output without calling the LLM.

**Why this matters for LiveDocs**: Multiple users might ask the same question with slightly different wording: "What's the deadline?" vs "When is the project due?" — identical intent, different strings. Semantic cache hits both.

**Implementation**: Redis stores `(embedding_vector, output_text)` entries. On each request, embed the query, run a nearest-neighbor search over cached embeddings, return the hit if similarity > threshold.

**Measured impact**: On a corpus with repeated questions, semantic caching can cut LLM calls by 30–60%. This directly translates to cost and rate-limit savings.

---

**Q9.3 — What does Langfuse give you that logging doesn't?**

Standard logging captures that a call happened. Langfuse captures:
- **Full trace**: the prompt sent, the response received, every intermediate step in a chain
- **Token counts**: input tokens + output tokens per call (maps to cost)
- **Latency percentiles**: p50, p95, p99 per endpoint — crucial for spotting slowdowns
- **Cost attribution**: per user, per document, per feature (suggestions vs Q&A vs inconsistency)
- **A/B comparison**: compare prompt versions side by side on the same inputs

The key differentiator: Langfuse lets you replay a failing trace — see exactly what prompt was sent and what the model returned. That's impossible with `print()` logs.

---

## Checkpoint 10 — Deploy, MCP server & polish 📖

---

**Q10.1 — How does containerization enable independent deployment of the three services?**

Each service (`frontend`, `backend`, `sync-server`) has its own `Dockerfile`. Docker Compose wires them together locally. In production:
- `frontend` (Next.js) → Vercel (handles CDN, edge caching, serverless)
- `backend` (FastAPI) → Railway/Render (persistent server, can hold WebSocket-adjacent state)
- `sync-server` (Node) → Railway/Render (persistent server, needs sticky sessions for WebSocket)

Each service is independently deployable: you can redeploy `backend` with a new prompt without touching `sync-server` or rebuilding the frontend. Containers make this safe — the image is the unit of deployment, and rollback is `docker pull previous-tag`.

---

**Q10.2 — What is MCP and why is it relevant in 2026?**

MCP (Model Context Protocol) is an open protocol (developed by Anthropic) for exposing tools and data sources to LLM agents. An MCP server exposes typed functions (tools) that any MCP-compatible client (Claude Desktop, Cursor, Continue.dev) can discover and call.

For LiveDocs, we expose:
- `ask_document(doc_id, question)` — RAG Q&A over a specific document
- `find_inconsistencies(doc_id)` — run the inconsistency detector

This means a developer in Cursor can ask "What does the PRD say about the auth flow?" and Cursor (as an MCP client) calls our `ask_document` tool against their LiveDocs instance. That's a direct productivity integration — not just a standalone web app.

Why it's a hiring signal: MCP is the current standard for agent tool integration. Knowing how to expose a service as an MCP server shows awareness of the agent ecosystem, not just LLM API usage.

---

**Q10.3 — Walk me through the full architecture of LiveDocs in 2 minutes.**

*(Practice saying this out loud.)*

> LiveDocs has three services. The frontend is a Next.js app with a TipTap editor bound to a Yjs CRDT document. When a user types, TipTap fires a ProseMirror transaction that Yjs translates into a binary update. That update goes over a WebSocket to the sync server — a Node y-websocket instance. The sync server relays it to every other client connected to the same document room, and each client's Yjs doc merges the update automatically. This is conflict-free — two users can edit simultaneously and both sides converge to the same state without a server making decisions.
>
> The AI layer is completely separate. The frontend debounces keystrokes and, after 1.5 seconds of inactivity, sends the changed paragraph to a FastAPI backend. FastAPI calls Gemini Flash via an OpenAI-compatible endpoint, streams the response back as SSE, and the suggestion appears in a side panel — never interrupting typing. Suggestions are Pydantic-validated structured objects; when a user accepts one, the frontend applies the edit through the Yjs CRDT, keeping it in sync with all peers.
>
> Documents are persisted as Yjs binary state in Postgres. When a room opens, the sync server loads the latest snapshot. Sections are also embedded into pgvector for RAG — inconsistency detection and document Q&A both retrieve semantically similar chunks and ground the LLM response in them.
>
> Observability runs through Langfuse — every LLM call is traced with tokens, cost, and latency. There's a semantic cache in Redis that cuts repeated LLM calls. An eval suite with a golden dataset gates deploys — if the inconsistency detector's recall drops, CI fails.

---

**Q10.4 — What would you redesign if you started over?**

*(Pick one you genuinely believe — interviewers probe this.)*

One honest answer: **I'd evaluate `pycrdt` (the Python Yjs port) earlier before committing to the two-service split.** The Node sync server adds operational complexity — two runtimes, two deploy targets, two sets of logs. If `pycrdt` is mature enough, a single FastAPI service handling both AI and sync would simplify the architecture without sacrificing correctness. I kept Node because y-websocket is more battle-tested, but the tradeoff is real and worth validating up front.

---

## Cross-cutting questions (can come up anytime)

---

**QX.1 — How do you handle rate limits on the free Gemini tier?**

Three layers:
1. **Debounce** (CP6): don't send requests more than once per 1.5 seconds of inactivity per user
2. **Semantic cache** (CP9): reuse responses for semantically similar requests
3. **Per-user rate limiting** (CP9): Redis counter with a sliding window — each user gets N AI calls per minute. Beyond that, the request is queued or rejected with a clear error.

The free tier is ~15 RPM. With debouncing at 1.5s and a 1-user test, that's at most 40 calls/minute — already over the limit without caching. The combination of debounce + cache keeps real-world usage well under the cap.

---

**QX.2 — How do you keep the AI suggestions from interrupting the user's typing?**

Two mechanisms:
1. **Debounce**: suggestions only fire after a pause — while the user is typing, no request is sent
2. **Non-blocking UI**: suggestions appear in a side panel (or as overlays), never as forced modal interruptions. The editor's `contenteditable` is the user's domain; AI output is always in a separate zone

This is a product decision as much as a technical one. An inline autocomplete (like GitHub Copilot) that appears mid-sentence would be disruptive in a collaborative document editor where multiple people are typing.

---

**QX.3 — What's your strategy for not sending sensitive documents to the LLM?**

For the portfolio project: the Gemini free tier may use prompts for training, so we explicitly note in the README that users shouldn't input sensitive data. Architectural mitigations in a production system:
- Use a paid tier (disables training data use)
- Self-host an open-weights model (Llama, Mistral) — data never leaves your infrastructure
- PII detection before sending (scan for email addresses, phone numbers, etc.) and redact

---

*Last updated: 2026-06-07 | Checkpoint 1 complete*
