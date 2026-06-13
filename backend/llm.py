import os
from typing import AsyncIterator
from openai import AsyncOpenAI

client = AsyncOpenAI(
    api_key=os.environ["GEMINI_API_KEY"],
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

_MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")

_SYSTEM = (
    "You are a writing copilot. Given the paragraph the user just typed, "
    "provide one brief, concrete suggestion — a continuation, a phrasing improvement, "
    "or a clarifying detail. Stay within 2-3 sentences. Do not explain yourself."
)


async def stream_suggestion(text: str) -> AsyncIterator[str]:
    stream = await client.chat.completions.create(
        model=_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": text},
        ],
        stream=True,
        max_tokens=150,
    )
    async for chunk in stream:
        content = chunk.choices[0].delta.content
        if content:
            yield content
