import { Router, type IRouter } from "express";
import healthRouter       from "./health";
import playersRouter      from "./players";
import matchesRouter      from "./matches";
import seasonsRouter      from "./seasons";
import leaderboardRouter  from "./leaderboard";
import achievementsRouter from "./achievements";
import statsRouter        from "./stats";
import adminRouter        from "./admin";
import authRouter         from "./auth";
import settingsRouter     from "./settings";
import gameTypesRouter    from "./game-types";
import practiceRouter     from "./practice";
import teamMatchesRouter  from "./team-matches";
import tourRouter         from "./tour";
import master501Router    from "./master501";
// import scorerRouter       from "./scorer";      // auto-scorer disabled
// import dartScorerRouter   from "./dart-scorer"; // auto-scorer disabled


const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
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
router.use(master501Router);
// router.use(scorerRouter);     // auto-scorer disabled
// router.use(dartScorerRouter); // auto-scorer disabled


export default router;
