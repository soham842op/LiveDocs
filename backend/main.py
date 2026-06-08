# FastAPI AI backend — stub for CP1.
# Real endpoints (suggestions, inconsistency detection, Q&A) start in CP6.
from fastapi import FastAPI

app = FastAPI(title="LiveDocs AI Backend")


@app.get("/health")
def health():
    return {"status": "ok", "checkpoint": 1}
