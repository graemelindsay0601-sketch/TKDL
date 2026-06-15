/**
 * On-device YOLOv8 dart scoring using ONNX Runtime Web.
 * Runs entirely in the browser — no server, no memory limits.
 */
import * as ort from 'onnxruntime-web';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/';
ort.env.wasm.numThreads = 1;

const MODEL_PATH = '/weights.onnx';
const INFER_SIZE = 640;
const CONF_THRESH = 0.25;
const CAL_CONF_THRESH = 0.85;
const IOU_THRESH = 0.45;
const DART_CLASS = 4;

// Board geometry (from scorer.py)
const BOARD_DIAM = 451.0;
const RING = 10.0;
const BW2 = 0.8;
const RAW_RADII = [0, 6.35, 15.9, 107.4 - RING, 107.4, 170.0 - RING, 170.0];
const SCORING_RADII = RAW_RADII.map((r, i) => ((i === 1 || i === 2) ? r + BW2 : r) / BOARD_DIAM);
const SCORING_NAMES = ['DB', 'SB', 'S', 'T', 'S', 'D', 'miss'];
const SEG_ANGLES = [-9, 9, 27, 45, 63, -81, -63, -45, -27];
const SEG_NUMS: [number, number][] = [[6,11],[10,14],[15,9],[2,12],[17,5],[19,1],[7,18],[16,4],[8,13]];

function getBoardplaneCoords(): [number, number][] {
  const h = SCORING_RADII[6];
  let a: number, o: number;
  a = h * Math.cos(81 * Math.PI / 180); o = Math.sqrt(Math.max(0, h*h - a*a));
  const c0: [number,number] = [0.5 - a, 0.5 - o];
  const c1: [number,number] = [0.5 + a, 0.5 + o];
  a = h * Math.cos(-9 * Math.PI / 180); o = Math.sqrt(Math.max(0, h*h - a*a));
  const c2: [number,number] = [0.5 - a, 0.5 + o];
  const c3: [number,number] = [0.5 + a, 0.5 - o];
  a = h * Math.cos(27 * Math.PI / 180); o = Math.sqrt(Math.max(0, h*h - a*a));
  const c4: [number,number] = [0.5 - a, 0.5 - o];
  const c5: [number,number] = [0.5 + a, 0.5 + o];
  return [c0, c1, c2, c3, c4, c5];
}
const BP_CAL = getBoardplaneCoords();

// ── Session singleton ─────────────────────────────────────────────────────────

let _session: ort.InferenceSession | null = null;
let _loading = false;
let _loadPromise: Promise<void> | null = null;
let _loadError: string | null = null;

export function modelStatus(): 'idle' | 'loading' | 'ready' | 'error' {
  if (_loadError) return 'error';
  if (_session) return 'ready';
  if (_loading) return 'loading';
  return 'idle';
}

export async function loadModel(): Promise<void> {
  if (_session) return;
  if (_loadPromise) return _loadPromise;
  _loading = true;
  _loadError = null;
  _loadPromise = (async () => {
    try {
      _session = await ort.InferenceSession.create(MODEL_PATH, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
    } catch (e) {
      _loadError = String(e);
      throw e;
    } finally {
      _loading = false;
    }
  })();
  return _loadPromise;
}

// ── Preprocessing ─────────────────────────────────────────────────────────────

function preprocessCanvas(canvas: HTMLCanvasElement): Float32Array {
  const off = document.createElement('canvas');
  off.width = off.height = INFER_SIZE;
  const ctx = off.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0, INFER_SIZE, INFER_SIZE);
  const { data } = ctx.getImageData(0, 0, INFER_SIZE, INFER_SIZE);
  const N = INFER_SIZE * INFER_SIZE;
  const t = new Float32Array(3 * N);
  for (let i = 0; i < N; i++) {
    t[i]         = data[4*i]   / 255;
    t[i + N]     = data[4*i+1] / 255;
    t[i + 2*N]   = data[4*i+2] / 255;
  }
  return t;
}

// ── Detection decoding + NMS ──────────────────────────────────────────────────

