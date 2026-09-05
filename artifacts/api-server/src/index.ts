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
