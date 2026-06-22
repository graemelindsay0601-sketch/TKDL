import { db } from "@workspace/db";
import { sql as drizzleSql } from "drizzle-orm";

export interface DrillCompletion {
  id: number;
  playerId: number;
  drillId: string;
  drillTitle: string;
  completedAt: Date;
  durationMinutes: number;
  score?: number; // 0-100, how well they did
  notes?: string;
  difficulty: "easy" | "medium" | "hard" | "master";
}

export interface DrillStats {
  drillId: string;
  drillTitle: string;
  totalCompletions: number;
  lastCompleted?: Date;
  bestScore?: number;
  averageScore?: number;
  currentMastery: "novice" | "intermediate" | "proficient" | "mastered";
  nextGoal?: string;
  improvementTrend: number; // percentage change in last 5 sessions
}

export interface DrillMilestone {
  name: string;
  achieved: boolean;
  progress: number; // 0-100
  description: string;
}

export const drillProgressService = {
  // Record a completed drill session
  async completeDrill(
    playerId: number,
    drillId: string,
    drillTitle: string,
    durationMinutes: number,
    score: number,
    difficulty: "easy" | "medium" | "hard" | "master",
    notes?: string
  ): Promise<DrillCompletion> {
    const result = await db.execute(drizzleSql`
      INSERT INTO drill_completions (
        player_id, drill_id, drill_title, completed_at,
        duration_minutes, score, notes, difficulty
      ) VALUES (
        ${playerId}, ${drillId}, ${drillTitle}, NOW(),
        ${durationMinutes}, ${score}, ${notes || null}, ${difficulty}
      ) RETURNING *
    `);

    return (result.rows[0] as any) as DrillCompletion;
  },

  // Get completion history for a drill
  async getDrillHistory(playerId: number, drillId: string, limit: number = 20) {
    const result = await db.execute(drizzleSql`
      SELECT * FROM drill_completions
      WHERE player_id = ${playerId} AND drill_id = ${drillId}
      ORDER BY completed_at DESC
      LIMIT ${limit}
    `);

    return result.rows as DrillCompletion[];
  },

  // Get stats for all drills a player has done
  async getPlayerDrillStats(playerId: number): Promise<DrillStats[]> {
    const result = await db.execute(drizzleSql`
      WITH drill_data AS (
        SELECT
          drill_id,
          drill_title,
          COUNT(*)::int as total_completions,
          MAX(completed_at) as last_completed,
          MAX(score) as best_score,
          AVG(score)::numeric as average_score
        FROM drill_completions
        WHERE player_id = ${playerId}
        GROUP BY drill_id, drill_title
      ),
      recent_trend AS (
        SELECT
          drill_id,
          AVG(score) as recent_avg
        FROM drill_completions
        WHERE player_id = ${playerId}
          AND completed_at >= NOW() - INTERVAL '30 days'
        GROUP BY drill_id
      ),
      all_time_trend AS (
        SELECT
          drill_id,
          AVG(score) as all_time_avg
        FROM drill_completions
        WHERE player_id = ${playerId}
        GROUP BY drill_id
      )
      SELECT
        d.drill_id,
        d.drill_title,
        d.total_completions,
        d.last_completed,
        d.best_score::numeric,
        d.average_score,
        CASE
          WHEN d.average_score >= 90 THEN 'mastered'
          WHEN d.average_score >= 75 THEN 'proficient'
          WHEN d.average_score >= 60 THEN 'intermediate'
          ELSE 'novice'
        END as mastery_level,
        COALESCE(
          ROUND(((r.recent_avg - a.all_time_avg) / a.all_time_avg * 100)::numeric, 1),
          0
        )::numeric as trend
      FROM drill_data d
      LEFT JOIN recent_trend r ON d.drill_id = r.drill_id
      LEFT JOIN all_time_trend a ON d.drill_id = a.drill_id
      ORDER BY d.total_completions DESC
    `);

    return (result.rows as any[]).map((row: any) => ({
      drillId: row.drill_id,
      drillTitle: row.drill_title,
      totalCompletions: row.total_completions,
      lastCompleted: row.last_completed ? new Date(row.last_completed) : undefined,
      bestScore: row.best_score ? parseFloat(row.best_score) : undefined,
      averageScore: row.average_score ? parseFloat(row.average_score) : undefined,
      currentMastery: row.mastery_level,
      nextGoal: this.getNextGoal(row.mastery_level),
      improvementTrend: parseFloat(row.trend),
    }));
  },

  // Get mastery progression milestones
  async getPlayerDrillMilestones(playerId: number): Promise<DrillMilestone[]> {
    const stats = await this.getPlayerDrillStats(playerId);

    const totalCompletions = stats.reduce((sum, s) => sum + s.totalCompletions, 0);
    const mastered = stats.filter(s => s.currentMastery === "mastered").length;
    const avgScore = stats.length > 0
      ? stats.reduce((sum, s) => sum + (s.averageScore || 0), 0) / stats.length
      : 0;

    return [
      {
        name: "First Drill",
        achieved: stats.length >= 1,
        progress: stats.length >= 1 ? 100 : 0,
        description: "Complete your first drill",
      },
      {
        name: "Drill Sergeant",
        achieved: totalCompletions >= 20,
        progress: Math.min((totalCompletions / 20) * 100, 100),
        description: "Complete 20 total drill sessions",
      },
      {
        name: "Drill Master",
        achieved: mastered >= 3,
        progress: Math.min((mastered / 3) * 100, 100),
        description: "Master 3 different drills (90%+ score)",
      },
      {
        name: "Consistent Performer",
        achieved: avgScore >= 75,
        progress: Math.min((avgScore / 75) * 100, 100),
        description: "Maintain 75%+ average across all drills",
      },
      {
        name: "Unstoppable",
        achieved: totalCompletions >= 50,
        progress: Math.min((totalCompletions / 50) * 100, 100),
        description: "Complete 50 total drill sessions",
      },
    ];
  },

  // Get recommendation for next drill based on progress
  async getNextDrillRecommendation(playerId: number, coachDrills: any[]) {
    const stats = await this.getPlayerDrillStats(playerId);
    const incompleteDrills = coachDrills.filter(
      d => !stats.find(s => s.drillId === d.id)
    );

    if (incompleteDrills.length > 0) {
      return {
        type: "new",
        drill: incompleteDrills[0],
        reason: "Start this new drill to broaden your skills",
      };
    }

    // If all drills started, find one to improve
    const needsImprovement = stats
      .filter(s => s.currentMastery !== "mastered")
      .sort((a, b) => (a.averageScore || 0) - (b.averageScore || 0))[0];

    if (needsImprovement) {
      return {
        type: "improve",
        drillId: needsImprovement.drillId,
        drill: coachDrills.find(d => d.id === needsImprovement.drillId),
        reason: `Improve ${needsImprovement.drillTitle} (currently ${needsImprovement.currentMastery})`,
      };
    }

    return null;
  },

  private getNextGoal(mastery: string): string {
    switch (mastery) {
      case "novice":
        return "Reach 60% score (Intermediate)";
      case "intermediate":
        return "Reach 75% score (Proficient)";
      case "proficient":
        return "Reach 90% score (Mastered)";
      case "mastered":
        return "Maintain mastery";
      default:
        return "Complete this drill";
    }
  },
};
