import pg from "pg";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (
  process.env.NODE_ENV !== "development" ||
  process.env.TKDL_ENVIRONMENT !== "local-development" ||
  !databaseUrl
) {
  throw new Error("Local schema bootstrap requires the guarded TKDL local-preview environment.");
}

const target = new URL(databaseUrl);
if (
  !["postgres:", "postgresql:"].includes(target.protocol) ||
  target.hostname !== "127.0.0.1" ||
  target.port !== "55432" ||
  decodeURIComponent(target.pathname.replace(/^\/+/, "")) !== "tkdl_dev" ||
  target.username !== "tkdl_dev" ||
  !target.password
) {
  throw new Error("Local schema bootstrap refused a database other than 127.0.0.1:55432/tkdl_dev.");
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
let publicTableCount;
try {
  const deadline = Date.now() + 60_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await pool.query(
        "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
      );
      publicTableCount = result.rows[0].count;
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (lastError) throw new Error("Local PostgreSQL did not become query-ready within 60 seconds.");
} finally {
  await pool.end();
}

if (publicTableCount > 0) {
  console.log("Local TKDL schema already exists; skipping forced first-time schema creation.");
  process.exit(0);
}

const dbDir = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(
  "pnpm",
  ["exec", "drizzle-kit", "push", "--force", "--config", "./drizzle.config.ts"],
  { cwd: dbDir, env: process.env, stdio: "inherit" },
);
const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
});
if (exitCode !== 0) process.exit(exitCode);
console.log("Created the canonical TKDL schema in the verified empty local database.");
