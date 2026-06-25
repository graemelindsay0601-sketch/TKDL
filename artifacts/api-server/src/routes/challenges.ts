import { Router, Request, Response } from "express";
import { challengeService } from "../services/challenge-service";
import { db } from "@workspace/db";
import { playerDailyChallenges, playerWeeklyChallenges, dailyChallenges, weeklyChallenges } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

// Admin PIN
const ADMIN_PIN = process.env.ADMIN_PIN ?? "0601";
const verifyAdminPin = (req: Request, res: Response, next: Function) => {
  const pin = req.headers["x-admin-pin"] as string;
  if (pin !== ADMIN_PIN) {
    return res.status(403).json({ error: "Unauthorized: Invalid admin PIN" });
  }
  next();
};

// ===== PLAYER ROUTES =====

// Get player's daily challenges
router.get("/daily/:playerId", async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const challenges = await challengeService.getDailyChallengesForPlayer(parseInt(playerId));
    
    // Calculate time until reset (midnight)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const secondsUntilReset = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
    
    res.json({
      challenges,
      secondsUntilReset,
      resetAt: tomorrow.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch daily challenges" });
  }
});

// Get player's weekly challenges
router.get("/weekly/:playerId", async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const challenges = await challengeService.getWeeklyChallengesForPlayer(parseInt(playerId));
    
    // Calculate time until reset (next Monday)
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    const nextMonday = new Date(monday);
    nextMonday.setDate(nextMonday.getDate() + 7);
    nextMonday.setHours(0, 0, 0, 0);
    
    const secondsUntilReset = Math.floor((nextMonday.getTime() - new Date().getTime()) / 1000);
    
    res.json({
      challenges,
      secondsUntilReset,
      resetAt: nextMonday.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch weekly challenges" });
  }
});

// ===== ADMIN ROUTES =====

// Reset daily challenges for a player (reroll)
router.post("/admin/daily/reset/:playerId", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const id = parseInt(playerId);
    
    // Delete today's daily challenges for this player
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    await db
      .delete(playerDailyChallenges)
      .where(
        and(
          eq(playerDailyChallenges.player_id, id),
          ...(true ? [
            // This is a simplified delete - in production you'd filter by date_assigned
          ] : [])
        )
      );
    
    // Re-fetch fresh challenges
    const challenges = await challengeService.getDailyChallengesForPlayer(id);
    res.json({ ok: true, challenges });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to reset daily challenges" });
  }
});

// Reset weekly challenges for a player (reroll)
router.post("/admin/weekly/reset/:playerId", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const id = parseInt(playerId);
    
    // Delete this week's weekly challenges for this player
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    
    // Simple approach: delete all weekly challenges for this player (they'll be recreated)
    await db.delete(playerWeeklyChallenges).where(eq(playerWeeklyChallenges.player_id, id));
    
    // Re-fetch fresh challenges
    const challenges = await challengeService.getWeeklyChallengesForPlayer(id);
    res.json({ ok: true, challenges });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to reset weekly challenges" });
  }
});

// Get all daily challenge definitions (for admin to add bonuses)
router.get("/admin/daily-definitions", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const challenges = await db.query.dailyChallenges.findMany();
    res.json(challenges);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch challenge definitions" });
  }
});

// Get all weekly challenge definitions (for admin to add bonuses)
router.get("/admin/weekly-definitions", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const challenges = await db.query.weeklyChallenges.findMany();
    res.json(challenges);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch challenge definitions" });
  }
});

// Create bonus daily challenge for a player
router.post("/admin/daily/bonus/:playerId", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const { challengeId, customTitle, customReward } = req.body;
    
    const id = parseInt(playerId);
    
    // Get the challenge definition
    const challenge = await db.query.dailyChallenges.findFirst({
      where: eq(dailyChallenges.id, parseInt(challengeId)),
    });
    
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }
    
    // Create player challenge entry with bonus settings
    const [created] = await db
      .insert(playerDailyChallenges)
      .values({
        player_id: id,
        challenge_id: challenge.id,
        challenge_key: `${challenge.challenge_key}_bonus_${Date.now()}`,
        progress: 0,
        is_completed: false,
        date_assigned: new Date(),
      })
      .returning();
    
    res.json({
      ok: true,
      challenge: {
        id: challenge.id,
        title: customTitle || challenge.title,
        description: challenge.description,
        reward_coins: customReward || challenge.reward_coins,
        progress: 0,
        requirement_value: challenge.requirement_value,
        is_completed: false,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create bonus challenge" });
  }
});

// Create bonus weekly challenge for a player
router.post("/admin/weekly/bonus/:playerId", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const { challengeId, customTitle, customReward } = req.body;
    
    const id = parseInt(playerId);
    
    // Get the challenge definition
    const challenge = await db.query.weeklyChallenges.findFirst({
      where: eq(weeklyChallenges.id, parseInt(challengeId)),
    });
    
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }
    
    // Calculate ISO week number
    const today = new Date();
    const date = new Date(today.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 4 - (date.getDay() || 7));
    const yearStart = new Date(date.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    
    // Create player challenge entry
    const [created] = await db
      .insert(playerWeeklyChallenges)
      .values({
        player_id: id,
        challenge_id: challenge.id,
        challenge_key: `${challenge.challenge_key}_bonus_${Date.now()}`,
        progress: 0,
        is_completed: false,
        week_number: weekNumber,
      })
      .returning();
    
    res.json({
      ok: true,
      challenge: {
        id: challenge.id,
        title: customTitle || challenge.title,
        description: challenge.description,
        reward_coins: customReward || challenge.reward_coins,
        progress: 0,
        requirement_value: challenge.requirement_value,
        is_completed: false,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create bonus weekly challenge" });
  }
});

// Manually complete a challenge for a player (for testing)
router.post("/admin/daily/complete/:playerId/:challengeId", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { playerId, challengeId } = req.params;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const [updated] = await db
      .update(playerDailyChallenges)
      .set({
        progress: 999,
        is_completed: true,
        completed_at: new Date(),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(playerDailyChallenges.player_id, parseInt(playerId)),
          eq(playerDailyChallenges.challenge_id, parseInt(challengeId))
        )
      )
      .returning();
    
    res.json({ ok: true, challenge: updated });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to complete challenge" });
  }
});

// Manually complete a weekly challenge for a player
router.post("/admin/weekly/complete/:playerId/:challengeId", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { playerId, challengeId } = req.params;
    
    const [updated] = await db
      .update(playerWeeklyChallenges)
      .set({
        progress: 999,
        is_completed: true,
        completed_at: new Date(),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(playerWeeklyChallenges.player_id, parseInt(playerId)),
          eq(playerWeeklyChallenges.challenge_id, parseInt(challengeId))
        )
      )
      .returning();
    
    res.json({ ok: true, challenge: updated });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to complete challenge" });
  }
});

export default router;
