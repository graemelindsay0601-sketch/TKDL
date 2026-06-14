"""
scorer_daemon.py — persistent YOLO scoring process.
Node.js spawns this once; the model stays loaded in memory.
Protocol: one JSON object per line on stdin, one JSON object per line on stdout.
Request:  {"image": "<base64 jpg>"}
Response: {"darts": [...], "total": 0, "annotatedImage": "...", "calibrationPoints": 0}
         or {"error": "..."}
"""
import sys
import json
import base64
import os
import subprocess
import traceback


def ensure_packages():
    """Auto-install required packages if they're missing (handles fresh Render deploys)."""
    required = [
        ("ultralytics", "ultralytics>=8.2.0"),
        ("cv2",         "opencv-python-headless>=4.9.0"),
        ("PIL",         "Pillow"),
        ("numpy",       "numpy>=1.24.0"),
    ]
    missing = []
    for import_name, pip_spec in required:
        try:
            __import__(import_name)
        except ImportError:
            missing.append(pip_spec)

    if missing:
        print(json.dumps({"status": f"Installing missing packages: {', '.join(missing)}"}), flush=True)
        try:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", "--quiet"] + missing,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
        except subprocess.CalledProcessError as e:
            print(json.dumps({"ready": False, "error": f"pip install failed: {e.stderr.decode()[:300] if e.stderr else str(e)}"}), flush=True)
            sys.exit(1)


def main():
    # Ensure packages are installed (no-op if already present)
    ensure_packages()

    # Load model
    try:
        from scorer import DartScorer
        weights = os.path.join(os.path.dirname(__file__), "weights.pt")
        if not os.path.exists(weights):
            print(json.dumps({"ready": False, "error": f"weights.pt not found at: {weights}"}), flush=True)
            sys.exit(1)
        scorer_obj = DartScorer(weights)
        print(json.dumps({"ready": True, "model": weights}), flush=True)
    except Exception as exc:
        print(json.dumps({"ready": False, "error": str(exc), "trace": traceback.format_exc()[-600:]}), flush=True)
        sys.exit(1)

    for raw_line in sys.stdin:
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        try:
            req = json.loads(raw_line)
            img_bytes = base64.b64decode(req["image"])
            result = scorer_obj.analyze_image(img_bytes)
            print(json.dumps(result), flush=True)
        except Exception as exc:
            print(json.dumps({
                "error": str(exc),
                "trace": traceback.format_exc()[-400:],
                "darts": [],
                "total": 0,
                "calibrationPoints": 0,
            }), flush=True)


if __name__ == "__main__":
    main()
