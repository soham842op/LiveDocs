-- CP4: Persistence — saving and loading documents
--
-- Two tables:
--   documents      — metadata (id, title, timestamps). No 'owner' yet — auth is CP5.
--   document_snapshots — one row per doc pointing to the S3 object key.
--                        The binary CRDT state lives in S3; only the reference lives here.
--
-- Why store the S3 key in Postgres rather than computing it?
--   We get a canonical record of what has been successfully persisted and when.
--   "Has a snapshot been saved?" becomes a DB query, not a speculative S3 HEAD request.

CREATE TABLE IF NOT EXISTS documents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT        NOT NULL DEFAULT 'Untitled Document',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per document. Updated (upserted) on every debounced save.
-- PRIMARY KEY on doc_id enforces the one-snapshot-per-doc invariant at the DB level.
CREATE TABLE IF NOT EXISTS document_snapshots (
  doc_id   UUID        PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  s3_key   TEXT        NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
