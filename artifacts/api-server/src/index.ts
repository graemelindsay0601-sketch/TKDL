import app, { initApp } from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  try {
    // Start server first so health checks pass immediately
    await new Promise<void>((resolve, reject) => {
      app.listen(port, (err) => {
        if (err) {
          logger.error({ err }, "Error listening on port");
          reject(err);
        } else {
          logger.info({ port }, "Server listening");
          resolve();
        }
      });
    });

    // Initialize app in background (non-blocking)
    // This allows Render health checks to pass while initialization completes
    initApp().catch((err) => {
      logger.error({ err }, "Background initialization failed (server already running)");
    });
  } catch (err) {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  }
}

start();
