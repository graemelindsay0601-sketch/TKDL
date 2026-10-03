/**
 * Dedicated renderer for the Match Poster Library (see pages/poster-library.tsx).
 *
 * This is deliberately NOT built on top of renderShareCard() in ./share-card —
 * that generic symmetric "VS" card is shared by four other features
 * (final-whistle, play, season-detail, achievement-detail) and changing its
 * look would change theirs too. The Poster Library's result graphic gets its
 * own composition instead: an asymmetric winner/defeated hierarchy with a
 * medallion for the stake, broadcast-style corner brackets, and a
 * three-tile stat strip, rather than the mirrored two-name layout everyone
 * else uses.
 */

export type MatchPosterSpec = {
  format: string;
  kicker: string;
  winnerName: string;
  loserName: string;
  stake: number;
  gameType: string;
  seasonName?: string | null;
  playedAt?: string | Date | null;
  accent?: string;
};

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, initialSize: number, minSize: number, weight = 950) {
  let size = initialSize;
  do {
    ctx.font = `${weight} ${size}px Oswald, Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  } while (size > minSize);
  return minSize;
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const value = clean.length === 3 ? clean.split("").map(char => char + char).join("") : clean;
  const number = Number.parseInt(value, 16);
  if (!Number.isFinite(number)) return `rgba(255,0,92,${alpha})`;
  return `rgba(${(number >> 16) & 255},${(number >> 8) & 255},${number & 255},${alpha})`;
}

/** Four L-shaped brackets at the frame corners — the "broadcast lower
 * third" cue that marks this as an official graphic rather than a plain
 * screenshot. */
function drawCornerBrackets(ctx: CanvasRenderingContext2D, accent: string) {
  const inset = 26, arm = 46, line = 5;
  ctx.strokeStyle = accent;
  ctx.lineWidth = line;
  ctx.lineCap = "square";
  const corners: [number, number, number, number][] = [
    [inset, inset, 1, 1], [1200 - inset, inset, -1, 1],
    [inset, 630 - inset, 1, -1], [1200 - inset, 630 - inset, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + arm * dy);
    ctx.lineTo(x, y);
    ctx.lineTo(x + arm * dx, y);
    ctx.stroke();
  }
}

/** Faint dartboard rings + spokes, used as background texture only — kept
 * to very low alpha so it never competes with the winner/loser type. */
function drawRingWatermark(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, accent: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = .1;
  for (let ring = 6; ring >= 1; ring -= 1) {
    ctx.beginPath();
    ctx.arc(0, 0, (radius * ring) / 6, 0, Math.PI * 2);
    ctx.strokeStyle = ring % 2 === 0 ? accent : "#ffffff";
    ctx.lineWidth = ring === 6 ? 3 : 1.5;
    ctx.stroke();
  }
  for (let segment = 0; segment < 20; segment += 1) {
    const angle = (Math.PI * 2 * segment) / 20;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = .75;
    ctx.stroke();
  }
  ctx.restore();
}

export async function renderMatchPoster(spec: MatchPosterSpec): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  const accent = spec.accent ?? "#ff005c";
  const gold = "#ffd24a";

  // Background: a cooler, more neutral charcoal than share-card's purple —
  // this is the frame colour the medallion and corner brackets sit on, so
  // it's kept dark and quiet on purpose.
  const bg = ctx.createLinearGradient(0, 0, 1200, 630);
  bg.addColorStop(0, "#05070c");
  bg.addColorStop(.55, "#0a0d14");
  bg.addColorStop(1, "#03040a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1200, 630);

  const glow = ctx.createRadialGradient(360, 300, 0, 360, 300, 560);
  glow.addColorStop(0, hexToRgba(accent, .16));
  glow.addColorStop(1, hexToRgba(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1200, 630);

  drawRingWatermark(ctx, 1010, 460, 230, accent);

  // Faint grid, same device as the old card but a touch subtler.
  ctx.strokeStyle = "rgba(255,255,255,.025)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= 1200; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 630); ctx.stroke(); }
  for (let y = 0; y <= 630; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1200, y); ctx.stroke(); }

  drawCornerBrackets(ctx, accent);

  // Header: wordmark + competition tag on the left, kicker pill on the right.
  ctx.fillStyle = "#fff";
  ctx.font = "950 30px Oswald, Arial, sans-serif";
  ctx.fillText("TKDL", 66, 92);
  ctx.fillStyle = accent;
  ctx.fillText("LIVE", 142, 92);
  ctx.fillStyle = "rgba(255,255,255,.4)";
  ctx.font = "800 16px Oswald, Arial, sans-serif";
  ctx.fillText(`${spec.format.toUpperCase()} · ${spec.gameType.replaceAll("_", " ").toUpperCase()}`, 66, 118);

  const kicker = spec.kicker.toUpperCase();
  ctx.font = "900 17px Oswald, Arial, sans-serif";
  const kickerWidth = ctx.measureText(kicker).width + 38;
  roundedRect(ctx, 1134 - kickerWidth, 58, kickerWidth, 40, 20);
  ctx.fillStyle = hexToRgba(gold, .12);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(gold, .5);
  ctx.stroke();
  ctx.fillStyle = gold;
  ctx.textAlign = "center";
  ctx.fillText(kicker, 1134 - kickerWidth / 2, 83);
  ctx.textAlign = "left";

  ctx.fillStyle = "rgba(255,255,255,.1)";
  ctx.fillRect(66, 150, 1068, 2);

  // Winner block — dominant, left-aligned, roughly two thirds of the width.
  const contentRight = 760;
  ctx.fillStyle = accent;
  ctx.font = "900 20px Oswald, Arial, sans-serif";
  ctx.fillText("WINNER", 66, 212);

  const winner = spec.winnerName.toUpperCase();
  const winnerSize = fitText(ctx, winner, contentRight - 66, 86, 44);
  ctx.font = `950 ${winnerSize}px Oswald, Arial, sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.shadowColor = hexToRgba(accent, .35);
  ctx.shadowBlur = 26;
  ctx.fillText(winner, 66, 212 + winnerSize * .82);
  ctx.shadowBlur = 0;

  const winnerBaseline = 212 + winnerSize * .82;
  ctx.fillStyle = accent;
  ctx.fillRect(66, winnerBaseline + 22, 150, 5);

  ctx.fillStyle = "rgba(255,91,135,.75)";
  ctx.font = "900 17px Oswald, Arial, sans-serif";
  ctx.fillText("DEFEATED", 66, winnerBaseline + 62);

  const loser = spec.loserName.toUpperCase();
  const loserSize = fitText(ctx, loser, contentRight - 66, 42, 26);
  ctx.font = `800 ${loserSize}px Oswald, Arial, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,.48)";
  ctx.fillText(loser, 66, winnerBaseline + 62 + loserSize * .78);

  // Stake medallion — the focal secondary element on the right, replacing
  // the old card's plain "VS" pill with a single dramatic number.
  const medallionX = 985, medallionY = 268, medallionR = 118;
  const medallionGlow = ctx.createRadialGradient(medallionX, medallionY, 0, medallionX, medallionY, medallionR + 40);
  medallionGlow.addColorStop(0, hexToRgba(gold, .22));
  medallionGlow.addColorStop(1, hexToRgba(gold, 0));
  ctx.fillStyle = medallionGlow;
  ctx.fillRect(medallionX - medallionR - 40, medallionY - medallionR - 40, (medallionR + 40) * 2, (medallionR + 40) * 2);

  ctx.beginPath();
  ctx.arc(medallionX, medallionY, medallionR, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.045)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = hexToRgba(gold, .55);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(medallionX, medallionY, medallionR - 14, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(gold, .25);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const stakeText = String(spec.stake);
  ctx.textAlign = "center";
  const stakeSize = fitText(ctx, stakeText, medallionR * 1.5, 66, 32);
  ctx.font = `950 ${stakeSize}px Oswald, Arial, sans-serif`;
  ctx.fillStyle = gold;
  ctx.fillText(stakeText, medallionX, medallionY + stakeSize * .32);
  ctx.font = "800 14px Oswald, Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.5)";
  ctx.fillText(spec.stake === 1 ? "POINT AT STAKE" : "POINTS AT STAKE", medallionX, medallionY + stakeSize * .32 + 26);
  ctx.textAlign = "left";

  // Bottom stat strip — format / season / date, edge-lit rather than boxed
  // so it reads as a status bar, not another set of cards.
  const stats: { label: string; value: string }[] = [
    { label: "Competition", value: spec.format },
    { label: "Season", value: spec.seasonName ?? "TKDL" },
    { label: "Date", value: new Date(spec.playedAt ?? Date.now()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
  ];
  const stripY = 486, stripHeight = 92, gap = 16;
  const tileWidth = (1068 - gap * 2) / 3;
  stats.forEach((stat, index) => {
    const x = 66 + index * (tileWidth + gap);
    ctx.fillStyle = index === 0 ? accent : index === 1 ? gold : "rgba(255,255,255,.4)";
    ctx.fillRect(x, stripY, 4, stripHeight);
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.font = "800 13px Oswald, Arial, sans-serif";
    ctx.fillText(stat.label.toUpperCase(), x + 20, stripY + 28);
    const value = stat.value.toUpperCase();
    const valueSize = fitText(ctx, value, tileWidth - 40, 26, 15, 800);
    ctx.font = `800 ${valueSize}px Oswald, Arial, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.fillText(value.length > 28 ? `${value.slice(0, 26)}…` : value, x + 20, stripY + 60);
  });

  // Footer.
  ctx.fillStyle = "rgba(255,255,255,.28)";
  ctx.font = "700 14px Oswald, Arial, sans-serif";
  ctx.fillText("THE KINGDOM DARTS LEAGUE · OFFICIAL RESULT GRAPHIC", 66, 600);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.fillText("TKDL", 1134, 600);
  ctx.textAlign = "left";

  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not create image")), "image/png"));
}
