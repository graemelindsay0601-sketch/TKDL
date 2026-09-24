/**
 * Interview Desk — schema + question bank.
 *
 * This is the REAL data model from the Interview Desk plan (section 05),
 * not a mock. It's being stood up now so the feature can be test-fired and
 * actually clicked through end to end before it's wired into any live
 * Story Engine trigger — see routes/interview-desk.ts's own header for why
 * the test path never touches the real push-notification pipeline.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export type InterviewAudience = "participant" | "spectator";

export async function initializeInterviewDeskTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS interview_questions (
      id SERIAL PRIMARY KEY,
      trigger_type TEXT NOT NULL,
      audience TEXT NOT NULL DEFAULT 'participant',
      presenter TEXT NOT NULL,
      prompt_text TEXT NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS interview_requests (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      trigger_type TEXT NOT NULL,
      trigger_context JSONB NOT NULL DEFAULT '{}'::jsonb,
      question_id INTEGER REFERENCES interview_questions(id),
      status TEXT NOT NULL DEFAULT 'pending',
      is_test BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS interview_answers (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL UNIQUE REFERENCES interview_requests(id) ON DELETE CASCADE,
      response_type TEXT NOT NULL,
      answer_text TEXT,
      answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // is_test lets the admin test-fire panel's own history be told apart from
  // (eventually) real Story-Engine-triggered requests, without needing a
  // second table. Added defensively via ALTER for anyone who already has
  // this table from a partial earlier run of this same migration.
  await db.execute(sql`ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false`);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_interview_requests_player ON interview_requests(player_id, created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_interview_questions_lookup ON interview_questions(trigger_type, audience)`);
}

// The exact 6-trigger-type bank drafted in the plan artifact (section 06),
// ported here verbatim rather than re-written, so what the user previews
// is the same copy they already reviewed and approved the direction of.
const QUESTION_BANK: Array<{
  triggerType: string;
  audience: InterviewAudience;
  presenter: "chalky" | "ton";
  promptText: string;
}> = [
  // MAJOR_UPSET
  { triggerType: "MAJOR_UPSET", audience: "participant", presenter: "chalky", promptText: "Walk us through it — what changed tonight?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", presenter: "ton", promptText: "Be honest — did you see that result coming, or are you as surprised as the rest of us?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", presenter: "chalky", promptText: "That's a result nobody had on the card. What was the turning point?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", presenter: "ton", promptText: "Upset of the season contender, that. What's the mindset going into a game like that?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", presenter: "chalky", promptText: "Take us inside the game — where did it actually swing?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", presenter: "ton", promptText: "Everyone in the league is talking about this one. What's your side of it?" },

  // WIN_STREAK
  { triggerType: "WIN_STREAK", audience: "participant", presenter: "ton", promptText: "That's the streak building nicely. What's clicked for you lately?" },
  { triggerType: "WIN_STREAK", audience: "participant", presenter: "chalky", promptText: "Consistency like that doesn't happen by accident. What's behind it?" },
  { triggerType: "WIN_STREAK", audience: "participant", presenter: "ton", promptText: "Who's stopping you at this rate?" },
  { triggerType: "WIN_STREAK", audience: "participant", presenter: "chalky", promptText: "Take us through the run — any game in there that stood out?" },
  { triggerType: "WIN_STREAK", audience: "participant", presenter: "ton", promptText: "Are you feeling the pressure yet, or does it just keep getting easier?" },

  // 180_MILESTONE
  { triggerType: "180_MILESTONE", audience: "participant", presenter: "chalky", promptText: "Maximum on the board. What did that throw feel like?" },
  { triggerType: "180_MILESTONE", audience: "participant", presenter: "ton", promptText: "180! Give us the story behind it." },
  { triggerType: "180_MILESTONE", audience: "participant", presenter: "chalky", promptText: "That's a big number to hit. Was that one coming, or did it surprise you too?" },
  { triggerType: "180_MILESTONE", audience: "participant", presenter: "ton", promptText: "Every player wants that moment. How's it feel now you've got it?" },
  { triggerType: "180_MILESTONE", audience: "participant", presenter: "chalky", promptText: "Talk us through the setup that led into that 180." },

  // CHAMPION
  { triggerType: "CHAMPION", audience: "participant", presenter: "ton", promptText: "Season champion. How's that landing right now?" },
  { triggerType: "CHAMPION", audience: "participant", presenter: "chalky", promptText: "That's the title wrapped up. What got you there this season?" },
  { triggerType: "CHAMPION", audience: "participant", presenter: "ton", promptText: "Top of the league, nobody above you. What's next?" },
  { triggerType: "CHAMPION", audience: "participant", presenter: "chalky", promptText: "Looking back over the season, what's the moment that mattered most?" },

  // FORM_REVERSAL
  { triggerType: "FORM_REVERSAL", audience: "participant", presenter: "ton", promptText: "Big turnaround in form. What flipped it?" },
  { triggerType: "FORM_REVERSAL", audience: "participant", presenter: "chalky", promptText: "That's a real shift from where you were a few weeks back. What changed?" },
  { triggerType: "FORM_REVERSAL", audience: "participant", presenter: "ton", promptText: "From rough patch to this — talk us through it." },
  { triggerType: "FORM_REVERSAL", audience: "participant", presenter: "chalky", promptText: "Was there a specific moment that turned things around, or has it been building?" },

  // SHIFT_DOMINANCE — participant side (played and it went big)
  { triggerType: "SHIFT_DOMINANCE", audience: "participant", presenter: "chalky", promptText: "That was a dominant shift result. What worked so well tonight?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "participant", presenter: "ton", promptText: "Your team ran away with that one — what was the difference?" },

  // SHIFT_DOMINANCE — spectator/fan-out side ("didn't play" lighter version)
  { triggerType: "SHIFT_DOMINANCE", audience: "spectator", presenter: "chalky", promptText: "Big night for the team — even from the sidelines, what stood out to you?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "spectator", presenter: "ton", promptText: "Didn't get a leg tonight, but that's a team result. Anything to add?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "spectator", presenter: "chalky", promptText: "Good result for the shift overall — any reaction from the bench?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "spectator", presenter: "ton", promptText: "Wasn't your night to play, but it clearly worked out. Thoughts?" },
];

export async function seedInterviewQuestionBank() {
  const { rows } = await db.execute(sql`SELECT COUNT(*)::int AS n FROM interview_questions`);
  const existing = (rows[0] as any)?.n ?? 0;
  if (existing > 0) {
    return; // already seeded — this is content, not a migration; don't clobber if it's ever hand-edited later
  }
  for (const q of QUESTION_BANK) {
    await db.execute(sql`
      INSERT INTO interview_questions (trigger_type, audience, presenter, prompt_text)
      VALUES (${q.triggerType}, ${q.audience}, ${q.presenter}, ${q.promptText})
    `);
  }
  logger.info({ count: QUESTION_BANK.length }, "Seeded interview_questions bank");
}
