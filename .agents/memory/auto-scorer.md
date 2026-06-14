---
name: Auto-scorer system
description: Two scorer systems — (1) original frame-diff camera scorer, (2) YOLOv8 AI dart detection pipeline
---

## System 1: Frame-diff camera scorer (original)

Phone camera pointed at dartboard. Frame differencing detects motion → dart landing → settle → score read. No ML model.

### Key files
- `artifacts/tkdl/src/hooks/useAutoScorer.ts` — main hook: camera lifecycle, frame diff (320×240 canvas), dart centroid detection, board mapping, SSE broadcast
- `artifacts/tkdl/src/components/auto-scorer/CameraOverlay.tsx` — visual overlay on video: board circle, dart markers, score chips. `videoRef` prop is `RefObject<HTMLVideoElement | null>` (React 19 nullable)
- `artifacts/tkdl/src/pages/scorer-camera.tsx` — standalone fullscreen X01 scorer at `/scorer/camera`; setup → game → win; manual numpad fallback; session code for display device
- `artifacts/api-server/src/routes/scorer.ts` — in-memory session store, 4-digit codes, 30-min expiry, SSE fan-out

### Settings (DB, seeded at startup)
- `auto_scorer_enabled` — global on/off toggle
- `auto_scorer_test_only` — if true, only show to admin user (Graeme)

---

## System 2: YOLOv8 AI Auto-Scorer

Real CV pipeline using YOLOv8n trained on 24k+ dart images (dart-sense architecture).
Frontend route: `/auto-scorer` page in layout nav under BOT section.

### Architecture
Python daemon spawned once by Express on first request, keeps YOLOv8n model loaded.
- Daemon: `artifacts/dart-scorer/scorer_daemon.py`
- Model: `artifacts/dart-scorer/weights.pt` (6MB YOLOv8n, ZIP/PyTorch format)
- Scorer: `artifacts/dart-scorer/scorer.py` (DartScorer class — PIL + numpy only, no cv2)
- Express route: `artifacts/api-server/src/routes/dart-scorer.ts`
  - `POST /api/dart-scorer/analyze` body: `{image: "<base64 JPEG>"}` → `{darts, total, annotatedImage, calibrationPoints}`
  - `GET /api/dart-scorer/health` → `{ready, starting, error, python, scorerDir}`
- stdio JSON-RPC: Node sends JSON line on stdin; Python returns JSON on stdout
- YOLO model load takes ~20–30s cold; health returns `{starting:true}` then `{ready:true}`

### Python venv
Virtual environment at `artifacts/dart-scorer/.venv/` managed with uv.
Installed: `ultralytics`, `opencv-python-headless`, `numpy`, `Pillow`

**Why venv:** NixOS system Python is immutable; `uv pip install --system` blocked.

### Critical NixOS dependency
`xorg.libxcb` must be installed: `installSystemDependencies({packages: ["xorg.libxcb"]})`
Both opencv variants link against `libxcb.so.1` even headless on NixOS. Without it:
`ImportError: libxcb.so.1: cannot open shared object file`

**How to apply:** If starting from a fresh Replit environment, run `installSystemDependencies` before the daemon can start. This is a one-time setup step.

### scorer.py uses PIL not cv2
Uses PIL for all image I/O and annotation (cv2 is imported by ultralytics internally).
Uses numpy SVD (DLT) instead of `cv2.findHomography` — completely cv2-free in scorer.py.
The xorg.libxcb install is still needed because ultralytics imports cv2 regardless.

### YOLO class mapping (dart-sense model)
- Class 0–3 = calibration corners (outer double ring corners of 20/6/3/11 segments)
- Class 4 = dart tip
Calibration confidence threshold: 0.85 (< 4 valid cal points → error returned)

### Node.js daemon management pattern
Buffers waiters with their base64 image until `{"ready":true}` on stdout.
Uses `try { JSON.parse(line) } catch { continue }` to skip ultralytics banner output.
Handles `error` + `close` events to reject all pending waiters gracefully.