type Det = { x: number; y: number; w: number; h: number; conf: number; cls: number };

function decodeOutput(data: Float32Array, dims: number[]): Det[] {
  const na = dims[2], nc = dims[1] - 4;
  const dets: Det[] = [];
  for (let j = 0; j < na; j++) {
    let maxConf = 0, maxCls = 0;
    for (let c = 0; c < nc; c++) {
      const v = data[(4+c)*na + j];
      if (v > maxConf) { maxConf = v; maxCls = c; }
    }
    if (maxConf < CONF_THRESH) continue;
    dets.push({
      x: data[0*na+j] / INFER_SIZE,
      y: data[1*na+j] / INFER_SIZE,
      w: data[2*na+j] / INFER_SIZE,
      h: data[3*na+j] / INFER_SIZE,
      conf: maxConf, cls: maxCls,
    });
  }
  return dets;
}

function iou(a: Det, b: Det): number {
  const [ax1,ay1,ax2,ay2] = [a.x-a.w/2, a.y-a.h/2, a.x+a.w/2, a.y+a.h/2];
  const [bx1,by1,bx2,by2] = [b.x-b.w/2, b.y-b.h/2, b.x+b.w/2, b.y+b.h/2];
  const inter = Math.max(0, Math.min(ax2,bx2)-Math.max(ax1,bx1)) *
                Math.max(0, Math.min(ay2,by2)-Math.max(ay1,by1));
  return inter / (a.w*a.h + b.w*b.h - inter + 1e-6);
}

function nms(dets: Det[]): Det[] {
  const sorted = [...dets].sort((a,b) => b.conf - a.conf);
  const keep: Det[] = [];
  const sup = new Set<number>();
  for (let i = 0; i < sorted.length; i++) {
    if (sup.has(i)) continue;
    keep.push(sorted[i]);
    for (let j = i+1; j < sorted.length; j++) {
      if (!sup.has(j) && sorted[i].cls === sorted[j].cls && iou(sorted[i], sorted[j]) > IOU_THRESH)
        sup.add(j);
    }
  }
  return keep;
}

// ── Homography (DLT) ──────────────────────────────────────────────────────────

type Mat3 = [number,number,number,number,number,number,number,number,number];

function mul3(A: Mat3, B: Mat3): Mat3 {
  return [
    A[0]*B[0]+A[1]*B[3]+A[2]*B[6], A[0]*B[1]+A[1]*B[4]+A[2]*B[7], A[0]*B[2]+A[1]*B[5]+A[2]*B[8],
    A[3]*B[0]+A[4]*B[3]+A[5]*B[6], A[3]*B[1]+A[4]*B[4]+A[5]*B[7], A[3]*B[2]+A[4]*B[5]+A[5]*B[8],
    A[6]*B[0]+A[7]*B[3]+A[8]*B[6], A[6]*B[1]+A[7]*B[4]+A[8]*B[7], A[6]*B[2]+A[7]*B[5]+A[8]*B[8],
  ];
}

function inv3(m: Mat3): Mat3 | null {
  const [a,b,c,d,e,f,g,h,k] = m;
  const det = a*(e*k-f*h) - b*(d*k-f*g) + c*(d*h-e*g);
  if (Math.abs(det) < 1e-12) return null;
  const s = 1/det;
  return [
    (e*k-f*h)*s,(c*h-b*k)*s,(b*f-c*e)*s,
    (f*g-d*k)*s,(a*k-c*g)*s,(c*d-a*f)*s,
    (d*h-e*g)*s,(b*g-a*h)*s,(a*e-b*d)*s,
  ];
}

function normalizePts(pts: [number,number][]): { T: Mat3; norm: [number,number][] } {
  const cx = pts.reduce((s,p)=>s+p[0],0)/pts.length;
  const cy = pts.reduce((s,p)=>s+p[1],0)/pts.length;
  const avgD = pts.reduce((s,p)=>s+Math.sqrt((p[0]-cx)**2+(p[1]-cy)**2),0)/pts.length;
  const sc = avgD < 1e-10 ? 1 : Math.SQRT2/avgD;
  return {
    T: [sc,0,-sc*cx, 0,sc,-sc*cy, 0,0,1],
    norm: pts.map(([x,y]) => [(x-cx)*sc, (y-cy)*sc]),
  };
}

