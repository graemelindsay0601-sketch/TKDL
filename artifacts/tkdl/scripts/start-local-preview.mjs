import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectDir = path.resolve(webDir, "../..");
const apiDir = path.join(projectDir, "artifacts/api-server");
const api = spawn("pnpm", ["run", "dev"], {
  cwd: apiDir,
  env: { ...process.env, PORT: "18081" },
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
    const timeout = setTimeout(
      () => reject(new Error("Timed out waiting for the isolated TKDL API on port 18081.")),
      250_000,
    );
    const poll = setInterval(async () => {
      if (api.exitCode !== null) {
        clearTimeout(timeout);
        clearInterval(poll);
        reject(new Error(`TKDL API exited before preview start (${api.exitCode}).`));
        return;
      }
      try {
        const response = await fetch("http://127.0.0.1:18081/api/leaderboard");
        if (response.ok && (response.headers.get("content-type") ?? "").includes("application/json")) {
          clearTimeout(timeout);
          clearInterval(poll);
          resolve();
        }
      } catch {}
    }, 1000);
  });

  console.log("Starting TKDL web preview; /api is proxied to the isolated TKDL API.");
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
