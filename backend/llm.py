import os
from typing import AsyncIterator
from openai import AsyncOpenAI

client = AsyncOpenAI(
    api_key=os.environ["GEMINI_API_KEY"],
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")

_SYSTEM = (
    "You are a writing copilot. Given the partial sentence or paragraph the user just typed, "
    "provide exactly 3 possible completions or continuations, numbered 1. 2. 3. "
    "Each option must be one sentence only. No explanations, no preamble, no extra text."
)


async def stream_suggestion(text: str) -> AsyncIterator[str]:
    stream = await client.chat.completions.create(
        model=_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": text},
        ],
        stream=True,
        max_tokens=2000,
    )
    async for chunk in stream:
        content = chunk.choices[0].delta.content
        if content:
            yield content
