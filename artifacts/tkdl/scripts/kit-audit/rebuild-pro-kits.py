#!/usr/bin/env python3
"""
DEV-ONLY: rebuild the ten "Pro" Career kits (kit-pro-01..10) as photographic garments.

The originals were flat 1 KB clip-art SVGs, visibly below the 240 photographic shirts.
Each rebuild prints the design described in kit-catalog.ts (the authored brief) onto the
real fabric shading, folds, collar, seams and alpha of a plain studio shirt from the same
collection:
  kit-100-06 (mandarin performance top)  -> zip / stand / crew cuts
  kit-100-29 (three-button polo)         -> polo cuts
Per base, pixels are clustered into fabric panels; each panel's luminance relative to its
own mean is the shading map, so seams stay sharp and there are no halos. The kit IDs are
unchanged; only the image becomes kit-pro-XX.webp.

  python3 scripts/kit-audit/rebuild-pro-kits.py [out_dir]
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LIB = os.path.join(ROOT, "public/assets/career-kit-library")
OUT = sys.argv[1] if len(sys.argv) > 1 else LIB
N, SS = 768, 2  # output size, supersampling for drawn artwork


def hexrgb(h):
    h = h.lstrip("#"); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float) / 255


def load_base(name, k):
    im = np.asarray(Image.open(os.path.join(LIB, name)).convert("RGBA")).astype(float) / 255
    rgb, a = im[..., :3], im[..., 3]
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
    m = a > 0.6
    mx, mn = rgb.max(-1), rgb.min(-1); sat = (mx - mn) / np.maximum(mx, 1e-3)
    hue = (np.degrees(np.arctan2(np.sqrt(3) * (rgb[..., 1] - rgb[..., 2]), 2 * rgb[..., 0] - rgb[..., 1] - rgb[..., 2])) + 360) % 360
    # Explicit panel rules per base (dye, not light): 0 = body, then trim panels.
    seg = np.zeros(a.shape, int)
    if name == "kit-100-06.webp":    # red body | white side panels | black inserts
        red = ((hue < 25) | (hue > 335)) & (sat > 0.2)
        seg[~red & (mx > 0.5)] = 1; seg[~red & (mx <= 0.5)] = 2
    elif name == "kit-100-29.webp":  # cream body | green sleeves | maroon side panels
        green = (hue > 70) & (hue < 180) & (sat > 0.3)
        maroon = ((hue < 30) | (hue > 320)) & (sat > 0.35) & (mx < 0.6)
        seg[green] = 1; seg[maroon] = 2
        # checkered sleeve cuffs: everything below the green sleeve within the sleeve columns -> own panel (3)
        ys, xs = np.where(m); x0, x1 = xs.min(), xs.max(); w = x1 - x0
        cols = np.arange(a.shape[1]); side = (cols < x0 + .16 * w) | (cols > x1 - .16 * w)  # outside the torso
        rows = np.arange(a.shape[0])[:, None]; y0 = np.where(m)[0].min(); h = np.where(m)[0].max() - y0
        sleeve_zone = side[None, :] & (rows < y0 + .55 * h) & (rows > y0 + .12 * h)
        seg[sleeve_zone & m & ~green] = 3   # outside the torso a sleeve is green fabric or its cuff
    seg[~m] = -1
    lbl = Image.fromarray((seg + 1).astype(np.uint8)).filter(ImageFilter.ModeFilter(7))
    seg = np.where(m, np.asarray(lbl).astype(int) - 1, -1)
    k = int(seg.max()) + 1
    shade = np.zeros_like(lum)
    for i in range(k):
        s = seg == i
        if s.any(): shade[s] = lum[s] / max(np.percentile(lum[s], 60), 1e-3)
    # pixels not confidently assigned (soft edge) use the body normalisation
    # trim panels carry the base's printed texture (checker cuffs, mottled side print): keep only their folds
    for i in range(1, k):
        si = seg == i
        if si.any() and name == "kit-100-29.webp":
            sm = np.asarray(Image.fromarray((np.clip(shade, 0, 2) * 120).astype(np.uint8)).filter(ImageFilter.MedianFilter(9)).filter(ImageFilter.GaussianBlur(3))).astype(float) / 120
            if i == 3:  # cuffs: remove the checker entirely, keep the light falloff
                sm = np.asarray(Image.fromarray((np.clip(shade, 0, 2) * 120).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9))).astype(float) / 120
            shade[si] = sm[si]
    soft = (seg == -1) & (a > 0)
    shade[soft] = lum[soft] / max(np.percentile(lum[seg == 0], 60), 1e-3)
    seg[soft] = 0
    ys, xs = np.where(a > 0.5)
    return dict(alpha=a, shade=np.clip(shade, 0, 2.2), seg=seg, bbox=(xs.min(), ys.min(), xs.max(), ys.max()))


def canvas():
    return Image.new("RGB", (N * SS, N * SS)), None


def finish(img):
    return np.asarray(img.resize((N, N), Image.LANCZOS)).astype(float) / 255


def grad(c1, c2, angle=90):
    """Linear gradient canvas (supersampled)."""
    t = np.linspace(0, 1, N * SS)
    xx, yy = np.meshgrid(t, t)
    r = math.radians(angle); g = np.clip(xx * math.cos(r) + yy * math.sin(r), 0, 1)
    g = (g - g.min()) / max(g.max() - g.min(), 1e-6)
    a, b = hexrgb(c1), hexrgb(c2)
    return Image.fromarray((np.clip(a + (b - a) * g[..., None], 0, 1) * 255).astype(np.uint8))


def P(x, y, bb):
    """Garment-relative coordinates (0..1 of the garment bbox) -> supersampled pixels."""
    x0, y0, x1, y1 = bb
    return ((x0 + (x1 - x0) * x) * SS, (y0 + (y1 - y0) * y) * SS)


def compose(base, body, panels, out_name, gloss=0.28):
    """body: HxWx3 artwork for panel 0; panels: {panel_index: hex or HxWx3} for the others."""
    shade, seg, a = base["shade"], base["seg"], base["alpha"]
    col = body.copy()
    for i, c in panels.items():
        s = seg == i
        col[s] = (c[s] if isinstance(c, np.ndarray) else hexrgb(c))
    sh = shade[..., None]
    lit = col * np.minimum(sh, 1.0) + (1 - col) * np.clip(sh - 1.0, 0, 1) * gloss
    out = np.dstack([np.clip(lit, 0, 1), a])
    Image.fromarray((out * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, out_name), "WEBP", quality=90, method=6)
    return out_name


def weave(img, c, step=6, alpha=40, angle=1):
    """Fine diagonal knit/carbon weave over a canvas."""
    d = ImageDraw.Draw(img, "RGBA"); r, g, b = (hexrgb(c) * 255).astype(int)
    for i in range(-N * SS, N * SS * 2, step * SS):
        d.line([(i, 0), (i + angle * N * SS, N * SS)], fill=(r, g, b, alpha), width=SS)
    return img


def rgba(c, al=255):
    r, g, b = (hexrgb(c) * 255).astype(int); return (r, g, b, al)


def designs():
    pt = load_base("kit-100-06.webp", 4)   # performance top
    po = load_base("kit-100-29.webp", 5)   # polo
    out = []

    # 01 Carbon Crown — ink knit, champagne crown, engineered shoulder seams
    bb = pt["bbox"]; img = grad("#1b2130", "#0a0d14", 90); weave(img, "#2a3346", 5, 70)
    d = ImageDraw.Draw(img, "RGBA")
    crown = [P(.18, .34, bb), P(.32, .22, bb), P(.42, .31, bb), P(.5, .17, bb), P(.58, .31, bb), P(.68, .22, bb), P(.82, .34, bb), P(.78, .40, bb), P(.22, .40, bb)]
    d.polygon(crown, fill=rgba("#d8b46a", 235)); d.line(crown + [crown[0]], fill=rgba("#f3e2b4"), width=3 * SS)
    for s in (-1, 1):
        d.line([P(.5 + s * .1, .05, bb), P(.5 + s * .34, .2, bb), P(.5 + s * .4, .42, bb)], fill=rgba("#d8b46a", 200), width=3 * SS)
    out.append(compose(pt, finish(img), {1: "#cdb07a", 2: "#0b0e14", 3: "#151a24"}, "kit-pro-01.webp"))

    # 02 Redline Atelier — deep navy, scarlet speed panels, ivory pinline (polo)
    bb = po["bbox"]; img = grad("#1a2a4d", "#0d1730", 90); d = ImageDraw.Draw(img, "RGBA")
    for s, x in ((-1, .0), (1, 1.0)):
        poly = [P(x, .28, bb), P(x + s * -.36, .55, bb), P(x + s * -.2, 1.0, bb), P(x, 1.0, bb)]
        d.polygon(poly, fill=rgba("#c3202f")); d.line([poly[0], poly[1], poly[2]], fill=rgba("#f1e8d6"), width=3 * SS)
    out.append(compose(po, finish(img), {1: "#13213f", 2: "#b21c2a", 3: "#efe6d2"}, "kit-pro-02.webp"))

    # 03 Verdant Circuit — forest knit, copper circuit motif, clean piping
    bb = pt["bbox"]; img = grad("#1f4a37", "#10291e", 90); weave(img, "#2c5e46", 7, 50)
    d = ImageDraw.Draw(img, "RGBA"); rng = np.random.default_rng(3)
    for _ in range(14):
        x, y = rng.uniform(.18, .82), rng.uniform(.28, .92); pts = [P(x, y, bb)]
        for _ in range(4):
            if rng.random() < .5: x += rng.choice([-1, 1]) * rng.uniform(.05, .14)
            else: y += rng.uniform(.04, .1)
            pts.append(P(min(max(x, .1), .9), min(y, .98), bb))
        d.line(pts, fill=rgba("#c67b42", 230), width=3 * SS, joint="curve")
        for p in (pts[0], pts[-1]): d.ellipse([p[0] - 6 * SS, p[1] - 6 * SS, p[0] + 6 * SS, p[1] + 6 * SS], outline=rgba("#e9a066"), width=2 * SS)
    out.append(compose(pt, finish(img), {1: "#c67b42", 2: "#0f2219", 3: "#173a2a"}, "kit-pro-03.webp"))

    # 04 Copper Tide — burnished copper rings through midnight fabric (polo)
    bb = po["bbox"]; img = grad("#16213a", "#0b1222", 90); d = ImageDraw.Draw(img, "RGBA")
    cx, cy = P(.92, .86, bb)
    for i, r in enumerate(range(80, 760, 48)):
        c = ["#a85a2c", "#d48a4f", "#efb27a"][i % 3]
        d.ellipse([cx - r * SS, cy - r * SS, cx + r * SS, cy + r * SS], outline=rgba(c, 235 - i * 8), width=(5 if i % 3 == 1 else 2) * SS)
    out.append(compose(po, finish(img), {1: "#0f1830", 2: "#b8693a", 3: "#d48a4f"}, "kit-pro-04.webp"))

    # 05 After Hours — violet star geometry on charcoal night-stage shirt
    bb = pt["bbox"]; img = grad("#2a2b33", "#141419", 90); d = ImageDraw.Draw(img, "RGBA")
    cx, cy = P(.5, .52, bb); R = (bb[2] - bb[0]) * .3 * SS
    star = [(cx + (R if i % 2 == 0 else R * .42) * math.cos(math.pi / 4 * i / 1 - math.pi / 2 + (0 if i % 2 == 0 else 0)),
             cy + (R if i % 2 == 0 else R * .42) * math.sin(math.pi / 4 * i - math.pi / 2)) for i in range(16)]
    star = [(cx + (R if i % 2 == 0 else R * .42) * math.cos(2 * math.pi * i / 16 - math.pi / 2), cy + (R if i % 2 == 0 else R * .42) * math.sin(2 * math.pi * i / 16 - math.pi / 2)) for i in range(16)]
    for i in range(0, 16, 2):
        d.polygon([(cx, cy), star[i], star[(i + 1) % 16]], fill=rgba("#7d4fe0", 230)); d.polygon([(cx, cy), star[(i + 1) % 16], star[(i + 2) % 16]], fill=rgba("#a681ff", 230))
    for x, y, s in ((.2, .3, 6), (.8, .36, 5), (.26, .78, 4), (.76, .84, 6), (.62, .22, 3)):
        p = P(x, y, bb); d.ellipse([p[0] - s * SS, p[1] - s * SS, p[0] + s * SS, p[1] + s * SS], fill=rgba("#c9b2ff"))
    out.append(compose(pt, finish(img), {1: "#7d4fe0", 2: "#121217", 3: "#24242b"}, "kit-pro-05.webp"))

    # 06 Northern Chevron — jade and gold chevrons, restrained ice-white seam
    bb = pt["bbox"]; img = grad("#23786a", "#124a41", 90); d = ImageDraw.Draw(img, "RGBA")
    for i, y in enumerate((.3, .42, .54)):
        c = "#d8ad52" if i != 1 else "#f0d27e"
        d.polygon([P(.06, y, bb), P(.5, y + .12, bb), P(.94, y, bb), P(.94, y + .06, bb), P(.5, y + .18, bb), P(.06, y + .06, bb)], fill=rgba(c, 240))
    out.append(compose(pt, finish(img), {1: "#e7f1f1", 2: "#0f3b34", 3: "#1d6457"}, "kit-pro-06.webp"))

    # 07 Signal Point — warm ochre burst lines over tailored graphite
    bb = pt["bbox"]; img = grad("#3a3e46", "#1f2228", 90); weave(img, "#474b55", 5, 60, -1)
    d = ImageDraw.Draw(img, "RGBA"); ox, oy = P(.1, .95, bb)
    for i in range(22):
        ang = math.radians(-82 + i * 3.6); L = (bb[2] - bb[0]) * SS * (1.1 if i % 2 else .8)
        d.line([(ox, oy), (ox + L * math.cos(ang), oy + L * math.sin(ang))], fill=rgba("#e09a33" if i % 3 else "#f6c46b", 220), width=(4 if i % 3 == 0 else 2) * SS)
    out.append(compose(pt, finish(img), {1: "#e09a33", 2: "#17191e", 3: "#2c2f35"}, "kit-pro-07.webp"))

    # 08 Club Standard — cobalt blockwork, bright scarlet details (polo)
    bb = po["bbox"]; img = grad("#2453c4", "#183c96", 90); d = ImageDraw.Draw(img, "RGBA")
    for j, y in enumerate((.36, .52, .68, .84)):
        for i in range(6):
            if (i + j) % 2: d.rectangle([P(i / 6, y, bb), P((i + 1) / 6, y + .16, bb)], fill=rgba("#16307a"))
    d.rectangle([P(0, .3, bb), P(1, .33, bb)], fill=rgba("#d72b36")); d.rectangle([P(0, .335, bb), P(1, .345, bb)], fill=rgba("#f2f2f2"))
    out.append(compose(po, finish(img), {1: "#1a3a8f", 2: "#d72b36", 3: "#f2f2f2"}, "kit-pro-08.webp"))

    # 09 Rose Circuit — magenta panels framed by pale woven lines on a dark body
    bb = pt["bbox"]; img = grad("#201d27", "#121016", 90); d = ImageDraw.Draw(img, "RGBA")
    for x0, x1 in ((.2, .44), (.56, .8)):
        d.rectangle([P(x0, .26, bb), P(x1, .96, bb)], fill=rgba("#cf2f7c"))
        for k in range(3):
            d.rectangle([P(x0 - .02 - k * .012, .24 - k * .012, bb), P(x1 + .02 + k * .012, .98, bb)], outline=rgba("#efd8e3", 160 - k * 45), width=2 * SS)
    out.append(compose(pt, finish(img), {1: "#cf2f7c", 2: "#121016", 3: "#2a2632"}, "kit-pro-09.webp"))

    # 10 Midnight Relay — teal circuit traces on black technical base, gold finishing
    bb = pt["bbox"]; img = grad("#14161b", "#07080b", 90); weave(img, "#1d2027", 4, 80)
    d = ImageDraw.Draw(img, "RGBA"); rng = np.random.default_rng(11)
    for _ in range(18):
        x, y = rng.uniform(.12, .88), rng.uniform(.3, .95); pts = [P(x, y, bb)]
        for _ in range(5):
            if rng.random() < .55: x = min(max(x + rng.choice([-1, 1]) * rng.uniform(.04, .12), .08), .92)
            else: y = min(y + rng.uniform(.03, .08), .98)
            pts.append(P(x, y, bb))
        d.line(pts, fill=rgba("#2bb8a9", 235), width=2 * SS)
        p = pts[-1]; d.rectangle([p[0] - 5 * SS, p[1] - 5 * SS, p[0] + 5 * SS, p[1] + 5 * SS], fill=rgba("#7fe6d9"))
    d.line([P(.5, .02, bb), P(.5, .3, bb)], fill=rgba("#c9a24f"), width=4 * SS)
    out.append(compose(pt, finish(img), {1: "#c9a24f", 2: "#06070a", 3: "#16181e"}, "kit-pro-10.webp"))
    return out


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for f in designs(): print(os.path.join(OUT, f))
