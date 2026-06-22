import { db } from "@workspace/db";
import { sql as drizzleSql } from "drizzle-orm";

export interface MatchAnalysis {
  matchId: number;
  playerId: number;
  won: boolean;
  opponent: {
    name: string;
    playerId: number;
    tier: string;
  };
  playerStats: {
    darts: number;
    checkout: number;
    checkoutAttempts: number;
    checkoutRate: number;
    _180s: number;
    eloChange: number;
  };
  opponentStats: {
    darts: number;
    checkout: number;
    checkoutAttempts: number;
    checkoutRate: number;
    _180s: number;
  };
  keyInsights: {
    strength: string;
    weakness: string;
    recommendation: string;
  };
  comparisonToYourAverage: {
    metric: string;
    yours: number;
    average: number;
    difference: number; // percentage
  }[];
}

export const postMatchAnalysisService = {
  // Analyze a completed match
  async analyzeMatch(matchId: number, playerId: number): Promise<MatchAnalysis> {
    // Get match details
    const matchResult = await db.execute(drizzleSql`
      SELECT * FROM matches WHERE id = ${matchId}
    `);

    const match = (matchResult.rows[0] as any);
    if (!match) throw new Error("Match not found");

    const won = match.winner_id === playerId;
    const opponentId = won ? match.loser_id : match.winner_id;

    // Get player average stats
    const playerAvgResult = await db.execute(drizzleSql`
      SELECT 
        AVG(CASE WHEN winner_id = ${playerId} THEN winner_darts ELSE loser_darts END)::numeric as avg_darts,
        AVG(CASE WHEN winner_id = ${playerId} 
          THEN (winner_checkout_hits::float / NULLIF(winner_checkout_attempts, 0))
          ELSE (loser_checkout_hits::float / NULLIF(loser_checkout_attempts, 0)) 
        END)::numeric as avg_checkout_rate
      FROM matches
      WHERE winner_id = ${playerId} OR loser_id = ${playerId}
    `);

    const playerAvg = (playerAvgResult.rows[0] as any);

    // Get opponent info
    const opponentResult = await db.execute(drizzleSql`
      SELECT id, name FROM players WHERE id = ${opponentId}
    `);
    const opponent = (opponentResult.rows[0] as any);

    const playerDarts = won ? match.winner_darts : match.loser_darts;
    const playerCheckouts = won ? match.winner_checkout_hits : match.loser_checkout_hits;
    const playerCheckoutAttempts = won ? match.winner_checkout_attempts : match.loser_checkout_attempts;
    const playerCheckoutRate = playerCheckoutAttempts > 0 
      ? (playerCheckouts / playerCheckoutAttempts) 
      : 0;
    const player180s = won ? match.winner_180s : match.loser_180s;

    const opponentDarts = won ? match.loser_darts : match.winner_darts;
    const opponentCheckouts = won ? match.loser_checkout_hits : match.winner_checkout_hits;
    const opponentCheckoutAttempts = won ? match.loser_checkout_attempts : match.winner_checkout_attempts;
    const opponentCheckoutRate = opponentCheckoutAttempts > 0
      ? (opponentCheckouts / opponentCheckoutAttempts)
      : 0;
    const opponent180s = won ? match.loser_180s : match.winner_180s;

    // Generate insights
    const insights = this.generateInsights(
      playerDarts,
      playerCheckoutRate,
      player180s,
      opponentDarts,
      opponentCheckoutRate,
      won
    );

    // Calculate comparison to player's average
    const dartsComparison = playerAvg.avg_darts 
      ? ((playerDarts - parseFloat(playerAvg.avg_darts)) / parseFloat(playerAvg.avg_darts)) * 100
      : 0;

    const checkoutComparison = playerAvg.avg_checkout_rate
      ? ((playerCheckoutRate - parseFloat(playerAvg.avg_checkout_rate)) / parseFloat(playerAvg.avg_checkout_rate)) * 100
      : 0;

    return {
      matchId,
      playerId,
      won,
      opponent: {
        name: opponent.name,
        playerId: opponentId,
        tier: this.estimateTier(opponentCheckoutRate),
      },
      playerStats: {
        darts: playerDarts,
        checkout: playerCheckouts,
        checkoutAttempts: playerCheckoutAttempts,
        checkoutRate: playerCheckoutRate,
        _180s: player180s,
        eloChange: match.elo_change,
      },
      opponentStats: {
        darts: opponentDarts,
        checkout: opponentCheckouts,
        checkoutAttempts: opponentCheckoutAttempts,
        checkoutRate: opponentCheckoutRate,
        _180s: opponent180s,
      },
      keyInsights: insights,
      comparisonToYourAverage: [
        {
          metric: "Darts Used",
          yours: playerDarts,
          average: Math.round(parseFloat(playerAvg.avg_darts || "0")),
          difference: dartsComparison,
        },
        {
          metric: "Checkout Rate",
          yours: Math.round(playerCheckoutRate * 100),
          average: Math.round((parseFloat(playerAvg.avg_checkout_rate || "0") * 100)),
          difference: checkoutComparison,
        },
        {
          metric: "180s Scored",
          yours: player180s,
          average: 1, // placeholder
          difference: 0,
        },
      ],
    };
  },

  private generateInsights(
    playerDarts: number,
    playerCheckout: number,
    player180s: number,
    opponentDarts: number,
    opponentCheckout: number,
    won: boolean
  ) {
    let strength = "";
    let weakness = "";
    let recommendation = "";

    if (won) {
      if (playerDarts < opponentDarts) {
        strength = "You finished faster — efficient scoring in your opening phase";
      } else if (playerCheckout > opponentCheckout) {
        strength = "Superior double accuracy — you closed out legs when it mattered";
      } else if (player180s > opponentDarts * 0.1) {
        strength = "Strong scoring pressure — your 180s kept the pace high";
      } else {
        strength = "Consistent performance across both scoring and finishing";
      }

      if (playerCheckout < 0.4) {
        weakness = "Lower checkout rate than opponent — closing became tight";
      } else if (playerDarts > opponentDarts * 1.2) {
        weakness = "Slower opening — took longer to establish lead";
      } else {
        weakness = "No major weakness in this match";
      }

      recommendation = playerCheckout > 0.6
        ? "Maintain this checkout form in practice — you're in peak condition"
        : "Drill checkouts this week to lock in this winning form";
    } else {
      if (playerDarts > opponentDarts) {
        weakness = "Slower opening — you were chasing from start";
      } else if (playerCheckout < opponentCheckout) {
        weakness = "Checkout pressure cost you — you need Double Assassin drill";
      } else {
        weakness = "Opponent played more consistently throughout";
      }

      if (playerCheckout > opponentCheckout) {
        strength = "Your doubles were more accurate — finish was strong";
      } else if (player180s > 0) {
        strength = "You scored some high visits — building blocks were there";
      } else {
        strength = "Mental resilience — stayed composed despite the loss";
      }

      recommendation = playerCheckout < 0.35
        ? "Priority: Double Assassin drill (2 sessions this week)"
        : "Work on first-9 consistency to control the opening";
    }

    return {
      strength,
      weakness,
      recommendation,
    };
  },

  private estimateTier(checkoutRate: number): string {
    if (checkoutRate >= 0.65) return "Legend";
    if (checkoutRate >= 0.55) return "Elite";
    if (checkoutRate >= 0.45) return "Pro";
    if (checkoutRate >= 0.35) return "Challenger";
    return "Rising";
  },

  // Get recommendation based on match outcome
  async getPostMatchDrillRecommendation(
    analysis: MatchAnalysis,
    coachDrills: any[]
  ): Promise<{
    drill: any;
    priority: "critical" | "high" | "normal";
    reasoning: string;
  } | null> {
    const { won, playerStats } = analysis;

    // If lost, prioritize checkout if weak
    if (!won && playerStats.checkoutRate < 0.4) {
      const doubleDrill = coachDrills.find(d => d.id === "doubles");
      return {
        drill: doubleDrill,
        priority: "critical",
        reasoning: "Your 28% checkout cost you this match. Double Assassin drill recommended.",
      };
    }

    // If won with strong checkouts, suggest maintenance
    if (won && playerStats.checkoutRate > 0.65) {
      return {
        drill: null,
        priority: "normal",
        reasoning: "Excellent checkout form — maintain with regular practice",
      };
    }

    // If won with weak scoring, suggest improvement
    if (won && playerStats.darts > 60) {
      const scoreDrill = coachDrills.find(d => d.id === "scoring");
      return {
        drill: scoreDrill,
        priority: "high",
        reasoning: "You won despite slower opening — Score Chaser drill to accelerate starts",
      };
    }

    return null;
  },
};
