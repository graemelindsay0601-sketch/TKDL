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
import traceback

def main():
    # Load model
    try:
        from scorer import DartScorer
        weights = os.path.join(os.path.dirname(__file__), "weights.pt")
        scorer_obj = DartScorer(weights)
        print(json.dumps({"ready": True, "model": weights}), flush=True)
    except Exception as exc:
        print(json.dumps({"ready": False, "error": str(exc)}), flush=True)
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
