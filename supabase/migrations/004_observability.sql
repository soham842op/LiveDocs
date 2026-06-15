-- LLM call log: latency + token counts per request
CREATE TABLE IF NOT EXISTS llm_events (
  id                BIGSERIAL    PRIMARY KEY,
  request_id        UUID         NOT NULL,
  doc_id            UUID,
  user_id           UUID,
  endpoint          TEXT         NOT NULL,
  model             TEXT         NOT NULL,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  latency_ms        INTEGER      NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Accept / dismiss signals — implicit eval dataset
CREATE TABLE IF NOT EXISTS suggestion_events (
  id              BIGSERIAL    PRIMARY KEY,
  request_id      UUID         NOT NULL,
  doc_id          UUID,
  user_id         UUID,
  event_type      TEXT         NOT NULL CHECK (event_type IN ('accept', 'dismiss_all')),
  accepted_option TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Exact-match suggestion cache (SHA-256 key)
CREATE TABLE IF NOT EXISTS suggestion_cache (
  text_hash   TEXT         PRIMARY KEY,
  suggestions JSONB        NOT NULL,
  hit_count   INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
