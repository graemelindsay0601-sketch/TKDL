import { Router, type IRouter } from "express";
import healthRouter       from "./health";
import playersRouter      from "./players";
import matchesRouter      from "./matches";
import seasonsRouter      from "./seasons";
import leaderboardRouter  from "./leaderboard";
import achievementsRouter from "./achievements";
import statsRouter        from "./stats";
import adminRouter        from "./admin";
import settingsRouter     from "./settings";
import gameTypesRouter    from "./game-types";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playersRouter);
router.use(matchesRouter);
router.use(seasonsRouter);
router.use(leaderboardRouter);
router.use(achievementsRouter);
router.use(statsRouter);
router.use(adminRouter);
router.use(settingsRouter);
router.use(gameTypesRouter);

export default router;
