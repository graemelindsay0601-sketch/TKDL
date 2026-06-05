import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playersRouter from "./players";
import matchesRouter from "./matches";
import seasonsRouter from "./seasons";
import leaderboardRouter from "./leaderboard";
import achievementsRouter from "./achievements";
import statsRouter from "./stats";
import broadcastRouter from "./broadcast";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playersRouter);
router.use(matchesRouter);
router.use(seasonsRouter);
router.use(leaderboardRouter);
router.use(achievementsRouter);
router.use(statsRouter);
router.use(broadcastRouter);

export default router;
