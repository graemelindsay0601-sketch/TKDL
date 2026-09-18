import app, { initApp } from "./app";
import { logger } from "./lib/logger";
import { ensureCurrentBroadcastEdition } from "./broadcast/edition-engine";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);
const BROADCAST_SCHEDULER_INTERVAL_MS = 60_000;

function startBroadcastScheduler() {
  let running = false;
  const check = async () => {
    if (running) return;
    running = true;
    try {
      await ensureCurrentBroadcastEdition();
    } catch (err) {
      logger.error({ err }, "Scheduled broadcast edition check failed");
    } finally {
      running = false;
    }
  };
  void check();
  const timer = setInterval(() => void check(), BROADCAST_SCHEDULER_INTERVAL_MS);
  timer.unref();
}

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  try {
    // Finish schema initialization before accepting traffic. Starting the
    // listener first allowed a failed migration to leave the API apparently
    // healthy while most routes returned missing-table errors.
    await initApp();

    await new Promise<void>((resolve, reject) => {
      app.listen(port, (err) => {
        if (err) {
          logger.error({ err }, "Error listening on port");
          reject(err);
        } else {
          logger.info({ port }, "Server listening");
          startBroadcastScheduler();
          resolve();
        }
      });
    });
  } catch (err) {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  }
}

start();
