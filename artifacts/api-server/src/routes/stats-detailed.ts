import { Router } from "express";
import { statsService } from "../services/stats-service";

const router = Router();

// GET /api/players/:id/stats/categories - Game type breakdown
router.get("/players/:id/stats/categories", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const window = (req.query.window as any) || "all";
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    const breakdown = await statsService.getGameTypeBreakdown(playerId, window);
    res.json(breakdown);
  } catch (err) {
    req.log.error({ err }, "Failed to get category breakdown");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// GET /api/players/:id/stats/category/:category - Detailed stats for M501, Tour, Practice, League
router.get("/players/:id/stats/category/:category", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const category = req.params.category as any;
    const window = (req.query.window as any) || "all";
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    if (!["M501", "Tour", "Practice", "League"].includes(category)) {
      res.status(400).json({ error: "Invalid category. Must be M501, Tour, Practice, or League" });
      return;
    }

    const stats = await statsService.getCategoryStats(playerId, category, window);
    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Failed to get category stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// GET /api/players/:id/stats/category/:category/trends - Monthly trends for category
router.get("/players/:id/stats/category/:category/trends", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const category = req.params.category as any;
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    if (!["M501", "Tour", "Practice", "League"].includes(category)) {
      res.status(400).json({ error: "Invalid category" });
      return;
    }

    const trends = await statsService.getCategoryTrends(playerId, category);
    res.json(trends);
  } catch (err) {
    req.log.error({ err }, "Failed to get category trends");
    res.status(500).json({ error: "Failed to get trends" });
  }
});

// GET /api/players/:id/stats/category/:category/darts - Dart profile for category
router.get("/players/:id/stats/category/:category/darts", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const category = req.params.category as any;
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    if (!["M501", "Tour", "Practice", "League"].includes(category)) {
      res.status(400).json({ error: "Invalid category" });
      return;
    }

    const profile = await statsService.getCategoryDartProfile(playerId, category);
    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "Failed to get dart profile");
    res.status(500).json({ error: "Failed to get dart profile" });
  }
});

// GET /api/players/:id/stats/category/:category/sessions - Sessions for category
router.get("/players/:id/stats/category/:category/sessions", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const category = req.params.category as any;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    if (!["M501", "Tour", "Practice", "League"].includes(category)) {
      res.status(400).json({ error: "Invalid category" });
      return;
    }

    const sessions = await statsService.getCategorySessions(playerId, category, limit);
    res.json(sessions);
  } catch (err) {
    req.log.error({ err }, "Failed to get sessions");
    res.status(500).json({ error: "Failed to get sessions" });
  }
});

// GET /api/players/:id/stats/sessions/:sessionId - Session detail
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

// GET /api/players/:id/stats/coach-feed - Data for coach integration
router.get("/players/:id/stats/coach-feed", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    const coachData = await statsService.getCoachFeedData(playerId);
    res.json(coachData);
  } catch (err) {
    req.log.error({ err }, "Failed to get coach feed");
    res.status(500).json({ error: "Failed to get coach feed" });
  }
});

export default router;
