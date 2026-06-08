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
import practiceRouter     from "./practice";
import teamMatchesRouter  from "./team-matches";
import tourRouter         from "./tour";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playersRouter);
router.use(matchesRouter);
router.use(teamMatchesRouter);
router.use(seasonsRouter);
router.use(leaderboardRouter);
router.use(achievementsRouter);
router.use(statsRouter);
router.use(adminRouter);
router.use(settingsRouter);
router.use(gameTypesRouter);
router.use(practiceRouter);
router.use(tourRouter);

export default router;
