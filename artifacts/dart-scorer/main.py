"""
Dart Scorer — FastAPI service wrapping YOLOv8 dart detection.
Accepts base64-encoded JPEG images, returns dart detections as JSON.
"""
import os
import base64
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

scorer = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global scorer
    from scorer import DartScorer
    weights = os.path.join(os.path.dirname(__file__), "weights.pt")
    scorer = DartScorer(weights)
    print(f"[dart-scorer] Model loaded from {weights}", flush=True)
    yield
    scorer = None


app = FastAPI(title="Dart Auto-Scorer", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    image: str  # base64-encoded JPEG


@app.get("/")
def root():
    return {"ok": True, "service": "dart-scorer"}


@app.get("/dart-scorer/health")
def health():
    return {
        "ok": True,
        "ready": scorer is not None,
        "starting": scorer is None,
        "modelLoaded": scorer is not None,
    }


@app.post("/dart-scorer/analyze")
async def analyze(request: AnalyzeRequest):
    if scorer is None:
        raise HTTPException(503, "Model not loaded yet — retry in a moment")
    try:
        image_bytes = base64.b64decode(request.image)
    except Exception:
        raise HTTPException(400, "Invalid base64 image data")
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, scorer.analyze_image, image_bytes)
    return JSONResponse(content=result)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8090))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
