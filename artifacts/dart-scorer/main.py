"""
Dart Scorer — FastAPI service wrapping YOLOv8 dart detection.
Routes at /dart-scorer/* (matched by the shared proxy from artifact.toml).
"""
import os
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

scorer = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global scorer
    from scorer import DartScorer
    weights = os.path.join(os.path.dirname(__file__), "weights.pt")
    scorer = DartScorer(weights)
    print(f"[dart-scorer] Model loaded from {weights}")
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


@app.get("/dart-scorer/health")
def health():
    return {"ok": True, "modelLoaded": scorer is not None}


@app.post("/dart-scorer/analyze")
async def analyze(file: UploadFile = File(...)):
    if scorer is None:
        raise HTTPException(503, "Model not loaded yet — retry in a moment")

    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, scorer.analyze_image, data)
    return JSONResponse(content=result)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8090))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
