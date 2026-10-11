import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import net from "node:net";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectDir = path.resolve(webDir, "../..");
const apiDir = path.join(projectDir, "artifacts/api-server");
const apiPort = 18081;
const previewPort = Number(process.env.PORT ?? 3000);
async function assertPortFree(port, label) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error(`${label} port ${port} is already in use. Stop the identified TKDL process manually; this launcher will not kill processes.`)));
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
}
if (!Number.isInteger(previewPort) || previewPort < 1 || previewPort > 65535) throw new Error(`Invalid preview PORT: ${process.env.PORT}`);
await assertPortFree(apiPort, "TKDL API");
await assertPortFree(previewPort, "TKDL web preview");
const api = spawn("pnpm", ["run", "dev"], {
  cwd: apiDir,
  env: { ...process.env, PORT: String(apiPort) },
  stdio: "inherit",
});
let vite;
let stopping = false;

function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  api.kill(signal);
  vite?.kill(signal);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

try {
  await new Promise((resolve, reject) => {
    let poll;
    const timeout = setTimeout(
      () => fail("Timed out waiting for the isolated TKDL API on port 18081."),
      250_000,
    );
    const fail = (message) => {
      clearTimeout(timeout);
      if (poll) clearInterval(poll);
      reject(new Error(message));
    };
    poll = setInterval(async () => {
      if (api.exitCode !== null) {
        fail(`TKDL API exited before preview start (${api.exitCode}).`);
        return;
      }
      try {
        const identityResponse = await fetch(`http://127.0.0.1:${apiPort}/api/local-preview/identity`);
        if (identityResponse.status === 404) {
          fail("Port 18081 is answering, but it is not the TKDL local-preview API. Check which API package owns the port.");
          return;
        }
        if (!identityResponse.ok || !(identityResponse.headers.get("content-type") ?? "").includes("application/json")) return;
        const identity = await identityResponse.json();
        if (identity.service !== "tkdl-api" || identity.environment !== "local-development" || identity.port !== apiPort) {
          fail("Port 18081 answered with the wrong API identity; refusing to start Vite.");
          return;
        }
        const startupResponse = await fetch(`http://127.0.0.1:${apiPort}/api/startup`);
        if (!startupResponse.ok || !(await startupResponse.json()).ready) return;
        const response = await fetch(`http://127.0.0.1:${apiPort}/api/leaderboard`);
        if (!response.ok || !(response.headers.get("content-type") ?? "").includes("application/json")) return;
        const leaderboard = await response.json();
        if (!Array.isArray(leaderboard) || leaderboard.some(row => !row || !Number.isInteger(row.position) || typeof row.playerName !== "string" || !Number.isInteger(row.playerId))) {
          fail("TKDL /api/leaderboard returned the wrong response structure.");
          return;
        }
        clearTimeout(timeout);
        clearInterval(poll);
        resolve();
      } catch {}
    }, 1000);
  });

  console.log(`Starting TKDL web preview at http://localhost:${previewPort}; /api is proxied to the verified TKDL API on ${apiPort}.`);
  vite = spawn("pnpm", ["exec", "vite", "--config", "vite.config.ts", "--host", "0.0.0.0"], {
    cwd: webDir,
    env: Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !["DATABASE_URL", "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD"].includes(key),
      ),
    ),
    stdio: "inherit",
  });
  await Promise.race([
    new Promise((resolve) => api.once("exit", resolve)),
    new Promise((resolve) => vite.once("exit", resolve)),
  ]);
} finally {
  stop();
}
