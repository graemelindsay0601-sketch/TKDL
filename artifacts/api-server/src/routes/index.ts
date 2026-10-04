import { Router, type IRouter } from "express";
import healthRouter        from "./health";
import playersRouter       from "./players";
import matchesRouter       from "./matches";
import seasonsRouter       from "./seasons";
import leaderboardRouter   from "./leaderboard";
import achievementsRouter  from "./achievements";
import statsRouter         from "./stats";
import adminRouter         from "./admin";
import authRouter          from "./auth";
import { createCareerAdminRouter } from "../career/admin-router.ts";
import { db } from "@workspace/db";
import settingsRouter      from "./settings";
import gameTypesRouter     from "./game-types";
import practiceRouter      from "./practice";
import teamMatchesRouter   from "./team-matches";
import doublesRouter       from "./doubles";
import tourRouter          from "./tour";
import careerRouter        from "./career";
import master501Router     from "./master501";
import storageRouter       from "./storage";
import communityRouter     from "./community";
import messagesRouter      from "./messages";
import notificationsRouter from "./notifications";
import statsDetailedRouter from "./stats-detailed";
import cardClashRouter, { initializeCardClashSchema } from "./card-clash";
import challengesRouter    from "./challenges";
import cardClashSettingsRouter from "./card-clash-settings";
import cardClashFavoritesRouter from "./card-clash-favorites";
import bossBattlesRouter from "./boss-battles";
import boardCurseRouter from "./board-curse";
import shiftWarsRouter from "./shift-wars";
import broadcastRouter from "./broadcast";
import cosmeticsRouter from "./cosmetics";
import hubRouter from "./hub";
import interviewDeskRouter from "./interview-desk";
import selfPlayUnlocksRouter from "./self-play-unlocks";
import goalsRouter from "./goals";
import liveMatchRouter from "./live-match";
import matchCentreRouter from "./match-centre";
import teamMatchCorrectionsRouter from "./team-match-corrections";
import adminHealthRouter from "./admin-health";
import insightsRouter from "./insights";
import matchPostersRouter from "./match-posters";
import { logAdminAction } from "../lib/adminAudit";

const router: IRouter = Router();

// Catch consequential admin writes that do not have a richer, purpose-built
// audit entry. Routes that call logAdminAction themselves set a request flag
// and are not duplicated here. Passwords, PINs and request bodies are never
// copied into this generic record.
router.use((req, res, next) => {
  const method = req.method.toUpperCase();
  const isMutation = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
  const path = req.path;
  const isAdminOperation = path.startsWith("/admin/")
    || path.includes("/card-clash/admin/")
    || path.includes("/challenges/admin/")
    || /^\/seasons\/(?:reset|doubles\/reset|shift-wars\/reset)$/.test(path);

  if (isMutation && isAdminOperation && !path.endsWith("/verify-pin") && !path.endsWith("/lock")) {
    res.on("finish", () => {
      if (res.statusCode < 400 && (req.session as any)?.isAdmin && !(req as any).__tkdlAdminAuditLogged) {
        void logAdminAction(req, "admin.request", "admin_route", path, { method, status: res.statusCode });
      }
    });
  }
  next();
});

router.use(healthRouter);
router.use(authRouter);
router.use(playersRouter);
router.use(matchesRouter);
router.use(teamMatchesRouter);
router.use(doublesRouter);
router.use(seasonsRouter);
router.use(leaderboardRouter);
router.use(achievementsRouter);
router.use(statsRouter);
router.use(adminRouter);
router.use(settingsRouter);
router.use(gameTypesRouter);
router.use(practiceRouter);
router.use(tourRouter);
router.use("/career", careerRouter);
router.use(createCareerAdminRouter(db));
router.use(master501Router);
router.use(storageRouter);
router.use(communityRouter);
router.use(messagesRouter);
router.use(notificationsRouter);
router.use(statsDetailedRouter);
router.use("/card-clash", cardClashRouter);
router.use("/challenges", challengesRouter);
router.use(cardClashSettingsRouter);
router.use(cardClashFavoritesRouter);
router.use(bossBattlesRouter);
router.use(boardCurseRouter);
router.use(shiftWarsRouter);
router.use(broadcastRouter);
router.use(cosmeticsRouter);
router.use(hubRouter);
router.use(interviewDeskRouter);
router.use(selfPlayUnlocksRouter);
router.use(goalsRouter);
router.use(liveMatchRouter);
router.use(matchCentreRouter);
router.use(teamMatchCorrectionsRouter);
router.use(adminHealthRouter);
router.use(insightsRouter);
router.use(matchPostersRouter);

export default router;
export { initializeCardClashSchema };
