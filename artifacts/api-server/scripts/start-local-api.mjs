import { randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { spawn } from "node:child_process";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectDir = path.resolve(apiDir, "../..");
const envFile = path.join(projectDir, ".env.local");
const composeFile = path.join(apiDir, "docker-compose.dev.yml");
const apiPort = Number(process.env.PORT ?? 18081);
if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
  throw new Error(`Invalid TKDL API PORT: ${process.env.PORT}`);
}
async function assertApiPortFree(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error(`TKDL API port ${port} is already in use. Stop the identified process manually; this launcher will not kill processes.`)));
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${signal ?? code}`));
    });
  });
}

async function waitForPostgres() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const connected = await new Promise((resolve) => {
      const socket = net.createConnection({ host: "127.0.0.1", port: 55432 });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (connected) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The isolated TKDL PostgreSQL container did not open 127.0.0.1:55432.");
}

async function loadLocalDatabasePassword() {
  try {
    const contents = await readFile(envFile, "utf8");
    const match = contents.match(/^TKDL_DB_PASSWORD=([a-f0-9]{64})$/m);
    if (!match) throw new Error("Invalid .env.local; remove it and rerun the preview.");
    return match[1];
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const password = randomBytes(32).toString("hex");
    await writeFile(envFile, `TKDL_DB_PASSWORD=${password}\n`, { mode: 0o600, flag: "wx" });
    await chmod(envFile, 0o600);
    return password;
  }
}

function waitForApi(child, port) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const fail = (error) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      clearTimeout(timeout);
      reject(error);
    };
    const check = async () => {
      try {
        const identityResponse = await fetch(`http://127.0.0.1:${port}/api/local-preview/identity`);
        const identity = await identityResponse.json();
        if (!identityResponse.ok || identity.service !== "tkdl-api" || identity.environment !== "local-development" || identity.port !== port) {
          return fail(new Error(`Port ${port} is not serving the verified TKDL local-development API.`));
        }
        const startupResponse = await fetch(`http://127.0.0.1:${port}/api/startup`);
        const startup = await startupResponse.json();
        if (startup.phase === "failed") {
          return fail(new Error(`TKDL API startup failed: ${startup.message}`));
        }
        if (!startup.ready) return;

        const response = await fetch(`http://127.0.0.1:${port}/api/leaderboard`);
        if (!response.ok) {
          return fail(new Error(`TKDL API is marked ready but /api/leaderboard returned HTTP ${response.status}.`));
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          return fail(new Error("TKDL API /api/leaderboard did not return JSON."));
        }
        const leaderboard = await response.json();
        if (!Array.isArray(leaderboard) || leaderboard.some(row => !row || !Number.isInteger(row.position) || typeof row.playerName !== "string" || !Number.isInteger(row.playerId))) {
          return fail(new Error("TKDL API /api/leaderboard returned an unexpected shape; expected an array of player standings."));
        }
        if (finished) return;
        finished = true;
        clearInterval(timer);
        clearTimeout(timeout);
        resolve();
      } catch {}
    };
    const timer = setInterval(check, 1000);
    const timeout = setTimeout(
      () => fail(new Error("TKDL API did not finish schema startup within 240 seconds.")),
      240_000,
    );
    child.once("exit", (code) => fail(new Error(`TKDL API exited before readiness (${code}).`)));
    void check();
  });
}

const password = await loadLocalDatabasePassword();
await assertApiPortFree(apiPort);
const composeEnv = { ...process.env, TKDL_DB_PASSWORD: password };
await run("docker", ["compose", "-p", "tkdl-development", "--env-file", envFile, "-f", composeFile, "up", "-d"], { cwd: apiDir, env: composeEnv });
await waitForPostgres();

const databaseUrl = new URL("postgresql://127.0.0.1:55432/tkdl_dev");
databaseUrl.username = "tkdl_dev";
databaseUrl.password = password;
const apiEnv = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !["DATABASE_URL", "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD"].includes(key),
    ),
  ),
  DATABASE_URL: databaseUrl.toString(),
  NODE_ENV: "development",
  TKDL_ENVIRONMENT: "local-development",
  TKDL_DISABLE_BACKGROUND_JOBS: "1",
  PORT: String(apiPort),
};

await run("pnpm", ["--filter", "@workspace/db", "run", "push-if-empty"], { cwd: projectDir, env: apiEnv });
await run("pnpm", ["run", "build"], { cwd: apiDir, env: apiEnv });
const api = spawn(process.execPath, ["--enable-source-maps", "dist/index.mjs"], {
  cwd: apiDir,
  env: apiEnv,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    api.kill(signal);
    process.exit(0);
  });
}

try {
  await waitForApi(api, apiPort);
  console.log(`TKDL local API ready on port ${apiPort}: /api/leaderboard returns JSON from the isolated tkdl_dev database.`);
} catch (error) {
  api.kill("SIGTERM");
  throw error;
}

await new Promise((resolve) => api.once("exit", resolve));