function gaussSolve(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M = A.map((row,i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let mx = col;
    for (let r = col+1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[mx][col])) mx = r;
    [M[col], M[mx]] = [M[mx], M[col]];
    if (Math.abs(M[col][col]) < 1e-12) return null;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return Array.from({length:n}, (_,i) => M[i][n] / M[i][i]);
}

function findH(srcPts: [number,number][], dstPts: [number,number][]): Mat3 | null {
  if (srcPts.length < 4) return null;
  const { T: Ts, norm: sn } = normalizePts(srcPts);
  const { T: Td, norm: dn } = normalizePts(dstPts);
  const TdInv = inv3(Td);
  if (!TdInv) return null;

  const rows = srcPts.length;
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < rows; i++) {
    const [x,y] = sn[i], [xp,yp] = dn[i];
    A.push([-x,-y,-1, 0,0,0, xp*x, xp*y]); b.push(-xp);
    A.push([0,0,0, -x,-y,-1, yp*x, yp*y]); b.push(-yp);
  }

  let h8: number[] | null;
  if (rows === 4) {
    h8 = gaussSolve(A, b);
  } else {
    const AtA = Array.from({length:8},()=>new Array(8).fill(0));
    const Atb = new Array(8).fill(0);
    for (let i = 0; i < A.length; i++)
      for (let j = 0; j < 8; j++) {
        Atb[j] += A[i][j]*b[i];
        for (let k = 0; k < 8; k++) AtA[j][k] += A[i][j]*A[i][k];
      }
    h8 = gaussSolve(AtA, Atb);
  }
  if (!h8) return null;

  const Hn: Mat3 = [h8[0],h8[1],h8[2], h8[3],h8[4],h8[5], h8[6],h8[7],1];
  return mul3(TdInv, mul3(Hn, Ts));
}

