#!/bin/bash
set -e
cd "$(dirname "$0")/artifacts/dart-scorer"
exec uvicorn main:app --host 0.0.0.0 --port "$PORT"
