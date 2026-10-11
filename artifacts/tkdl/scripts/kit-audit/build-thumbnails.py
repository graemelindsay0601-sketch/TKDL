#!/usr/bin/env python3
"""DEV-ONLY: 256px renditions of every kit for compact/standard shirt sizes (rankings rows, directory
cards, player cards). The 768px artwork stays the source for featured/profile views.
  python3 scripts/kit-audit/build-thumbnails.py"""
import os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LIB = os.path.join(ROOT, "public/assets/career-kit-library"); OUT = os.path.join(LIB, "thumb")
os.makedirs(OUT, exist_ok=True)
for f in sorted(os.listdir(LIB)):
    if f.endswith(".webp"):
        Image.open(os.path.join(LIB, f)).convert("RGBA").resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, f), "WEBP", quality=86, method=6)
print(len(os.listdir(OUT)), "thumbnails")
