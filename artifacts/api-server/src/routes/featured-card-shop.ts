import { Router } from "express";
import {
  getTodaysFeaturedCards,
  rotateFeatureCards,
  purchaseFeaturedCard,
  getShopPurchaseHistory,
  getShopStatistics,
} from "../services/featured-card-shop-service";
import { logger } from "../lib/logger";

const router = Router();

/**
 * GET /api/card-clash/shop/featured
 * Get today's featured cards available for purchase
 */
router.get("/featured", async (req, res) => {
  try {
    const featured = await getTodaysFeaturedCards();
    res.json({
      success: true,
      featured,
      message: featured.length > 0 ? "Featured cards loaded" : "No featured cards available",
    });
  } catch (error) {
    logger.error({ error }, "Failed to get featured cards");
    res.status(500).json({ success: false, message: "Failed to load featured cards" });
  }
});

/**
 * POST /api/card-clash/shop/featured/:cardId/purchase
 * Purchase a featured card
 * Body: { playerId: number }
 */
router.post("/featured/:cardId/purchase", async (req, res) => {
  try {
    const { cardId } = req.params;
    const { playerId } = req.body;

    if (!cardId || !playerId) {
      return res.status(400).json({ success: false, message: "Missing cardId or playerId" });
    }

    const result = await purchaseFeaturedCard(Number(playerId), Number(cardId));
    
    if (result.success) {
      res.json({ success: true, ...result });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    logger.error({ error }, "Failed to purchase featured card");
    res.status(500).json({ success: false, message: "Purchase failed" });
  }
});

/**
 * POST /api/card-clash/shop/admin/rotate
 * Force rotation of featured cards (admin only)
 * Header: x-admin-pin
 */
router.post("/admin/rotate", async (req, res) => {
  try {
    const adminPin = req.headers["x-admin-pin"];
    if (adminPin !== process.env.ADMIN_PIN) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const result = await rotateFeatureCards();
    res.json({ success: true, message: "Featured cards rotated", result });
  } catch (error) {
    logger.error({ error }, "Failed to rotate featured cards");
    res.status(500).json({ success: false, message: "Rotation failed" });
  }
});

/**
 * GET /api/card-clash/shop/admin/purchase-history
 * Get purchase history for auditing (admin only)
 * Query: ?limit=100
 */
router.get("/admin/purchase-history", async (req, res) => {
  try {
    const adminPin = req.headers["x-admin-pin"];
    if (adminPin !== process.env.ADMIN_PIN) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    const history = await getShopPurchaseHistory(limit);

    res.json({
      success: true,
      count: history.length,
      history,
    });
  } catch (error) {
    logger.error({ error }, "Failed to get purchase history");
    res.status(500).json({ success: false, message: "Failed to load history" });
  }
});

/**
 * GET /api/card-clash/shop/admin/statistics
 * Get shop statistics for auditing (admin only)
 */
router.get("/admin/statistics", async (req, res) => {
  try {
    const adminPin = req.headers["x-admin-pin"];
    if (adminPin !== process.env.ADMIN_PIN) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const stats = await getShopStatistics();
    res.json({ success: true, statistics: stats });
  } catch (error) {
    logger.error({ error }, "Failed to get statistics");
    res.status(500).json({ success: false, message: "Failed to load statistics" });
  }
});

export default router;
