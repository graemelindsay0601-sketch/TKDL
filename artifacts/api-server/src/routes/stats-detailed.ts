import { Router } from "express";
import { statsService } from "../services/stats-service";

const router = Router();

// GET /api/players/:id/stats/overview
router.get("/players/:id/stats/overview", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const window = (req.query.window as any) || "all";
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    const stats = await statsService.getOverallStats(playerId, window);
    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Failed to get overall stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// GET /api/players/:id/stats/by-game-type
router.get("/players/:id/stats/by-game-type", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const window = (req.query.window as any) || "all";
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    const stats = await statsService.getByGameType(playerId, window);
    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Failed to get game type stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// GET /api/players/:id/stats/game-type/:key/detail
router.get("/players/:id/stats/game-type/:key/detail", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const gameTypeKey = req.params.key;
    const window = (req.query.window as any) || "all";
    
    if (isNaN(playerId) || !gameTypeKey) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }

    const detail = await statsService.getGameTypeDetail(playerId, gameTypeKey, window);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to get game type detail");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// GET /api/players/:id/stats/trends
router.get("/players/:id/stats/trends", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    const trends = await statsService.getTrends(playerId);
    res.json(trends);
  } catch (err) {
    req.log.error({ err }, "Failed to get trends");
    res.status(500).json({ error: "Failed to get trends" });
  }
});

// GET /api/players/:id/stats/dart-profile
router.get("/players/:id/stats/dart-profile", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    const profile = await statsService.getDartProfile(playerId);
    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "Failed to get dart profile");
    res.status(500).json({ error: "Failed to get dart profile" });
  }
});

// GET /api/players/:id/stats/sessions
router.get("/players/:id/stats/sessions", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    const sessions = await statsService.getSessionHistory(playerId, limit);
    res.json(sessions);
  } catch (err) {
    req.log.error({ err }, "Failed to get session history");
    res.status(500).json({ error: "Failed to get sessions" });
  }
});

// GET /api/players/:id/stats/sessions/:sessionId
router.get("/players/:id/stats/sessions/:sessionId", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const sessionId = parseInt(req.params.sessionId, 10);
    
    if (isNaN(playerId) || isNaN(sessionId)) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }

    const detail = await statsService.getSessionDetail(playerId, sessionId);
    if (!detail) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to get session detail");
    res.status(500).json({ error: "Failed to get session detail" });
  }
});

export default router;
