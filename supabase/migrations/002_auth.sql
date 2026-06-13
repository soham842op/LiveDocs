-- CP5: Authentication & document ownership
--
-- We roll our own JWT (not Supabase Auth), so auth.uid() in RLS policies
-- would return NULL for every request — our tokens are not Supabase-issued.
-- Authorization is enforced at the app layer instead:
--   FastAPI checks owner_id / document_collaborators for HTTP routes.
--   The sync server verifies the same before accepting a WebSocket room join.
-- RLS stays disabled (as in CP4) to avoid the silent denial trap.

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- owner_id is nullable so CP4 documents (which predate auth) keep working.
-- The sync server admits any authenticated user to docs where owner_id IS NULL.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);

-- Collaborators: users the owner has explicitly shared a document with.
CREATE TABLE IF NOT EXISTS document_collaborators (
  doc_id     UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (doc_id, user_id)
);
