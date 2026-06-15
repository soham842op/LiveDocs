-- CP8: RAG — pgvector embeddings for document Q&A and inconsistency detection
--
-- Why pgvector and not a dedicated vector DB?
--   Postgres is already running (CP4). Adding an extension keeps the stack minimal
--   for a portfolio project and avoids a third managed service.
--
-- vector(3072) matches gemini-embedding-2 output, verified empirically before
-- writing this migration (test_embed.py confirmed dim=3072 for all available models).
--
-- No IVFFlat/HNSW index: portfolio-scale docs stay well under 10k rows so exact
-- nearest-neighbour scan is instant. Add an index if the row count grows.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_chunks (
  id          BIGSERIAL    PRIMARY KEY,
  doc_id      UUID         NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER      NOT NULL,
  heading     TEXT,
  content     TEXT         NOT NULL,
  embedding   vector(3072) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (doc_id, chunk_index)
);
