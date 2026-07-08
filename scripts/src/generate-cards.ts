/**
 * TKDL Card Clash – PNG Card Generator
 * Generates 100 card fronts + 6 card backs across 6 categories.
 * Output: artifacts/tkdl/public/cards/
 */
import { createCanvas, loadImage, type Image, type SKRSContext2D } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../../artifacts/tkdl/public/cards');
mkdirSync(OUT, { recursive: true });

const W = 400, H = 560;
type Ctx = SKRSContext2D;
type Rarity = 'COMMON' | 'RARE' | 'LEGENDARY';
type Category = 'x01-good' | 'x01-bad' | 'cricket-good' | 'cricket-bad' | 'wildcard-good' | 'wildcard-bad';

interface CardDef {
  id: string; num: number; name: string;
  rarity: Rarity; category: Category;
  visual: string[]; vsize: number;
  effect: string; flavor: string;
}

/* ── Colour palettes ──────────────────────────────────────────── */
const CAT_COLOR: Record<Category, string> = {
  'x01-good':      '#1a88ff',
  'x01-bad':       '#ee2222',
  'cricket-good':  '#00cc44',
  'cricket-bad':   '#9911dd',
  'wildcard-good': '#ffaa00',
  'wildcard-bad':  '#cc0033',
};
const CAT_LABEL: Record<Category, string> = {
  'x01-good':      'X01 GOOD',
  'x01-bad':       'X01 BAD',
  'cricket-good':  'CRICKET GOOD',
  'cricket-bad':   'CRICKET BAD',
  'wildcard-good': 'WILDCARD GOOD',
  'wildcard-bad':  'WILDCARD BAD',
};
const CAT_ICON: Record<Category, string> = {
  'x01-good':      '⊙',
  'x01-bad':       '⊗',
  'cricket-good':  '⊜',
  'cricket-bad':   '⊜',
  'wildcard-good': '★',
  'wildcard-bad':  '★',
};
const RARITY_COLOR: Record<Rarity, string> = {
  COMMON:    '#99aacc',
  RARE:      '#44aaff',
  LEGENDARY: '#ffcc00',
};
const RARITY_BADGE: Record<Rarity, string> = {
  COMMON:    '◆ COMMON',
  RARE:      '◆ RARE',
  LEGENDARY: '♛ LEGENDARY',
};

/* ── Hex → {r,g,b} ───────────────────────────────────────────── */
function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function rgba(hex: string, a: number) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/* ── Rounded rectangle path ──────────────────────────────────── */
function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/* ── Word-wrap text, returns height used ──────────────────────── */
function wrapText(ctx: Ctx, text: string, cx: number, y: number, maxW: number, lh: number): number {
  const words = text.split(' ');
  let line = '';
  let rows = 0;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) {
      ctx.fillText(line, cx, y + rows * lh);
      line = w; rows++;
    } else { line = t; }
  }
  if (line) { ctx.fillText(line, cx, y + rows * lh); rows++; }
  return rows * lh;
}

/* ── Draw a stylised dartboard ───────────────────────────────── */
const SEG_ORDER = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];

function drawDartboard(ctx: Ctx, cx: number, cy: number, R: number, catHex: string, alpha: number) {
  const seg = (2 * Math.PI) / 20;
  const off = -Math.PI / 2 - seg / 2; // start top

  // Outer glow ring
  const grd = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 1.2);
  grd.addColorStop(0,   rgba(catHex, alpha * 0.3));
  grd.addColorStop(0.5, rgba(catHex, alpha * 0.15));
  grd.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.2, 0, Math.PI * 2); ctx.fill();

  // Board face – very dark
  ctx.fillStyle = '#0d0d0d';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  // Segments
  const zones = [
    { inner: 0.0,  outer: 0.63, darkA: '#1a1a1a', darkB: '#1a1a1a' },  // single (outer)
    { inner: 0.63, outer: 0.72, darkA: '#880000', darkB: '#004400' },  // treble
    { inner: 0.72, outer: 0.95, darkA: '#141414', darkB: '#141414' },  // single (inner)
    { inner: 0.95, outer: 1.0,  darkA: '#880000', darkB: '#004400' },  // double
  ];

  for (let i = 0; i < 20; i++) {
    const a1 = off + i * seg;
    const a2 = a1 + seg;
    const isEven = i % 2 === 0;

    for (const z of zones) {
      const r1 = R * z.inner, r2 = R * z.outer;
      ctx.beginPath();
      ctx.moveTo(cx + r1 * Math.cos(a1), cy + r1 * Math.sin(a1));
      ctx.arc(cx, cy, r2, a1, a2);
      ctx.arc(cx, cy, r1, a2, a1, true);
      ctx.closePath();
      ctx.fillStyle = isEven ? z.darkA : z.darkB;
      ctx.fill();
    }

    // Segment divider lines
    ctx.strokeStyle = rgba(catHex, 0.2);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.04 * Math.cos(a1), cy + R * 0.04 * Math.sin(a1));
    ctx.lineTo(cx + R * Math.cos(a1), cy + R * Math.sin(a1));
    ctx.stroke();
  }

  // Treble + double ring edge glow
  const thinRings = [0.63, 0.72, 0.95, 1.0];
  for (const frac of thinRings) {
    ctx.strokeStyle = rgba(catHex, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R * frac, 0, Math.PI * 2); ctx.stroke();
  }

  // Outer bull (green)
  ctx.fillStyle = '#004400';
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba(catHex, 0.5); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.08, 0, Math.PI * 2); ctx.stroke();

  // Inner bull (red)
  ctx.fillStyle = '#880000';
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.04, 0, Math.PI * 2); ctx.fill();

  // Bull glow
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.08);
  bg.addColorStop(0, rgba(catHex, 0.6));
  bg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.08, 0, Math.PI * 2); ctx.fill();

  // Number labels (tiny, around the board edge)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(R * 0.085)}px sans-serif`;
  ctx.fillStyle = rgba('#ffffff', 0.55);
  for (let i = 0; i < 20; i++) {
    const angle = off + (i + 0.5) * seg;
    const lr = R * 1.08;
    ctx.fillText(String(SEG_ORDER[i]), cx + lr * Math.cos(angle), cy + lr * Math.sin(angle));
  }
}

/* ── Radial light beams ──────────────────────────────────────── */
function drawLightBeams(ctx: Ctx, cx: number, cy: number, R: number, catHex: string) {
  const count = 16;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const grd = ctx.createLinearGradient(
      cx, cy,
      cx + Math.cos(angle) * R * 2, cy + Math.sin(angle) * R * 2
    );
    grd.addColorStop(0,   rgba(catHex, 0.18));
    grd.addColorStop(0.3, rgba(catHex, 0.06));
    grd.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.strokeStyle = grd;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * R * 2, cy + Math.sin(angle) * R * 2);
    ctx.stroke();
  }
}

