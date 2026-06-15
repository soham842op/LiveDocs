import json


def log_llm_event(
    conn,
    request_id: str,
    endpoint: str,
    model: str,
    latency_ms: int,
    doc_id: str | None = None,
    user_id: str | None = None,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
) -> None:
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO llm_events
                  (request_id, doc_id, user_id, endpoint, model, prompt_tokens, completion_tokens, latency_ms)
                VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s, %s)
                """,
                (request_id, doc_id, user_id, endpoint, model, prompt_tokens, completion_tokens, latency_ms),
            )
            conn.commit()
    except Exception as exc:
        print(f"[observability] log_llm_event failed: {exc}")


def log_feedback(
    conn,
    request_id: str,
    event_type: str,
    doc_id: str | None = None,
    user_id: str | None = None,
    accepted_option: str | None = None,
) -> None:
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO suggestion_events
                  (request_id, doc_id, user_id, event_type, accepted_option)
                VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s)
                """,
                (request_id, doc_id, user_id, event_type, accepted_option),
            )
            conn.commit()
    except Exception as exc:
        print(f"[observability] log_feedback failed: {exc}")


def cache_get(conn, text_hash: str) -> list | None:
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT suggestions FROM suggestion_cache WHERE text_hash = %s",
                (text_hash,),
            )
            row = cur.fetchone()
        if row is None:
            return None
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE suggestion_cache SET hit_count = hit_count + 1 WHERE text_hash = %s",
                (text_hash,),
            )
            conn.commit()
        return row["suggestions"]
    except Exception as exc:
        print(f"[observability] cache_get failed: {exc}")
        return None


def cache_set(conn, text_hash: str, suggestions: list) -> None:
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO suggestion_cache (text_hash, suggestions)
                VALUES (%s, %s)
                ON CONFLICT (text_hash) DO NOTHING
                """,
                (text_hash, json.dumps(suggestions)),
            )
            conn.commit()
    except Exception as exc:
        print(f"[observability] cache_set failed: {exc}")
