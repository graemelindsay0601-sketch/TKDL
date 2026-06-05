import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedAchievements } from "./lib/achievements";
import { maybeAutoResetSeason } from "./lib/seasonReset";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// On startup: seed achievement definitions and auto-reset season if needed
async function init() {
  try {
    await seedAchievements();
    await maybeAutoResetSeason();
    logger.info("Startup init complete");
  } catch (err) {
    logger.error({ err }, "Startup init failed");
  }
}

init();

export default app;