/* ── Rarity frame ────────────────────────────────────────────── */
function drawFrame(ctx: Ctx, W: number, H: number, rarity: Rarity) {
  const rc = RARITY_COLOR[rarity];
  const [r, g, b] = rgb(rc);

  if (rarity === 'LEGENDARY') {
    // Strong outer glow
    ctx.shadowColor = rc;
    ctx.shadowBlur = 30;
    ctx.strokeStyle = rc;
    ctx.lineWidth = 4;
    rr(ctx, 2, 2, W - 4, H - 4, 14); ctx.stroke();
    ctx.shadowBlur = 0;
    // Inner glow line
    ctx.strokeStyle = rgba('#ffffff', 0.3);
    ctx.lineWidth = 1;
    rr(ctx, 7, 7, W - 14, H - 14, 11); ctx.stroke();
    // Corner ornaments
    const cs = 20;
    const corners = [[14,14],[W-14,14],[W-14,H-14],[14,H-14]] as const;
    const dirs = [[-1,-1],[1,-1],[1,1],[-1,1]] as const;
    ctx.strokeStyle = rc; ctx.lineWidth = 2;
    ctx.shadowColor = rc; ctx.shadowBlur = 8;
    for (const [[cx2, cy2],[dx,dy]] of corners.map((c,i)=>[c,dirs[i]] as const)) {
      ctx.beginPath();
      ctx.moveTo(cx2, cy2 + dy * cs);
      ctx.lineTo(cx2, cy2);
      ctx.lineTo(cx2 + dx * cs, cy2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

  } else if (rarity === 'RARE') {
    // Glowing electric border
    for (let i = 3; i >= 1; i--) {
      ctx.shadowColor = rc;
      ctx.shadowBlur = i * 8;
      ctx.strokeStyle = rgba(rc, 0.3 + i * 0.2);
      ctx.lineWidth = i === 1 ? 2 : 1;
      rr(ctx, 2, 2, W - 4, H - 4, 14);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // Energy lines (subtle horizontal tick marks on the border)
    ctx.strokeStyle = rgba(rc, 0.5);
    ctx.lineWidth = 1;
    for (let y = 40; y < H - 40; y += 28) {
      ctx.beginPath(); ctx.moveTo(2, y); ctx.lineTo(8, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W - 2, y); ctx.lineTo(W - 8, y); ctx.stroke();
    }

  } else {
    // COMMON – clean silver
    ctx.strokeStyle = `rgba(${r},${g},${b},0.6)`;
    ctx.lineWidth = 2;
    ctx.shadowColor = `rgba(${r},${g},${b},0.3)`;
    ctx.shadowBlur = 6;
    rr(ctx, 2, 2, W - 4, H - 4, 14); ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

/* ── Central visual (big value text in artwork area) ────────── */
function drawCentralValue(ctx: Ctx, artX: number, artY: number, artW: number, artH: number,
                          lines: string[], vsize: number, catHex: string) {
  const total = lines.length;
  const lh = vsize * 1.2;
  const startY = artY + artH / 2 - (total * lh) / 2 + vsize * 0.4;

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

  lines.forEach((line, i) => {
    // Auto-scale long lines
    let fs = vsize;
    const maxW = artW * 0.82;
    ctx.font = `900 ${fs}px 'Arial Black', 'Impact', sans-serif`;
    while (ctx.measureText(line).width > maxW && fs > 28) {
      fs -= 2;
      ctx.font = `900 ${fs}px 'Arial Black', 'Impact', sans-serif`;
    }

    const ty = startY + i * lh;

    // Shadow layers for glow depth
    for (let s = 4; s >= 1; s--) {
      ctx.shadowColor = catHex;
      ctx.shadowBlur = s * 10;
      ctx.fillStyle = rgba(catHex, 0.15 + s * 0.05);
      ctx.fillText(line, artX + artW / 2, ty);
    }

    // Dark outline (readability)
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeText(line, artX + artW / 2, ty);

    // Main fill – white with cat colour tint on top line
    ctx.shadowColor = catHex;
    ctx.shadowBlur = 20;
    ctx.fillStyle = i === 0 ? '#ffffff' : rgba('#ffffff', 0.88);
    ctx.fillText(line, artX + artW / 2, ty);
    ctx.shadowBlur = 0;
  });
}

/* ── Logo watermark ──────────────────────────────────────────── */
function drawLogo(ctx: Ctx, logo: Image, x: number, y: number, size: number, alpha: number) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(logo, x - size / 2, y - size / 2, size, size);
  ctx.globalAlpha = 1;
}

/* ── Render a complete card ──────────────────────────────────── */
function renderCard(card: CardDef, logo: Image): Buffer {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const catHex  = CAT_COLOR[card.category];
  const rarHex  = RARITY_COLOR[card.rarity];

  // ── 1. Card base
  ctx.fillStyle = '#080810';
  rr(ctx, 0, 0, W, H, 15); ctx.fill();

  // Ambient category gradient
  const amb = ctx.createRadialGradient(W/2, 200, 10, W/2, 200, 340);
  amb.addColorStop(0, rgba(catHex, 0.25));
  amb.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = amb;
  rr(ctx, 0, 0, W, H, 15); ctx.fill();

  // ── 2. Layout constants
  const HDR_H  = 58;
  const ART_Y  = HDR_H + 4;
  const ART_H  = 224;
  const ART_W  = W - 24;
  const ART_X  = 12;
  const CAT_Y  = ART_Y + ART_H;
  const CAT_H  = 32;
  const TXT_Y  = CAT_Y + CAT_H + 2;
  const BRD_Y  = H - 32;
  const TXT_H  = BRD_Y - TXT_Y - 6;

  // ── 3. Artwork area background
  const artBg = ctx.createLinearGradient(ART_X, ART_Y, ART_X, ART_Y + ART_H);
  artBg.addColorStop(0, '#0c0c18');
  artBg.addColorStop(1, '#06060f');
  ctx.fillStyle = artBg;
  rr(ctx, ART_X, ART_Y, ART_W, ART_H, 6); ctx.fill();

  // Clip to artwork area for dartboard + beams
  ctx.save();
  rr(ctx, ART_X, ART_Y, ART_W, ART_H, 6); ctx.clip();

  // Dartboard (centre of artwork area)
  const boardCX = W / 2;
  const boardCY = ART_Y + ART_H * 0.54;
  const boardR  = ART_H * 0.47;

  drawDartboard(ctx, boardCX, boardCY, boardR, catHex, 0.9);
  drawLightBeams(ctx, boardCX, boardCY, boardR * 1.4, catHex);

  // Dramatic spot glow from board centre
  const spot = ctx.createRadialGradient(boardCX, boardCY, 0, boardCX, boardCY, boardR * 1.5);
  spot.addColorStop(0,   rgba(catHex, 0.22));
  spot.addColorStop(0.4, rgba(catHex, 0.08));
  spot.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(ART_X, ART_Y, ART_W, ART_H);

  // Top-to-bottom dark fade so central text is readable
  const fade = ctx.createLinearGradient(0, ART_Y, 0, ART_Y + ART_H);
  fade.addColorStop(0,   'rgba(6,6,15,0.05)');
  fade.addColorStop(0.3, 'rgba(6,6,15,0.42)');
  fade.addColorStop(1,   'rgba(6,6,15,0.6)');
  ctx.fillStyle = fade;
  ctx.fillRect(ART_X, ART_Y, ART_W, ART_H);

  ctx.restore();

  // Artwork border line
  ctx.strokeStyle = rgba(catHex, 0.4);
  ctx.lineWidth = 1;
  rr(ctx, ART_X, ART_Y, ART_W, ART_H, 6); ctx.stroke();

  // TKDL logo watermark (top-right of artwork)
  drawLogo(ctx, logo, ART_X + ART_W - 30, ART_Y + 26, 40, 0.12);

  // ── 4. Central visual value text
  drawCentralValue(ctx, ART_X, ART_Y, ART_W, ART_H, card.visual, card.vsize, catHex);

  // ── 5. Header (drawn OVER artwork top edge)
  // Header bg
  const hdrBg = ctx.createLinearGradient(0, 0, 0, HDR_H);
  hdrBg.addColorStop(0, '#0c0d1c');
  hdrBg.addColorStop(1, rgba('#0c0d1c', 0.0));
  ctx.fillStyle = hdrBg;
  rr(ctx, 0, 0, W, HDR_H + 10, 15); ctx.fill();

  // Number badge
  const NR = 20, NX = 30, NY = 30;
  ctx.fillStyle = rgba(catHex, 0.22);
  ctx.strokeStyle = catHex;
  ctx.lineWidth = 2;
  ctx.shadowColor = catHex; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(NX, NY, NR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(card.num), NX, NY);

  // Card name
  const nameX = NX + NR + 8;
  const nameMaxW = W - nameX - 90;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let nfs = 20;
  ctx.font = `800 ${nfs}px 'Arial Black', sans-serif`;
  const nameUp = card.name.toUpperCase();
  while (ctx.measureText(nameUp).width > nameMaxW && nfs > 12) {
    nfs--; ctx.font = `800 ${nfs}px 'Arial Black', sans-serif`;
  }
  ctx.shadowColor = catHex; ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(nameUp, nameX, NY);
  ctx.shadowBlur = 0;

  // Rarity badge (top-right)
  ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  const rarLabel = RARITY_BADGE[card.rarity];
  ctx.font = `bold 10px sans-serif`;
  ctx.fillStyle = rarHex;
  ctx.shadowColor = rarHex; ctx.shadowBlur = 8;
  ctx.fillText(rarLabel, W - 10, 8);
  ctx.shadowBlur = 0;

  // ── 6. Category bar
  const cbg = ctx.createLinearGradient(ART_X, CAT_Y, ART_X + ART_W, CAT_Y);
  cbg.addColorStop(0,   rgba(catHex, 0.6));
  cbg.addColorStop(0.5, rgba(catHex, 0.35));
  cbg.addColorStop(1,   rgba(catHex, 0.6));
  ctx.fillStyle = cbg;
  rr(ctx, ART_X, CAT_Y, ART_W, CAT_H, 0); ctx.fill();

  // Cat icon + label
  const icon = CAT_ICON[card.category];
  const label = CAT_LABEL[card.category];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const midCat = CAT_Y + CAT_H / 2;

  ctx.font = `bold 13px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
  ctx.fillText(`${icon}  ${label}`, W / 2, midCat);
  ctx.shadowBlur = 0;

  // ── 7. Effect + flavour text area
  ctx.fillStyle = 'rgba(6,6,15,0.85)';
  rr(ctx, ART_X, TXT_Y, ART_W, TXT_H, 4); ctx.fill();
  ctx.strokeStyle = rgba(catHex, 0.2);
  ctx.lineWidth = 1;
  rr(ctx, ART_X, TXT_Y, ART_W, TXT_H, 4); ctx.stroke();

  const txtPad = 10;
  let curY = TXT_Y + txtPad;

  // Effect text
  ctx.fillStyle = '#e8eeff';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const effH = wrapText(ctx, card.effect, W / 2, curY, ART_W - txtPad * 2, 17);
  curY += effH + 6;

  // Divider
  ctx.strokeStyle = rgba(catHex, 0.25); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ART_X + 24, curY); ctx.lineTo(W - ART_X - 24, curY); ctx.stroke();
  curY += 6;

  // Flavor text
  ctx.fillStyle = rgba(catHex, 0.8);
  ctx.font = `italic 11px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  wrapText(ctx, card.flavor, W / 2, curY, ART_W - txtPad * 2, 15);

  // ── 8. Branding footer
  ctx.strokeStyle = rgba(catHex, 0.25); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ART_X, BRD_Y - 4); ctx.lineTo(W - ART_X, BRD_Y - 4); ctx.stroke();

  ctx.textBaseline = 'middle';
  const midBrd = BRD_Y + 14;

  ctx.font = `bold 9px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = catHex;
  ctx.shadowColor = catHex; ctx.shadowBlur = 6;
  ctx.fillText('TKDL', ART_X + 4, midBrd);
  ctx.shadowBlur = 0;

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('CARD CLASH', W / 2, midBrd);

  ctx.textAlign = 'right';
  ctx.fillStyle = rgba(rarHex, 0.6);
  ctx.fillText('SET 1', W - ART_X - 4, midBrd);

  // ── 9. Rarity frame (drawn last, on top)
  drawFrame(ctx, W, H, card.rarity);

  return canvas.toBuffer('image/png');
}

/* ── Card back ───────────────────────────────────────────────── */
function renderCardBack(category: Category, logo: Image): Buffer {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const catHex = CAT_COLOR[category];
  const [r, g, b] = rgb(catHex);

  // Base
  ctx.fillStyle = '#07071a';
  rr(ctx, 0, 0, W, H, 15); ctx.fill();

  // Radial ambient
  const amb = ctx.createRadialGradient(W/2, H/2, 20, W/2, H/2, 320);
  amb.addColorStop(0,   rgba(catHex, 0.30));
  amb.addColorStop(0.6, rgba(catHex, 0.10));
  amb.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = amb;
  rr(ctx, 0, 0, W, H, 15); ctx.fill();

  // Subtle light beams
  drawLightBeams(ctx, W/2, H/2, 350, catHex);

  // Grid pattern (subtle diamond/hex overlay)
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = catHex;
  ctx.lineWidth = 1;
  const gSize = 32;
  for (let gx = 0; gx < W; gx += gSize) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
  }
  for (let gy = 0; gy < H; gy += gSize) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
  }
  ctx.restore();

  // Logo (large, centred)
  drawLogo(ctx, logo, W/2, H/2 - 30, 200, 0.88);

  // Glow disc behind logo
  const lg = ctx.createRadialGradient(W/2, H/2 - 30, 10, W/2, H/2 - 30, 130);
  lg.addColorStop(0,   rgba(catHex, 0.3));
  lg.addColorStop(0.5, rgba(catHex, 0.1));
  lg.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.arc(W/2, H/2 - 30, 130, 0, Math.PI * 2); ctx.fill();

  // "CARD CLASH" text
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 28px 'Arial Black', sans-serif`;
  ctx.shadowColor = catHex; ctx.shadowBlur = 16;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('CARD CLASH', W/2, H - 115);
  ctx.shadowBlur = 0;

  // Category name
  ctx.font = `bold 13px sans-serif`;
  ctx.fillStyle = catHex;
  ctx.shadowColor = catHex; ctx.shadowBlur = 10;
  ctx.fillText(CAT_LABEL[category], W/2, H - 85);
  ctx.shadowBlur = 0;

  // Horizontal rule
  ctx.strokeStyle = rgba(catHex, 0.4); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, H - 70); ctx.lineTo(W - 60, H - 70); ctx.stroke();

  // SET 1 LAUNCH EDITION
  ctx.fillStyle = rgba('#ffffff', 0.4);
  ctx.font = `9px sans-serif`;
  ctx.fillText('SET 1 · LAUNCH EDITION', W/2, H - 54);

  // Rarity-like frame for back (use cat colour, RARE style)
  const rc = RARITY_COLOR['RARE'];
  for (let i = 3; i >= 1; i--) {
    ctx.shadowColor = catHex;
    ctx.shadowBlur = i * 8;
    ctx.strokeStyle = rgba(catHex, 0.25 + i * 0.2);
    ctx.lineWidth = i === 1 ? 2 : 1;
    rr(ctx, 2, 2, W - 4, H - 4, 14);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  return canvas.toBuffer('image/png');
}

/* ══════════════════════════════════════════════════════════════
   ALL 100 CARDS
   ══════════════════════════════════════════════════════════════ */

const BLU  = 'x01-good'     as Category;
const RED  = 'x01-bad'      as Category;
const GRN  = 'cricket-good' as Category;
const PUR  = 'cricket-bad'  as Category;
const WGLD = 'wildcard-good'as Category;
const WCRM = 'wildcard-bad' as Category;

const CARDS: CardDef[] = [

/* ── X01 GOOD (20) ─────────────────────────────────────────── */
{ id:'x01-good-01', num:1,  name:'Big Game Player',         rarity:'RARE',      category:BLU,
  visual:['80+'], vsize:96,
  effect:'If you score 80+ (not on double) this turn, gain +35 bonus next leg.',
  flavor:'"Champions step up when it counts."' },
{ id:'x01-good-02', num:2,  name:'Power Surge +50',         rarity:'COMMON',    category:BLU,
  visual:['+50'], vsize:100,
  effect:'Add 50 points to your turn total.',
  flavor:'"Pure firepower."' },
{ id:'x01-good-03', num:3,  name:'Treble Hunter',           rarity:'RARE',      category:BLU,
  visual:['1.3×'], vsize:96,
  effect:"Next treble hit counts as 1.3× (T20 = 78 instead of 60).",
  flavor:'"Go for the wire."' },
{ id:'x01-good-04', num:4,  name:'Unstoppable Checkout',    rarity:'RARE',      category:BLU,
  visual:['🔒','BLOCK'], vsize:76,
  effect:"When on double, opponent can't play penalty cards this turn.",
  flavor:'"Nothing stops the finish."' },
{ id:'x01-good-05', num:5,  name:'Banking Strategy',        rarity:'COMMON',    category:BLU,
  visual:['50+','+20'], vsize:80,
  effect:'If you score 50+ (not on double), next turn gets +20 bonus.',
  flavor:'"Invest now, collect later."' },
{ id:'x01-good-06', num:6,  name:'Checkout Confidence',     rarity:'RARE',      category:BLU,
  visual:['↺','RETRY'], vsize:80,
  effect:"On double, you get 1 free re-throw if you miss the first attempt.",
  flavor:'"One more arrow."' },
{ id:'x01-good-07', num:7,  name:'Exact Finish',            rarity:'RARE',      category:BLU,
  visual:['FINISH','🔒'], vsize:72,
  effect:"In final 50 pts, if you hit your double, opponent can't play penalty cards next turn.",
  flavor:'"Precision wins matches."' },
{ id:'x01-good-08', num:8,  name:'High Pressure',           rarity:'COMMON',    category:BLU,
  visual:['+40'], vsize:104,
  effect:'If opponent is ahead in legs, gain +40 bonus this leg.',
  flavor:'"Comebacks are my speciality."' },
{ id:'x01-good-09', num:9,  name:'Perfect Rhythm',          rarity:'COMMON',    category:BLU,
  visual:['+10','EACH'], vsize:84,
  effect:'All your darts this turn score +10 each.',
  flavor:'"In the zone."' },
{ id:'x01-good-10', num:10, name:'High Roller',             rarity:'RARE',      category:BLU,
  visual:['100+','+25'], vsize:80,
  effect:'If you score over 100 this turn, gain +25 bonus.',
  flavor:'"Go big or go home."' },
{ id:'x01-good-11', num:11, name:'Precision Strike',        rarity:'RARE',      category:BLU,
  visual:['MIN','6'], vsize:84,
  effect:"Your next three darts minimum value is 6 (can't hit 1-5 segments).",
  flavor:'"No wasted arrows."' },
{ id:'x01-good-12', num:12, name:'Safety Boost',            rarity:'COMMON',    category:BLU,
  visual:['MIN','15'], vsize:84,
  effect:'Your lowest-value dart this turn scores minimum +15.',
  flavor:'"Floor it."' },
{ id:'x01-good-13', num:13, name:'Treble Boost',            rarity:'RARE',      category:BLU,
  visual:['1.4×'], vsize:100,
  effect:"Your trebles this turn count at 1.4× (T20 = 84 instead of 60).",
  flavor:'"Wire to wire."' },
{ id:'x01-good-14', num:14, name:'Safety Net',              rarity:'LEGENDARY', category:BLU,
  visual:['BUST?','÷2'], vsize:80,
  effect:'If you would bust, score half your current visit total instead of busting.',
  flavor:'"Lucky escape."' },
{ id:'x01-good-15', num:15, name:'Close Control',           rarity:'RARE',      category:BLU,
  visual:['BUST','→ 1'], vsize:80,
  effect:'In final 50 points, if any dart would bust, automatically reduce it to 1 point.',
  flavor:'"Thread the needle."' },
{ id:'x01-good-16', num:16, name:'Steady Hand',             rarity:'LEGENDARY', category:BLU,
  visual:['NO','MISS'], vsize:84,
  effect:"Your darts can't miss the board (segment 0 redirects to segment 5).",
  flavor:'"Every arrow counts."' },
{ id:'x01-good-17', num:17, name:'Scoring Arsenal',         rarity:'COMMON',    category:BLU,
  visual:['1 2 3','ALL'], vsize:76,
  effect:"Your turn can't end without all 3 darts being thrown (forces full turn).",
  flavor:'"Use every bullet."' },
{ id:'x01-good-18', num:18, name:'Finishing Bonus',         rarity:'RARE',      category:BLU,
  visual:['FINISH','+50'], vsize:76,
  effect:'If you finish this turn, gain +50 bonus points.',
  flavor:'"The ultimate reward."' },
{ id:'x01-good-19', num:19, name:'Century Maker',           rarity:'COMMON',    category:BLU,
  visual:['100+','+40'], vsize:80,
  effect:'If you score exactly 100–109 this turn, gain +40 bonus.',
  flavor:'"Three figures, big reward."' },
{ id:'x01-good-20', num:20, name:'Iron Will',               rarity:'RARE',      category:BLU,
  visual:['1.2×'], vsize:104,
  effect:'Your darts score at 1.2× value this turn.',
  flavor:'"Sheer determination."' },

/* ── X01 BAD (20) ──────────────────────────────────────────── */
{ id:'x01-bad-01', num:1,  name:'Rust Hands -40',          rarity:'COMMON',    category:RED,
  visual:['-40'], vsize:104,
  effect:"Target's next turn is reduced by 40 points.",
  flavor:'"Rusty fingers."' },
{ id:'x01-bad-02', num:2,  name:'Wild Throw',              rarity:'COMMON',    category:RED,
  visual:['MISS!'], vsize:92,
  effect:'One random dart this turn becomes a complete miss (0 points).',
  flavor:'"Nowhere near."' },
{ id:'x01-bad-03', num:3,  name:'Brick Wall',              rarity:'RARE',      category:RED,
  visual:['20 19','18 ✕'], vsize:72,
  effect:"Target can't score on 20, 19, or 18 (any ring). All hits score 0.",
  flavor:'"Wall it up."' },
{ id:'x01-bad-04', num:4,  name:'Low Blow',                rarity:'COMMON',    category:RED,
  visual:['S = 0'], vsize:88,
  effect:'Singles count as 0. Only doubles and trebles score.',
  flavor:'"Singles are worthless."' },
{ id:'x01-bad-05', num:5,  name:"Doubles Don't Count",     rarity:'RARE',      category:RED,
  visual:['D → S'], vsize:88,
  effect:'Doubles count as singles (D20 = 20, not 40).',
  flavor:'"Half the value."' },
{ id:'x01-bad-06', num:6,  name:'Shackled',                rarity:'COMMON',    category:RED,
  visual:['MAX','50'], vsize:84,
  effect:"Target's highest possible dart this turn is 50 (T16 max instead of T20).",
  flavor:'"Chained down."' },
{ id:'x01-bad-07', num:7,  name:'Turn Enforcer',           rarity:'RARE',      category:RED,
  visual:['🔒 3','DARTS'], vsize:76,
  effect:"Target must complete all 3 darts before attempting finish.",
  flavor:'"No shortcuts."' },
{ id:'x01-bad-08', num:8,  name:'Pressure Zone',           rarity:'COMMON',    category:RED,
  visual:['15 20','BULL'], vsize:72,
  effect:'Target can only score on 15, 20, or Bull. All other segments score 0.',
  flavor:'"Narrow it down."' },
{ id:'x01-bad-09', num:9,  name:'Off Target',              rarity:'RARE',      category:RED,
  visual:['20→1','19→3'], vsize:76,
  effect:"Target's darts shift to the adjacent dartboard segment (20→1, 19→3, etc).",
  flavor:'"Slightly off."' },
{ id:'x01-bad-10', num:10, name:'Mercy Killer',            rarity:'COMMON',    category:RED,
  visual:['CAP','60'], vsize:84,
  effect:"Target's next turn is capped at 60 total.",
  flavor:'"Mercy? None."' },
{ id:'x01-bad-11', num:11, name:'Jinx',                    rarity:'RARE',      category:RED,
  visual:['0.75×'], vsize:100,
  effect:'All darts score at 0.75× value this turn.',
  flavor:'"Bad luck follows you."' },
{ id:'x01-bad-12', num:12, name:'Fatigue',                 rarity:'RARE',      category:RED,
  visual:['×0.8'], vsize:96,
  effect:'Darts get progressively worse: Dart 1 = 1.0×, Dart 2 = 0.9×, Dart 3 = 0.8×.',
  flavor:'"Tiring out."' },
{ id:'x01-bad-13', num:13, name:'Leg Reset',               rarity:'COMMON',    category:RED,
  visual:['WIN','→ 0'], vsize:84,
  effect:"If target won 2+ legs in a row, they lose that streak.",
  flavor:'"All good things end."' },
{ id:'x01-bad-14', num:14, name:'Clutch Breaker',          rarity:'RARE',      category:RED,
  visual:['-15','EACH'], vsize:88,
  effect:"In final 100 points, target's darts score -15 each.",
  flavor:'"Crumbles under pressure."' },
{ id:'x01-bad-15', num:15, name:'Finish Delay',            rarity:'RARE',      category:RED,
  visual:['D1 D2','= SING'], vsize:72,
  effect:"Doubles don't count for first 2 darts next turn — they count as singles.",
  flavor:'"Not yet."' },
{ id:'x01-bad-16', num:16, name:'Treble Curse',            rarity:'LEGENDARY', category:RED,
  visual:['T → S'], vsize:96,
  effect:'Trebles count as singles this turn (T20 = 20, not 60).',
  flavor:'"The curse is real."' },
{ id:'x01-bad-17', num:17, name:'Dead Zone',               rarity:'RARE',      category:RED,
  visual:['15-20','VOID'], vsize:76,
  effect:"Target can't score on any number 15-20 (only 1-14 and Bull).",
  flavor:'"That whole section is dead."' },
{ id:'x01-bad-18', num:18, name:'Mental Block',            rarity:'COMMON',    category:RED,
  visual:['-10','/DART'], vsize:84,
  effect:'Each dart thrown costs 10 points (penalty per dart thrown, not per miss).',
  flavor:'"Inside their head."' },
{ id:'x01-bad-19', num:19, name:'Trapped',                 rarity:'RARE',      category:RED,
  visual:['DOUBLE','OR OUT'], vsize:72,
  effect:"Target must finish on double or their turn ends immediately after 1 dart.",
  flavor:'"Only one way out."' },
{ id:'x01-bad-20', num:20, name:'Lockdown',                rarity:'LEGENDARY', category:RED,
  visual:['ONE','ONLY'], vsize:84,
  effect:'Target can only score on one number segment for the entire turn (chosen by card player).',
  flavor:'"Locked in. Locked out."' },

/* ── CRICKET GOOD (20) ─────────────────────────────────────── */
{ id:'cricket-good-01', num:1,  name:'Instant Mark',        rarity:'COMMON',    category:GRN,
  visual:['+1','MARK'], vsize:84,
  effect:'Automatically mark the called number without throwing (counts as 1 hit).',
  flavor:'"Free progress."' },
{ id:'cricket-good-02', num:2,  name:'Double Strike',        rarity:'RARE',      category:GRN,
  visual:['MARKS','×2'], vsize:80,
  effect:'Your marks count as 2× toward opening and closing this turn.',
  flavor:'"Double the impact."' },
{ id:'cricket-good-03', num:3,  name:'Sniper Lock',          rarity:'RARE',      category:GRN,
  visual:['LOCK','×3'], vsize:84,
  effect:'Next 3 darts must hit the called number — misses automatically redirect.',
  flavor:'"Zeroing in."' },
{ id:'cricket-good-04', num:4,  name:'Number Resurrection',  rarity:'LEGENDARY', category:GRN,
  visual:['REOPEN'], vsize:80,
  effect:"One closed number becomes fresh and reopenable again — resets opponent's close.",
  flavor:'"Back from the dead."' },
{ id:'cricket-good-05', num:5,  name:'Scoring Surge',        rarity:'LEGENDARY', category:GRN,
  visual:['1.5×','SCORE'], vsize:80,
  effect:'All your open numbers score at 1.5× value this leg (T20 = 90 instead of 60).',
  flavor:'"Maximum firepower."' },
{ id:'cricket-good-06', num:6,  name:'Closing Protection',   rarity:'RARE',      category:GRN,
  visual:['🔒','OPEN'], vsize:76,
  effect:"Once you open a number this leg, opponent can't close it.",
  flavor:'"Locked open."' },
{ id:'cricket-good-07', num:7,  name:'Mark Flood',           rarity:'RARE',      category:GRN,
  visual:['ALL','MARK'], vsize:84,
  effect:'All your darts this turn automatically mark, even if you miss the number.',
  flavor:'"Drowning in marks."' },
{ id:'cricket-good-08', num:8,  name:'Scoring Momentum',     rarity:'COMMON',    category:GRN,
  visual:['+5','+10'], vsize:88,
  effect:'Each mark this turn is worth +5 more points than the last (stacking).',
  flavor:'"Building unstoppable."' },
{ id:'cricket-good-09', num:9,  name:'Early Closer',         rarity:'RARE',      category:GRN,
  visual:['<T5','+30'], vsize:88,
  effect:'If you close a number before turn 5, get +30 bonus points.',
  flavor:'"Speed pays."' },
{ id:'cricket-good-10', num:10, name:'Perfect Round',        rarity:'RARE',      category:GRN,
  visual:['3/3','+25'], vsize:88,
  effect:'If all 3 darts mark this turn, gain +25 bonus.',
  flavor:'"Flawless execution."' },
{ id:'cricket-good-11', num:11, name:'Bull Multiplier',      rarity:'RARE',      category:GRN,
  visual:['BULL','×3'], vsize:84,
  effect:'When you hit bull, it counts as marking ANY 3 numbers you choose.',
  flavor:'"Bull rules everything."' },
{ id:'cricket-good-12', num:12, name:'Bullseye Rush',        rarity:'COMMON',    category:GRN,
  visual:['BULL','×2'], vsize:84,
  effect:'Bull auto-marks 2 cricket numbers of your choice.',
  flavor:'"Two for one."' },
{ id:'cricket-good-13', num:13, name:'Comeback Marks',       rarity:'COMMON',    category:GRN,
  visual:['1.5×','MARKS'], vsize:76,
  effect:"If you're behind in points, all your marks count as 1.5× toward opening.",
  flavor:'"Fight back harder."' },
{ id:'cricket-good-14', num:14, name:'Mark Accelerator',     rarity:'RARE',      category:GRN,
  visual:['HIT','×2'], vsize:88,
  effect:"When you hit the called number, marks count as 2 (close twice as fast).",
  flavor:'"Doubling down."' },
{ id:'cricket-good-15', num:15, name:'Mark Multiplier',      rarity:'RARE',      category:GRN,
  visual:['3+','+50'], vsize:88,
  effect:'If you mark the called number 3+ times this turn, score 50 bonus points.',
  flavor:'"Hat-trick reward."' },
{ id:'cricket-good-16', num:16, name:'Quick Close',          rarity:'COMMON',    category:GRN,
  visual:['CLOSE','D2+'], vsize:76,
  effect:'If you close your number by dart 2, get a free mark on the next number.',
  flavor:'"Efficiency."' },
{ id:'cricket-good-17', num:17, name:'Momentum Arsenal',     rarity:'COMMON',    category:GRN,
  visual:['+10','STACK'], vsize:80,
  effect:'Each successful mark this turn builds +10 point bonus (stacks).',
  flavor:'"Momentum is everything."' },
{ id:'cricket-good-18', num:18, name:'High Scorer',          rarity:'RARE',      category:GRN,
  visual:['100+','+20'], vsize:80,
  effect:'If you score 100+ points this turn, gain +20 bonus.',
  flavor:'"Triple figures, triple reward."' },
{ id:'cricket-good-19', num:19, name:'Perfect Form',         rarity:'RARE',      category:GRN,
  visual:['ALL','1.5×'], vsize:84,
  effect:'All your marks count AND you score 1.5× points this turn.',
  flavor:'"Perfection personified."' },
{ id:'cricket-good-20', num:20, name:'Dominance',            rarity:'COMMON',    category:GRN,
  visual:['1.3×','LEAD'], vsize:80,
  effect:"If you lead in closed numbers, all your marks are worth 1.3× this turn.",
  flavor:'"Leaders stay leaders."' },

/* ── CRICKET BAD (20) ──────────────────────────────────────── */
{ id:'cricket-bad-01', num:1,  name:'Bad Aim',              rarity:'COMMON',    category:PUR,
  visual:['50%','MARKS'], vsize:76,
  effect:"Target's marks count at 50% value toward opening and closing this turn.",
  flavor:'"Not quite on target."' },
{ id:'cricket-bad-02', num:2,  name:'Distraction',          rarity:'RARE',      category:PUR,
  visual:['MISS!'], vsize:88,
  effect:"Target loses their next cricket number mark completely — the hit scores zero.",
  flavor:'"Focus? What focus?"' },
{ id:'cricket-bad-03', num:3,  name:'Out of Position',      rarity:'COMMON',    category:PUR,
  visual:['20 19','18 ✕'], vsize:72,
  effect:"Target can't hit high-value numbers (20, 19, 18) next turn — hits score 0.",
  flavor:'"Wrong angle."' },
{ id:'cricket-bad-04', num:4,  name:'Penalty Zone',         rarity:'RARE',      category:PUR,
  visual:['6-15','ONLY'], vsize:76,
  effect:"Target's next marks must be on lower numbers (6–15 only). Hits outside score 0.",
  flavor:'"Restricted territory."' },
{ id:'cricket-bad-05', num:5,  name:'Re-Opening Block',     rarity:'RARE',      category:PUR,
  visual:['🔒','LOCKED'], vsize:72,
  effect:"When you close one of target's numbers, that number is permanently locked — they can never reopen it.",
  flavor:'"That door is sealed."' },
{ id:'cricket-bad-06', num:6,  name:'Aim Shift',            rarity:'RARE',      category:PUR,
  visual:['20→1','19→3'], vsize:72,
  effect:"Target's shots hit adjacent segments (20→1, 19→3, 18→4, 17→2, 16→8, 15→10).",
  flavor:'"Slight miscalculation."' },
{ id:'cricket-bad-07', num:7,  name:'Hesitation',           rarity:'COMMON',    category:PUR,
  visual:['D1','= VOID'], vsize:76,
  effect:"Target's first dart this turn doesn't mark — only darts 2 and 3 count.",
  flavor:'"A moment of doubt."' },
{ id:'cricket-bad-08', num:8,  name:'Pressure',             rarity:'RARE',      category:PUR,
  visual:['CLOSE','-30'], vsize:76,
  effect:"Target must close their current cricket number this turn or lose 30 points.",
  flavor:'"Deliver or pay."' },
{ id:'cricket-bad-09', num:9,  name:'Momentum Killer',      rarity:'RARE',      category:PUR,
  visual:['-MARKS'], vsize:84,
  effect:"If target had 2 or more marks last turn, they lose those marks at start of this turn.",
  flavor:'"All that work, undone."' },
{ id:'cricket-bad-10', num:10, name:'Sluggish Marks',       rarity:'COMMON',    category:PUR,
  visual:['S=D=T','= 1'], vsize:72,
  effect:"Target's marks this turn all count as 1 only (singles, doubles, trebles = 1 mark).",
  flavor:'"Everything counts as one."' },
{ id:'cricket-bad-11', num:11, name:'Number Hex',           rarity:'RARE',      category:PUR,
  visual:['ONE','NUMBER'], vsize:76,
  effect:"Target is locked to one number all turn — hitting any other segment scores zero marks.",
  flavor:'"One track only."' },
{ id:'cricket-bad-12', num:12, name:'Closing Blocker',      rarity:'RARE',      category:PUR,
  visual:['NO','CLOSE'], vsize:80,
  effect:"Target cannot close any cricket numbers this turn. Marks accumulate but can't reach 3.",
  flavor:'"The door won\'t close."' },
{ id:'cricket-bad-13', num:13, name:'Mark Erasure',         rarity:'COMMON',    category:PUR,
  visual:['-10','/MARK'], vsize:84,
  effect:"Each mark target scores this turn costs them 10 points. Marks still count for cricket progress.",
  flavor:'"Progress has a price."' },
{ id:'cricket-bad-14', num:14, name:'Cricket Prison',       rarity:'COMMON',    category:PUR,
  visual:['15 19','20 ONLY'], vsize:68,
  effect:"Target can only score marks on 15, 19, and 20 this turn.",
  flavor:'"Narrow options."' },
{ id:'cricket-bad-15', num:15, name:'Bull Void',            rarity:'RARE',      category:PUR,
  visual:['BULL','= 0'], vsize:80,
  effect:"Bull doesn't count as marking anything this turn.",
  flavor:'"The bullseye is dead."' },
{ id:'cricket-bad-16', num:16, name:'Mark Killer',          rarity:'COMMON',    category:PUR,
  visual:['DART 3','= 0'], vsize:72,
  effect:"Target's final dart this turn (dart 3) doesn't count as a mark.",
  flavor:'"The last dart fails."' },
{ id:'cricket-bad-17', num:17, name:'Mark Drain',           rarity:'RARE',      category:PUR,
  visual:['-1','MARK'], vsize:84,
  effect:"If target is ahead in points, they lose 1 mark from a random opened number each turn.",
  flavor:'"The lead costs you."' },
{ id:'cricket-bad-18', num:18, name:'Streak Breaker',       rarity:'RARE',      category:PUR,
  visual:['MARKS','÷ 2'], vsize:76,
  effect:"If target scored 3 or more marks last turn, they lose half those marks this turn.",
  flavor:'"Hot streak? Not anymore."' },
{ id:'cricket-bad-19', num:19, name:'Number Prison',        rarity:'LEGENDARY', category:PUR,
  visual:['🔒','FOREVER'], vsize:72,
  effect:"One random closed number is locked permanently — target can never reopen it.",
  flavor:'"Some doors close forever."' },
{ id:'cricket-bad-20', num:20, name:'Score Halve',          rarity:'LEGENDARY', category:PUR,
  visual:['0.5×'], vsize:104,
  effect:"Target's open numbers score at 0.5× value for the entire leg.",
  flavor:'"Half the threat."' },

/* ── WILDCARD GOOD (10) ─────────────────────────────────────── */
{ id:'wildcard-good-01', num:1,  name:'Coin Flip',           rarity:'RARE',      category:WGLD,
  visual:['+40','OR -30'], vsize:76,
  effect:"50/50 chance: either you gain +40 bonus this turn OR your opponent loses 30 points.",
  flavor:'"Heads I win, tails you lose."' },
{ id:'wildcard-good-02', num:2,  name:'Lucky Streak',        rarity:'COMMON',    category:WGLD,
  visual:['+50'], vsize:104,
  effect:'If you won the previous leg, gain +50 bonus points this leg.',
  flavor:'"Riding the wave."' },
{ id:'wildcard-good-03', num:3,  name:'Momentum Surge',      rarity:'COMMON',    category:WGLD,
  visual:['+25','SURGE'], vsize:80,
  effect:'If you are currently ahead in the match, gain +25 bonus points this leg.',
  flavor:'"Leaders lead harder."' },
{ id:'wildcard-good-04', num:4,  name:'Finishing Edge',      rarity:'RARE',      category:WGLD,
  visual:['+1','RETRY'], vsize:80,
  effect:"In the final deciding leg, if you miss your double (X01) or close attempt (Cricket), get 1 free retry.",
  flavor:'"One more chance."' },
{ id:'wildcard-good-05', num:5,  name:'Comeback Leg',        rarity:'RARE',      category:WGLD,
  visual:['+60','BACK!'], vsize:80,
  effect:'If you lost the previous leg, gain +60 bonus points this leg.',
  flavor:'"Down but never out."' },
{ id:'wildcard-good-06', num:6,  name:'Hot Hand',            rarity:'RARE',      category:WGLD,
  visual:['🔥🔥','+45'], vsize:76,
  effect:"If you've won 2 or more legs in a row, gain +45 bonus points this leg.",
  flavor:'"They\'re on fire!"' },
{ id:'wildcard-good-07', num:7,  name:'Underdog',            rarity:'COMMON',    category:WGLD,
  visual:['+50','BONUS'], vsize:80,
  effect:"If you're behind in legs won, gain +50 bonus points this leg.",
  flavor:'"Nobody believed in me."' },
{ id:'wildcard-good-08', num:8,  name:'Perfect Game',        rarity:'COMMON',    category:WGLD,
  visual:['SHUTOUT','+30'], vsize:68,
  effect:'If this is a shutout leg (opponent scored 0 or closed no numbers), gain +30 bonus.',
  flavor:'"Flawless."' },
{ id:'wildcard-good-09', num:9,  name:'Match Point',         rarity:'LEGENDARY', category:WGLD,
  visual:['+70','MATCH!'], vsize:80,
  effect:"If you're one leg away from winning the match, gain +70 bonus points this leg.",
  flavor:'"One leg from glory."' },
{ id:'wildcard-good-10', num:10, name:'Invincible',          rarity:'LEGENDARY', category:WGLD,
  visual:['IMMUNE'], vsize:88,
  effect:"Your next turn is completely unaffected by any opponent penalty cards.",
  flavor:'"You can\'t touch me."' },

/* ── WILDCARD BAD (10) ──────────────────────────────────────── */
{ id:'wildcard-bad-01', num:1,  name:'Dark Cloud',          rarity:'COMMON',    category:WCRM,
  visual:['-35','LEG'], vsize:84,
  effect:"Target's next leg score is reduced by 35 points (X01) or one number is locked shut (Cricket).",
  flavor:'"Storm incoming."' },
{ id:'wildcard-bad-02', num:2,  name:'Momentum Killer',     rarity:'RARE',      category:WCRM,
  visual:['STREAK','= 0'], vsize:76,
  effect:"Remove any momentum or streak bonus target had. Reset their consecutive wins to zero.",
  flavor:'"Streak over."' },
{ id:'wildcard-bad-03', num:3,  name:'Unlucky Night',       rarity:'COMMON',    category:WCRM,
  visual:['0.75×','ALL'], vsize:80,
  effect:"All target's darts count at 75% value this leg (X01) or all marks at 75% (Cricket).",
  flavor:'"Not your night."' },
{ id:'wildcard-bad-04', num:4,  name:'Hex',                 rarity:'RARE',      category:WCRM,
  visual:['0.5×','ALL'], vsize:88,
  effect:"All target's darts count at 50% value (X01) or all cricket marks at 50% this leg.",
  flavor:'"Cursed."' },
{ id:'wildcard-bad-05', num:5,  name:'Wipeout',             rarity:'RARE',      category:WCRM,
  visual:['D2+D3','= 0'], vsize:72,
  effect:"Target's last 2 darts this leg score zero points each.",
  flavor:'"Finish weak."' },
{ id:'wildcard-bad-06', num:6,  name:'Total Annihilation',  rarity:'LEGENDARY', category:WCRM,
  visual:['-100','BOOM!'], vsize:76,
  effect:"Target's next leg score reduced by 100 (X01) OR they lose 1 fully opened number (Cricket).",
  flavor:'"Nothing survives this."' },
{ id:'wildcard-bad-07', num:7,  name:'Match Pressure',      rarity:'RARE',      category:WCRM,
  visual:['-20','EACH'], vsize:84,
  effect:"In the final leg of the match, target's darts score -20 each (X01) or all marks halved (Cricket).",
  flavor:'"The moment is too big."' },
{ id:'wildcard-bad-08', num:8,  name:'Underdog Curse',      rarity:'COMMON',    category:WCRM,
  visual:['0.8×','AHEAD'], vsize:76,
  effect:"If target is currently ahead in legs won, all their darts this turn score at 0.8× value.",
  flavor:'"Leaders get complacent."' },
{ id:'wildcard-bad-09', num:9,  name:'Win Bonus Removed',   rarity:'COMMON',    category:WCRM,
  visual:['-WIN','BONUS'], vsize:76,
  effect:"If target won the last leg, remove any momentum bonus they had from that win.",
  flavor:'"That win means nothing now."' },
{ id:'wildcard-bad-10', num:10, name:'Shutdown',            rarity:'RARE',      category:WCRM,
  visual:['MAX','50'], vsize:84,
  effect:"Target's leg is capped at 50 points maximum (X01) or a maximum of 2 cricket numbers opened (Cricket).",
  flavor:'"Contained."' },
];

/* ── Main ──────────────────────────────────────────────────── */
async function main() {
  const logoPath = join(__dirname, 'tkdl-logo.png');
  const logo = await loadImage(logoPath);

  let done = 0;
  const total = CARDS.length + 6;

  // Card fronts
  for (const card of CARDS) {
    const buf = renderCard(card, logo);
    writeFileSync(join(OUT, `${card.id}.png`), buf);
    done++;
    process.stdout.write(`\r[${Math.round(done/total*100)}%] ${done}/${total} ${card.id}`);
  }

  // Card backs (one per category)
  const cats: Category[] = ['x01-good','x01-bad','cricket-good','cricket-bad','wildcard-good','wildcard-bad'];
  for (const cat of cats) {
    const buf = renderCardBack(cat, logo);
    writeFileSync(join(OUT, `back-${cat}.png`), buf);
    done++;
    process.stdout.write(`\r[${Math.round(done/total*100)}%] ${done}/${total} back-${cat}`);
  }

  console.log(`\n✓ ${done} PNGs → ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
