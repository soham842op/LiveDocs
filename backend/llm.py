import os
import json
from openai import AsyncOpenAI
from pydantic import BaseModel, ValidationError

client = AsyncOpenAI(
    api_key=os.environ["GEMINI_API_KEY"],
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

_SYSTEM = (
    "You are a writing copilot. Given the partial sentence or paragraph the user just typed, "
    "provide exactly 3 possible completions or continuations. "
    "Respond with ONLY a JSON array of exactly 3 objects. Each object must have exactly two keys: "
    "\"option\" (the continuation text, one sentence only) and "
    "\"rationale\" (one short phrase explaining why this continuation fits). "
    "No markdown, no code blocks, no preamble — output only the raw JSON array."
)


class Suggestion(BaseModel):
    option: str
    rationale: str


_INCONSISTENCY_SYSTEM = (
    "You are a document analyst. Given numbered sections of a document, identify factual inconsistencies, "
    "contradictions, or conflicting statements between different sections. "
    "Respond with ONLY a JSON array. Each element must have exactly these keys: "
    "\"section_a\" (int, first section index), "
    "\"section_b\" (int, second section index), "
    "\"description\" (string, one sentence explaining the conflict), "
    "\"severity\" (string: \"high\", \"medium\", or \"low\"). "
    "If there are no inconsistencies, return an empty array: []. "
    "No markdown, no code blocks — output raw JSON only."
)


class InconsistencyFinding(BaseModel):
    section_a: int
    section_b: int
    description: str
    severity: str


async def find_inconsistencies(sections_text: str) -> list[InconsistencyFinding]:
    response = await client.chat.completions.create(
        model=_MODEL,
        messages=[
            {"role": "system", "content": _INCONSISTENCY_SYSTEM},
            {"role": "user", "content": sections_text},
        ],
        max_tokens=2000,
    )
    content = (response.choices[0].message.content or "[]").strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    data = json.loads(content)
    return [InconsistencyFinding(**item) for item in data]


_QA_SYSTEM = (
    "You are a document assistant. Answer the user's question using ONLY the provided document sections. "
    "Cite sections inline like [Section 2]. "
    "Respond with ONLY a JSON object with exactly these keys: "
    "\"answer\" (string, your answer with inline citations) and "
    "\"citations\" (array of integer section indices you cited, e.g. [0, 2]). "
    "No markdown wrapper, no code blocks — raw JSON only."
)


async def generate_answer(question: str, chunks: list[dict]) -> dict:
    context = "\n\n".join(
        f"[Section {c['index']}{(': ' + c['heading']) if c.get('heading') else ''}]\n{c['text']}"
        for c in chunks
    )
    user_msg = f"Document sections:\n{context}\n\nQuestion: {question}"
    response = await client.chat.completions.create(
        model=_MODEL,
        messages=[
            {"role": "system", "content": _QA_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=2000,
    )
    content = (response.choices[0].message.content or "{}").strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    data = json.loads(content)
    chunk_map = {c["index"]: c for c in chunks}
    citations = [
        {
            "index": idx,
            "text": chunk_map[idx]["text"][:200],
            "heading": chunk_map[idx].get("heading"),
        }
        for idx in data.get("citations", [])
        if idx in chunk_map
    ]
    return {"answer": data.get("answer", ""), "citations": citations}


async def get_suggestions(text: str, retries: int = 2) -> tuple[list[Suggestion], dict]:
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        try:
            response = await client.chat.completions.create(
                model=_MODEL,
                messages=[
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": text},
                ],
                max_tokens=2000,
            )
            content = response.choices[0].message.content or ""
            content = content.strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            data = json.loads(content)
            usage = {
                "prompt_tokens": response.usage.prompt_tokens if response.usage else None,
                "completion_tokens": response.usage.completion_tokens if response.usage else None,
            }
            return [Suggestion(**item) for item in data], usage
        except (json.JSONDecodeError, ValidationError, Exception) as err:
            last_err = err
            if attempt < retries:
                continue
    raise last_err or RuntimeError("get_suggestions failed after retries")
