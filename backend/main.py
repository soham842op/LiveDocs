from datetime import datetime, timedelta
import hashlib
import os
import time
import uuid
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
from passlib.context import CryptContext
import psycopg2
from psycopg2.extras import RealDictCursor
from llm import get_suggestions, find_inconsistencies, generate_answer
from embeddings import store_chunks, retrieve_similar
from observability import log_llm_event, log_feedback, cache_get, cache_set

app = FastAPI(title="LiveDocs Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24 * 7  # 7-day tokens

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def get_db():
    conn = psycopg2.connect(os.environ["DATABASE_URL"], cursor_factory=RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        return jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


class AuthRequest(BaseModel):
    email: str
    password: str


class ShareRequest(BaseModel):
    email: str


class SuggestRequest(BaseModel):
    text: str
    doc_id: str


class Section(BaseModel):
    index: int
    text: str
    heading: str | None = None


class EmbedRequest(BaseModel):
    sections: list[Section]


class InconsistencyRequest(BaseModel):
    sections: list[Section]


class QARequest(BaseModel):
    question: str


class FeedbackRequest(BaseModel):
    request_id: str
    event_type: str  # 'accept' or 'dismiss_all'
    doc_id: str | None = None
    accepted_option: str | None = None


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/auth/signup")
def signup(req: AuthRequest, conn=Depends(get_db)):
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Email already registered")
        password_hash = pwd_context.hash(req.password)
        cur.execute(
            "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id, email",
            (req.email, password_hash),
        )
        user = cur.fetchone()
        conn.commit()
    token = create_token(str(user["id"]), user["email"])
    return {"access_token": token, "user": {"id": str(user["id"]), "email": user["email"]}}


@app.post("/auth/login")
def login(req: AuthRequest, conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("SELECT id, email, password_hash FROM users WHERE email = %s", (req.email,))
        user = cur.fetchone()
    if not user or not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(str(user["id"]), user["email"])
    return {"access_token": token, "user": {"id": str(user["id"]), "email": user["email"]}}


@app.get("/auth/me")
def me(payload: dict = Depends(verify_token)):
    return {"id": payload["sub"], "email": payload["email"]}


# ── Documents ─────────────────────────────────────────────────────────────────

@app.get("/documents")
def list_documents(payload: dict = Depends(verify_token), conn=Depends(get_db)):
    user_id = payload["sub"]
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT d.id, d.title, d.updated_at
            FROM documents d
            LEFT JOIN document_collaborators dc ON dc.doc_id = d.id AND dc.user_id = %s::uuid
            WHERE d.owner_id = %s::uuid OR dc.user_id = %s::uuid
            ORDER BY d.updated_at DESC
            """,
            (user_id, user_id, user_id),
        )
        docs = cur.fetchall()
    return [
        {"id": str(d["id"]), "title": d["title"], "updated_at": d["updated_at"].isoformat()}
        for d in docs
    ]


@app.post("/documents")
def create_document(payload: dict = Depends(verify_token), conn=Depends(get_db)):
    user_id = payload["sub"]
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO documents (title, owner_id) VALUES ('Untitled Document', %s::uuid) RETURNING id",
            (user_id,),
        )
        doc = cur.fetchone()
        conn.commit()
    return {"id": str(doc["id"])}


@app.get("/documents/{doc_id}")
def get_document(doc_id: str, payload: dict = Depends(verify_token), conn=Depends(get_db)):
    user_id = payload["sub"]
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT d.id, d.title, d.updated_at
            FROM documents d
            LEFT JOIN document_collaborators dc ON dc.doc_id = d.id AND dc.user_id = %s::uuid
            WHERE d.id = %s::uuid
              AND (d.owner_id = %s::uuid OR dc.user_id = %s::uuid OR d.owner_id IS NULL)
            """,
            (user_id, doc_id, user_id, user_id),
        )
        doc = cur.fetchone()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or access denied")
    return {"id": str(doc["id"]), "title": doc["title"], "updated_at": doc["updated_at"].isoformat()}


@app.post("/documents/{doc_id}/share")
def share_document(
    doc_id: str,
    req: ShareRequest,
    payload: dict = Depends(verify_token),
    conn=Depends(get_db),
):
    user_id = payload["sub"]
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM documents WHERE id = %s::uuid AND owner_id = %s::uuid",
            (doc_id, user_id),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=403, detail="Only the owner can share this document")
        cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
        target = cur.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        cur.execute(
            """
            INSERT INTO document_collaborators (doc_id, user_id)
            VALUES (%s::uuid, %s::uuid)
            ON CONFLICT DO NOTHING
            """,
            (doc_id, str(target["id"])),
        )
        conn.commit()
    return {"message": "Shared successfully"}


def _assert_doc_access(cur, doc_id: str, user_id: str) -> None:
    cur.execute(
        """
        SELECT d.id FROM documents d
        LEFT JOIN document_collaborators dc ON dc.doc_id = d.id AND dc.user_id = %s::uuid
        WHERE d.id = %s::uuid
          AND (d.owner_id = %s::uuid OR dc.user_id = %s::uuid OR d.owner_id IS NULL)
        """,
        (user_id, doc_id, user_id, user_id),
    )
    if not cur.fetchone():
        raise HTTPException(status_code=403, detail="Access denied")


@app.post("/suggest")
async def suggest(req: SuggestRequest, payload: dict = Depends(verify_token), conn=Depends(get_db)):
    request_id = str(uuid.uuid4())
    user_id = payload["sub"]
    text_hash = hashlib.sha256(req.text.strip().encode()).hexdigest()

    cached = cache_get(conn, text_hash)
    if cached is not None:
        return {"request_id": request_id, "suggestions": cached, "cache_hit": True}

    t0 = time.monotonic()
    try:
        suggestions, usage = await get_suggestions(req.text)
    except Exception as err:
        print(f"[suggest] LLM error: {err}")
        raise HTTPException(status_code=502, detail="LLM unavailable")
    latency_ms = int((time.monotonic() - t0) * 1000)

    serialized = [s.model_dump() for s in suggestions]
    cache_set(conn, text_hash, serialized)
    log_llm_event(
        conn,
        request_id=request_id,
        endpoint="suggest",
        model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
        latency_ms=latency_ms,
        user_id=user_id,
        prompt_tokens=usage.get("prompt_tokens"),
        completion_tokens=usage.get("completion_tokens"),
    )
    return {"request_id": request_id, "suggestions": serialized, "cache_hit": False}


@app.post("/feedback")
def feedback(req: FeedbackRequest, payload: dict = Depends(verify_token), conn=Depends(get_db)):
    if req.event_type not in ("accept", "dismiss_all"):
        raise HTTPException(status_code=400, detail="event_type must be 'accept' or 'dismiss_all'")
    log_feedback(
        conn,
        request_id=req.request_id,
        event_type=req.event_type,
        doc_id=req.doc_id,
        user_id=payload["sub"],
        accepted_option=req.accepted_option,
    )
    return {"ok": True}


@app.post("/embed/{doc_id}")
async def embed_doc(
    doc_id: str,
    req: EmbedRequest,
    payload: dict = Depends(verify_token),
    conn=Depends(get_db),
):
    user_id = payload["sub"]
    with conn.cursor() as cur:
        _assert_doc_access(cur, doc_id, user_id)
    count = await store_chunks(conn, doc_id, [s.model_dump() for s in req.sections])
    return {"embedded": count}


@app.post("/inconsistencies/{doc_id}")
async def check_inconsistencies(
    doc_id: str,
    req: InconsistencyRequest,
    payload: dict = Depends(verify_token),
):
    if not req.sections:
        return {"findings": []}
    sections_text = "\n\n".join(
        f"[Section {s.index}{f': {s.heading}' if s.heading else ''}]\n{s.text}"
        for s in req.sections
        if s.text.strip()
    )
    try:
        findings = await find_inconsistencies(sections_text)
        return {"findings": [f.model_dump() for f in findings]}
    except Exception as err:
        print(f"[inconsistencies] LLM error: {err}")
        raise HTTPException(status_code=502, detail="LLM unavailable")


@app.post("/qa/{doc_id}")
async def qa(
    doc_id: str,
    req: QARequest,
    payload: dict = Depends(verify_token),
    conn=Depends(get_db),
):
    user_id = payload["sub"]
    with conn.cursor() as cur:
        _assert_doc_access(cur, doc_id, user_id)
    try:
        chunks = await retrieve_similar(conn, doc_id, req.question)
        if not chunks:
            return {
                "answer": "No content indexed for this document yet. Write something and ask again.",
                "citations": [],
            }
        return await generate_answer(req.question, chunks)
    except Exception as err:
        print(f"[qa] error: {err}")
        raise HTTPException(status_code=502, detail="LLM unavailable")


@app.get("/health")
def health():
    return {"status": "ok", "checkpoint": 9}