function applyH(H: Mat3, x: number, y: number): [number,number] {
  const wx = H[0]*x+H[1]*y+H[2];
  const wy = H[3]*x+H[4]*y+H[5];
  const ww = H[6]*x+H[7]*y+H[8];
  return [wx/ww, wy/ww];
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function scorePos(bx: number, by: number): { label: string; value: number } {
  const dx = bx - 0.5, dy = by - 0.5;
  const bxSafe = bx === 0.5 ? bx + 1e-5 : bx;
  const angDeg = Math.atan(dy / (bxSafe - 0.5)) * 180 / Math.PI;
  const ang = angDeg > 0 ? Math.floor(angDeg) : Math.ceil(angDeg);

  let possible: [number,number];
  if (Math.abs(ang) >= 81) {
    possible = [3, 20];
  } else {
    const valid = SEG_ANGLES.filter(a => a <= ang);
    const maxA = valid.length ? Math.max(...valid) : -81;
    const idx = SEG_ANGLES.indexOf(maxA);
    possible = idx >= 0 ? SEG_NUMS[idx] : [3, 20];
  }

  const coordIdx = (possible[0] === 6 && possible[1] === 11) ? 0 : 1;
  const coordVal = coordIdx === 0 ? bx : by;
  const number = coordVal > 0.5 ? possible[0] : possible[1];

  const dist = Math.sqrt(dx*dx + dy*dy);
  const nLess = SCORING_RADII.filter(r => dist > r).length;
  const region = SCORING_NAMES[Math.max(0, nLess - 1)];

  switch (region) {
    case 'DB':   return { label: 'DB',        value: 50 };
    case 'SB':   return { label: 'SB',        value: 25 };
    case 'T':    return { label: `T${number}`, value: number * 3 };
    case 'D':    return { label: `D${number}`, value: number * 2 };
    case 'S':    return { label: `S${number}`, value: number };
    default:     return { label: 'miss',       value: 0 };
  }
}

// ── Annotation drawing ────────────────────────────────────────────────────────

function drawAnnotations(
  src: HTMLCanvasElement,
  dartCoords: [number,number][],
  calDets: Det[],
  labels: string[],
): string {
  const out = document.createElement('canvas');
  out.width = src.width; out.height = src.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  const w = src.width, h = src.height;
  const r = Math.max(10, Math.min(w, h) / 45);
  const COLS = ['#00ffff','#ffff00','#ff00ff'];

  for (const d of calDets) {
    ctx.strokeStyle = 'rgba(0,255,80,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect((d.x-d.w/2)*w, (d.y-d.h/2)*h, d.w*w, d.h*h);
  }
  for (let i = 0; i < dartCoords.length; i++) {
    const [dx,dy] = dartCoords[i];
    const col = COLS[i % COLS.length];
    ctx.beginPath(); ctx.arc(dx*w, dy*h, r, 0, 2*Math.PI);
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
    if (labels[i]) {
      ctx.font = `bold ${Math.max(14, Math.round(r*1.4))}px sans-serif`;
      ctx.fillStyle = col;
      ctx.fillText(labels[i], dx*w + r + 4, dy*h + r*0.4);
    }
  }
  return out.toDataURL('image/jpeg', 0.82);
}

// ── Public API ────────────────────────────────────────────────────────────────

export type DartResult = { label: string; value: number };

export type AnalysisResult = {
  darts: DartResult[];
  total: number;
  calibrationPoints: number;
  annotatedImage?: string;
  error?: string;
};

export async function analyzeCanvas(canvas: HTMLCanvasElement): Promise<AnalysisResult> {
  if (!_session) await loadModel();
  const sess = _session!;

  const inputData = preprocessCanvas(canvas);
  const inputTensor = new ort.Tensor('float32', inputData, [1, 3, INFER_SIZE, INFER_SIZE]);
  const outputs = await sess.run({ images: inputTensor });
  const out = outputs['output0'];
  if (!out) return { darts: [], total: 0, calibrationPoints: 0, error: 'Model output not found' };

  const dets = nms(decodeOutput(out.data as Float32Array, out.dims as number[]));

  const calCoords: ([number,number] | null)[] = Array(6).fill(null);
  const dartCoords: [number,number][] = [];

  for (const d of dets) {
    if (d.cls === DART_CLASS) {
      if (dartCoords.length < 3) dartCoords.push([d.x, d.y]);
    } else {
      const ci = d.cls < DART_CLASS ? d.cls : d.cls - 1;
      if (ci < 6 && calCoords[ci] === null && d.conf >= CAL_CONF_THRESH)
        calCoords[ci] = [d.x, d.y];
    }
  }

  const srcPts: [number,number][] = [];
  const dstPts: [number,number][] = [];
  for (let i = 0; i < 6; i++) {
    if (calCoords[i] !== null) { srcPts.push(calCoords[i]!); dstPts.push(BP_CAL[i]); }
  }

  const calDets = dets.filter(d => d.cls !== DART_CLASS);

  if (srcPts.length < 4) {
    return {
      darts: [], total: 0, calibrationPoints: srcPts.length,
      annotatedImage: drawAnnotations(canvas, [], calDets, []),
      error: `Only ${srcPts.length}/4 calibration points found — make sure the full board is visible.`,
    };
  }

  const H = findH(srcPts, dstPts);
  if (!H) return { darts: [], total: 0, calibrationPoints: srcPts.length, error: 'Homography failed.' };

  const darts: DartResult[] = [];
  const validDartCoords: [number,number][] = [];
  for (const [dx,dy] of dartCoords) {
    const [bx,by] = applyH(H, dx, dy);
    if (bx >= 0 && bx <= 1 && by >= 0 && by <= 1) {
      validDartCoords.push([dx, dy]);
      darts.push(scorePos(bx, by));
    }
  }

  return {
    darts,
    total: darts.reduce((s,d) => s+d.value, 0),
    calibrationPoints: srcPts.length,
    annotatedImage: drawAnnotations(canvas, validDartCoords, calDets, darts.map(d=>d.label)),
  };
}
