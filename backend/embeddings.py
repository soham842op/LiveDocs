import os
import numpy as np
from google import genai

_EMBED_MODEL = "gemini-embedding-2"
_client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])


async def embed_text(text: str) -> list[float]:
    result = await _client.aio.models.embed_content(model=_EMBED_MODEL, contents=text)
    return list(result.embeddings[0].values)


async def store_chunks(conn, doc_id: str, sections: list[dict]) -> int:
    import asyncio
    from pgvector.psycopg2 import register_vector

    valid = [s for s in sections if s.get("text", "").strip()]
    if not valid:
        return 0

    embeddings = await asyncio.gather(*[embed_text(s["text"]) for s in valid])

    register_vector(conn)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM document_chunks WHERE doc_id = %s::uuid", (doc_id,))
        for section, vec in zip(valid, embeddings):
            cur.execute(
                """
                INSERT INTO document_chunks (doc_id, chunk_index, heading, content, embedding)
                VALUES (%s::uuid, %s, %s, %s, %s)
                """,
                (doc_id, section["index"], section.get("heading"), section["text"], np.array(vec)),
            )
        conn.commit()
    return len(valid)


async def retrieve_similar(conn, doc_id: str, query: str, top_k: int = 5) -> list[dict]:
    from pgvector.psycopg2 import register_vector

    query_vec = await embed_text(query)
    register_vector(conn)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT chunk_index, heading, content
            FROM document_chunks
            WHERE doc_id = %s::uuid
            ORDER BY embedding <=> %s
            LIMIT %s
            """,
            (doc_id, np.array(query_vec), top_k),
        )
        rows = cur.fetchall()
    return [
        {"index": r["chunk_index"], "heading": r["heading"], "text": r["content"]}
        for r in rows
    ]
