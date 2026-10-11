#!/usr/bin/env python3
"""
DEV-ONLY: fix the two raster shirt defects found by the 250-kit pixel audit.
  kit-50-01   garment cropped by the canvas edges  -> reframed with the collection's margins
  kit-250-133 chroma-key green block beside garment -> keyed out, green spill removed

Same IDs and file names; transparent 768x768 WebP like every other kit.
  python3 scripts/kit-audit/fix-raster-defects.py [out_dir]
"""
import os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LIB = os.path.join(ROOT, "public/assets/career-kit-library")
OUT = sys.argv[1] if len(sys.argv) > 1 else LIB
N = 768
TARGET_H = 690  # median garment height across the collection (bbox of alpha > 0.5)


def load(name):
    return Image.open(os.path.join(LIB, name)).convert("RGBA")


def save(im, name):
    im.save(os.path.join(OUT, name), "WEBP", quality=92, method=6)
    return name


def refit(im, height=TARGET_H):
    """Scale the garment to the collection height and centre it on a transparent canvas."""
    a = np.asarray(im)[..., 3]
    ys, xs = np.where(a > 128)
    crop = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    s = min(height / crop.height, (N - 40) / crop.width)
    crop = crop.resize((round(crop.width * s), round(crop.height * s)), Image.LANCZOS)
    out = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    out.alpha_composite(crop, ((N - crop.width) // 2, (N - crop.height) // 2))
    return out


def unkey_green(im):
    px = np.asarray(im).astype(np.int32)
    r, g, b, a = px[..., 0], px[..., 1], px[..., 2], px[..., 3]
    key = (g > 120) & (g > r + 60) & (g > b + 60)
    a = np.where(key, 0, a)
    spill = (g > np.maximum(r, b)) & ~key & (a > 0)        # green fringe on the garment edge
    g = np.where(spill, np.maximum(r, b), g)
    return Image.fromarray(np.dstack([r, g, b, a]).clip(0, 255).astype(np.uint8), "RGBA")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    print(save(refit(load("kit-50-01.webp"), 660), "kit-50-01.webp"))
    print(save(refit(unkey_green(load("kit-250-133.webp"))), "kit-250-133.webp"))

