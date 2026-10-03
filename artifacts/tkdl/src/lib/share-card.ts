export type ShareCardStat = { label: string; value: string };

export type ShareCardSpec = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  badge?: string;
  accent?: string;
  secondaryAccent?: string;
  stats?: ShareCardStat[];
  footer?: string;
  /** Optional match-poster layout: two named sides with a central VS mark. */
  versus?: { sideA: string; sideB: string };
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

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, initialSize: number, minSize = 42) {
  let size = initialSize;
  do {
    ctx.font = `950 ${size}px Oswald, Arial, sans-serif`;
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

export async function renderShareCard(spec: ShareCardSpec): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  const accent = spec.accent ?? "#ff005c";
  const secondary = spec.secondaryAccent ?? "#0066ff";
  const background = ctx.createLinearGradient(0, 0, 1200, 630);
  background.addColorStop(0, "#090511");
  background.addColorStop(.56, "#10091c");
  background.addColorStop(1, "#050b18");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1200, 630);

  const glowA = ctx.createRadialGradient(100, 520, 0, 100, 520, 430);
  glowA.addColorStop(0, hexToRgba(accent, .28));
  glowA.addColorStop(1, hexToRgba(accent, 0));
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, 600, 630);
  const glowB = ctx.createRadialGradient(1120, 60, 0, 1120, 60, 430);
  glowB.addColorStop(0, hexToRgba(secondary, .22));
  glowB.addColorStop(1, hexToRgba(secondary, 0));
  ctx.fillStyle = glowB;
  ctx.fillRect(600, 0, 600, 630);

  ctx.strokeStyle = "rgba(255,255,255,.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= 1200; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 630); ctx.stroke(); }
  for (let y = 0; y <= 630; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1200, y); ctx.stroke(); }

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 14, 630);
  ctx.fillStyle = "#fff";
  ctx.font = "950 34px Oswald, Arial, sans-serif";
  ctx.fillText("TKDL", 70, 74);
  ctx.fillStyle = accent;
  ctx.fillText("LIVE", 154, 74);
  ctx.fillStyle = "rgba(255,255,255,.42)";
  ctx.font = "800 17px Oswald, Arial, sans-serif";
  ctx.fillText("OFFICIAL LEAGUE GRAPHIC", 70, 102);

  if (spec.badge) {
    ctx.font = "900 17px Oswald, Arial, sans-serif";
    const badgeWidth = ctx.measureText(spec.badge.toUpperCase()).width + 34;
    roundedRect(ctx, 1130 - badgeWidth, 48, badgeWidth, 42, 21);
    ctx.fillStyle = hexToRgba(accent, .13);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(accent, .5);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.textAlign = "center";
    ctx.fillText(spec.badge.toUpperCase(), 1130 - badgeWidth / 2, 75);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = accent;
  ctx.font = "900 21px Oswald, Arial, sans-serif";
  ctx.fillText(spec.eyebrow.toUpperCase(), 70, 174);
  ctx.fillStyle = "rgba(255,255,255,.11)";
  ctx.fillRect(70, 192, 1060, 2);

  if (spec.versus) {
    const left = spec.versus.sideA.toUpperCase();
    const right = spec.versus.sideB.toUpperCase();
    const sideWidth = 440;
    const leftSize = fitText(ctx, left, sideWidth, 62, 26);
    ctx.font = `950 ${leftSize}px Oswald, Arial, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.shadowColor = hexToRgba(accent, .3);
    ctx.shadowBlur = 24;
    ctx.fillText(left, 70, 287);
    const rightSize = fitText(ctx, right, sideWidth, 62, 26);
    ctx.font = `950 ${rightSize}px Oswald, Arial, sans-serif`;
    ctx.textAlign = "right";
    ctx.shadowColor = hexToRgba(secondary, .3);
    ctx.fillText(right, 1130, 287);
    ctx.shadowBlur = 0;
    ctx.textAlign = "center";
    roundedRect(ctx, 553, 231, 94, 72, 22);
    ctx.fillStyle = "rgba(255,255,255,.065)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,210,74,.42)";
    ctx.stroke();
    ctx.fillStyle = "#ffd24a";
    ctx.font = "950 28px Oswald, Arial, sans-serif";
    ctx.fillText("VS", 600, 277);
    ctx.textAlign = "left";
  } else {
    const title = spec.title.toUpperCase();
    const titleSize = fitText(ctx, title, 1060, 92);
    ctx.font = `950 ${titleSize}px Oswald, Arial, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.shadowColor = hexToRgba(accent, .28);
    ctx.shadowBlur = 28;
    ctx.fillText(title, 70, 292);
    ctx.shadowBlur = 0;
  }

  if (spec.subtitle) {
    ctx.font = "600 25px Inter, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,.57)";
    const subtitle = spec.subtitle.length > 78 ? `${spec.subtitle.slice(0, 75)}…` : spec.subtitle;
    ctx.fillText(subtitle, 72, 339);
  }

  const stats = (spec.stats ?? []).slice(0, 3);
  if (stats.length > 0) {
    const gap = 15;
    const width = (1060 - gap * (stats.length - 1)) / stats.length;
    stats.forEach((stat, index) => {
      const x = 70 + index * (width + gap);
      roundedRect(ctx, x, 386, width, 128, 13);
      ctx.fillStyle = "rgba(255,255,255,.045)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.1)";
      ctx.stroke();
      ctx.fillStyle = index === 0 ? accent : index === 1 ? secondary : "#ffd24a";
      const statValue = String(stat.value).toUpperCase().slice(0, 32);
      const statSize = fitText(ctx, statValue, width - 40, 37, 20);
      ctx.font = `950 ${statSize}px Oswald, Arial, sans-serif`;
      ctx.fillText(statValue, x + 20, 441);
      ctx.fillStyle = "rgba(255,255,255,.38)";
      ctx.font = "800 15px Oswald, Arial, sans-serif";
      ctx.fillText(stat.label.toUpperCase(), x + 20, 478);
    });
  }

  ctx.fillStyle = "rgba(255,255,255,.3)";
  ctx.font = "700 15px Oswald, Arial, sans-serif";
  ctx.fillText((spec.footer ?? "THE KINGDOM DARTS LEAGUE").toUpperCase(), 70, 580);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,.2)";
  ctx.fillText("TKDL", 1130, 580);

  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not create image")), "image/png"));
}

export async function shareCard(spec: ShareCardSpec, filename: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = await renderShareCard(spec);
  const safeName = `${filename.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "tkdl-card"}.png`;
  if (typeof File !== "undefined" && navigator.share) {
    const file = new File([blob], safeName, { type: "image/png" });
    try {
      if (!navigator.canShare?.({ files: [file] })) throw new Error("File sharing is unavailable");
      await navigator.share({ files: [file], title: spec.title, text: spec.subtitle });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Browsers that expose Web Share but reject files still get the
      // ordinary PNG download below.
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return "downloaded";
}
