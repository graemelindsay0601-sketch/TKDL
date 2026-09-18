import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  buildPreviewPath,
  PREVIEW_MODES,
  PREVIEW_SCENES,
  PREVIEW_VIEWPORTS,
} from "../src/features/broadcast/preview-matrix.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const REQUIRED_REGIONS = ["title-bar", "scene", "presenters", "lower-third", "ticker"];
const GRAPHIC_TEXT = {
  result: ["SEAN", "RICHARD", "8 POINTS"],
  analysis: ["RICHARD", "GRAEME", "SEAN", "52%"],
  spotlight: ["GRAEME"],
  graphic: ["RICHARD", "SEAN"],
  breaking: ["RICHARD", "81"],
  champion: ["RICHARD", "MAY 2026 SINGLES"],
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.expectedStop = true;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(2_000),
  ]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      delay(1_000),
    ]);
  }
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForHttp(url, label, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}: ${lastError?.message ?? "no response"}`);
}

async function startPreviewServer() {
  const configured = process.env.TKDL_VISUAL_SWEEP_URL;
  if (configured) return { baseUrl: configured.replace(/\/$/, ""), process: null };

  const port = await freePort();
  const child = spawn("pnpm", ["run", "dev"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), BASE_PATH: "/", NODE_ENV: "development" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.once("exit", (code) => {
    if (code && code !== 0 && !child.expectedStop) process.stderr.write(output);
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHttp(baseUrl, "TKDL preview server");
  return { baseUrl, process: child };
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(String(data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params);
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new CdpClient(socket);
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 10_000);
      this.pending.set(id, {
        resolve: (result) => { clearTimeout(timeout); resolve(result); },
        reject: (error) => { clearTimeout(timeout); reject(error); },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function startBrowser() {
  const debugPort = await freePort();
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "tkdl-live-sweep-"));
  const executable = process.env.CHROMIUM_PATH || "chromium";
  const child = spawn(executable, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.once("exit", (code) => {
    if (code && code !== 0 && !child.expectedStop) process.stderr.write(stderr);
  });

  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, "Chromium DevTools");
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about%3Ablank`, { method: "PUT" });
  if (!targetResponse.ok) throw new Error(`Could not create Chromium target: ${targetResponse.status}`);
  const target = await targetResponse.json();
  const client = await CdpClient.connect(target.webSocketDebuggerUrl);
  await Promise.all([
    client.send("Page.enable"),
    client.send("Runtime.enable"),
    client.send("Network.enable"),
  ]);
  return { child, client, userDataDir };
}

function inspectLayout({ expectOverlay, requiredRegions }) {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const rect = (element) => {
    const value = element.getBoundingClientRect();
    return {
      left: value.left,
      top: value.top,
      right: value.right,
      bottom: value.bottom,
      width: value.width,
      height: value.height,
    };
  };
  const isVisible = (element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && bounds.width > 0 && bounds.height > 0;
  };
  const insideViewport = (bounds) =>
    bounds.left >= -1 &&
    bounds.top >= -1 &&
    bounds.right <= viewport.width + 1 &&
    bounds.bottom <= viewport.height + 1;
  const intersects = (a, b) =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) > 1 &&
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) > 1;

  const regions = {};
  for (const element of document.querySelectorAll("[data-broadcast-region]")) {
    if (!isVisible(element)) continue;
    const name = element.getAttribute("data-broadcast-region");
    (regions[name] ??= []).push(rect(element));
  }

  const important = [
    ...document.querySelectorAll("[data-broadcast-headline], [data-broadcast-region='graphic']"),
  ].filter(isVisible).map(rect);
  const presenters = [...document.querySelectorAll("[data-broadcast-presenter]")]
    .filter(isVisible)
    .map(rect);
  const presenterContentOverlaps = presenters.flatMap((presenter, presenterIndex) =>
    important
      .map((content, contentIndex) => intersects(presenter, content) ? { presenterIndex, contentIndex, presenter, content } : null)
      .filter(Boolean),
  );

  const lowerThird = regions["lower-third"]?.[0];
  const ticker = regions.ticker?.[0];
  const overlaySubject = document.querySelector("[data-broadcast-overlay-subject]");
  const visibleHeadings = [...document.querySelectorAll("[data-broadcast-headline]")].filter(isVisible);

  return {
    viewport,
    bodyText: document.body.innerText.toUpperCase(),
    missingRegions: requiredRegions.filter((name) => !regions[name]?.length),
    outOfBounds: Object.entries(regions).flatMap(([name, values]) =>
      values.filter((bounds) => !insideViewport(bounds)).map((bounds) => ({ name, bounds })),
    ),
    pageOverflow:
      document.documentElement.scrollWidth > viewport.width + 1 ||
      document.documentElement.scrollHeight > viewport.height + 1,
    lowerThirdTickerOverlap: Boolean(lowerThird && ticker && lowerThird.bottom > ticker.top + 1),
    presenterContentOverlaps,
    clippedHeadings: visibleHeadings
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => ({
        text: element.textContent?.trim(),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      })),
    brokenImages: [...document.images]
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src),
    overlayVisible: Boolean(regions["live-overlay"]?.length),
    overlaySubjectClipped: Boolean(
      overlaySubject && overlaySubject.scrollWidth > overlaySubject.clientWidth + 1,
    ),
    expectOverlay,
  };
}

async function waitForPreview(client, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await client.send("Runtime.evaluate", {
      expression: "document.readyState === 'complete' && Boolean(document.querySelector('[data-broadcast-region=\"scene\"]'))",
      returnByValue: true,
    });
    if (result.result.value) return;
    await delay(50);
  }
  throw new Error(`Preview did not render within ${Math.round(timeoutMs / 1_000)} seconds`);
}

async function warmPreview(client, url) {
  const attempts = 12;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await client.send("Page.navigate", { url });
    try {
      await waitForPreview(client, 10_000);
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
    }
  }
}

async function inspectCase(client, url, viewport, expectedText, expectOverlay) {
  const assetFailures = [];
  let collecting = true;
  const onResponse = ({ response, type }) => {
    if (!collecting) return;
    if (["Document", "Stylesheet", "Script", "Image", "Font"].includes(type) && response.status >= 400) {
      assetFailures.push(`${response.status} ${response.url}`);
    }
  };
  const onFailed = ({ type, errorText, canceled }) => {
    if (!collecting || canceled) return;
    if (["Document", "Stylesheet", "Script", "Image", "Font"].includes(type)) {
      assetFailures.push(`${type} ${errorText}`);
    }
  };
  client.on("Network.responseReceived", onResponse);
  client.on("Network.loadingFailed", onFailed);

  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 600,
  });
  await client.send("Page.navigate", { url });
  await waitForPreview(client);
  await client.send("Runtime.evaluate", {
    expression: "document.fonts.ready",
    awaitPromise: true,
  });
  await delay(350);
  collecting = false;

  const evaluation = await client.send("Runtime.evaluate", {
    expression: `(${inspectLayout.toString()})(${JSON.stringify({ expectOverlay, requiredRegions: REQUIRED_REGIONS })})`,
    returnByValue: true,
  });
  if (evaluation.exceptionDetails) throw new Error(evaluation.exceptionDetails.text);
  const layout = evaluation.result.value;
  const failures = [];
  if (layout.pageOverflow) failures.push("page overflow");
  if (layout.missingRegions.length) failures.push(`missing regions: ${layout.missingRegions.join(", ")}`);
  if (layout.outOfBounds.length) failures.push(`out-of-bounds regions: ${JSON.stringify(layout.outOfBounds)}`);
  if (layout.lowerThirdTickerOverlap) failures.push("lower third overlaps ticker");
  if (layout.presenterContentOverlaps.length) failures.push(`presenters overlap headline/graphic: ${JSON.stringify(layout.presenterContentOverlaps)}`);
  if (layout.clippedHeadings.length) failures.push(`clipped headings: ${JSON.stringify(layout.clippedHeadings)}`);
  if (layout.brokenImages.length) failures.push(`broken images: ${layout.brokenImages.join(", ")}`);
  if (layout.overlayVisible !== expectOverlay) failures.push(`overlay visible=${layout.overlayVisible}, expected=${expectOverlay}`);
  if (expectOverlay && layout.overlaySubjectClipped) failures.push("overlay subject is clipped");
  if (assetFailures.length) failures.push(`failed assets: ${assetFailures.join(", ")}`);
  for (const text of expectedText) {
    if (!layout.bodyText.includes(text)) failures.push(`missing graphic data: ${text}`);
  }
  return failures;
}

async function main() {
  let preview;
  let browser;
  const failures = [];
  let checked = 0;
  try {
    preview = await startPreviewServer();
    browser = await startBrowser();
    // The first development request can spend well over the normal per-page
    // allowance compiling the app and lazy preview chunk. Warm it once so
    // subsequent timeouts indicate a broken route, not Vite's cold start.
    await warmPreview(
      browser.client,
      `${preview.baseUrl}${buildPreviewPath({ scene: "desk", mode: "NEWS", turn: 999 })}`,
    );

    for (const [viewportName, viewport] of Object.entries(PREVIEW_VIEWPORTS)) {
      for (const scene of PREVIEW_SCENES) {
        for (const mode of PREVIEW_MODES) {
          const previewPath = buildPreviewPath({ scene, mode, turn: 999 });
          const url = `${preview.baseUrl}${previewPath}`;
          try {
            const caseFailures = await inspectCase(browser.client, url, viewport, GRAPHIC_TEXT[scene] ?? [], false);
            if (caseFailures.length) failures.push(`${viewportName} ${scene}/${mode}: ${caseFailures.join("; ")}`);
          } catch (error) {
            failures.push(`${viewportName} ${scene}/${mode}: ${error.message}`);
          }
          checked++;
        }
      }

      for (const overlay of ["just_in", "breaking"]) {
        const previewPath = buildPreviewPath({ scene: "result", mode: "NEWS", turn: 999, overlay });
        const url = `${preview.baseUrl}${previewPath}`;
        try {
          const caseFailures = await inspectCase(browser.client, url, viewport, GRAPHIC_TEXT.result, true);
          if (caseFailures.length) failures.push(`${viewportName} ${overlay} overlay: ${caseFailures.join("; ")}`);
        } catch (error) {
          failures.push(`${viewportName} ${overlay} overlay: ${error.message}`);
        }
        checked++;
      }
    }
  } finally {
    browser?.client.close();
    await Promise.all([
      stopChild(browser?.child),
      stopChild(preview?.process),
    ]);
    if (browser?.userDataDir) {
      await rm(browser.userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }

  if (failures.length) {
    console.error(`TKDL LIVE visual sweep failed (${failures.length}/${checked} cases):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`TKDL LIVE visual sweep passed: ${checked} scene/overlay cases across desktop and phone.`);
}

await main();