/**
 * Interview Desk — schema + question bank.
 *
 * This is the REAL data model from the Interview Desk plan (section 05),
 * not a mock. It's being stood up now so the feature can be test-fired and
 * actually clicked through end to end before it's wired into any live
 * Story Engine trigger — see routes/interview-desk.ts's own header for why
 * the test path never touches the real push-notification pipeline.
 *
 * Reworked from a single-question exchange into a real multi-beat
 * conversation after the user tried the first build and said it felt like
 * "a one-off question and a thanks", not an interview — real post-match
 * interviews run opener question → player reacts → interviewer
 * acknowledges + asks a sharper follow-up → player elaborates →
 * interviewer signs off. That's the shape modelled below: each
 * interview_questions row now carries a `kind` (opener / followup /
 * reaction / signoff), and interview_requests tracks both the opener and
 * the follow-up it ends up asking, plus which reaction/signoff line it
 * used (both the resolved text AND the question id, the latter purely so
 * the anti-repeat logic in interviewDeskService.ts has something to
 * exclude), so a reloaded page always reconstructs the exact same
 * transcript rather than re-rolling it.
 *
 * Also added: expires_at + a 'expired' status. A real interview invite is
 * time-boxed — it's only useful if answered before the live segment it
 * feeds into — so a request that sits unanswered past its window closes
 * itself out rather than staying answerable indefinitely.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export type InterviewAudience = "participant" | "spectator";
export type InterviewQuestionKind = "opener" | "followup" | "reaction" | "signoff";

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
  // kind wasn't in the original single-question version of this table —
  // every row from that version is, by definition, an opener.
  await db.execute(sql`ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'opener'`);

  // Content evolves across sessions (this bank's grown twice already) — a
  // natural-key unique index + ON CONFLICT DO NOTHING on seed lets new rows
  // get added later without re-seeding or wiping anything a real deploy
  // already has.
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_questions_natural_key
    ON interview_questions(trigger_type, audience, kind, presenter, prompt_text)
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
  // question_id (kept under its original name) is specifically the OPENER
  // question chosen when the request was created. Everything past that —
  // the follow-up actually asked, and the reaction/sign-off lines actually
  // said — gets picked live as the player moves through the conversation,
  // and is stored here (both text and id) so a page refresh mid-interview
  // always shows the exact same lines rather than re-rolling them, and so
  // the anti-repeat logic can look back at what a player was last given.
  await db.execute(sql`ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS followup_question_id INTEGER REFERENCES interview_questions(id)`);
  await db.execute(sql`ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS reaction_question_id INTEGER REFERENCES interview_questions(id)`);
  await db.execute(sql`ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS reaction_text TEXT`);
  await db.execute(sql`ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS reaction_presenter TEXT`);
  await db.execute(sql`ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS signoff_question_id INTEGER REFERENCES interview_questions(id)`);
  await db.execute(sql`ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS signoff_text TEXT`);
  await db.execute(sql`ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS signoff_presenter TEXT`);
  await db.execute(sql`ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS interview_answers (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES interview_requests(id) ON DELETE CASCADE,
      response_type TEXT NOT NULL,
      answer_text TEXT,
      answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // A real interview has (up to) two answerable turns now — opener and
  // follow-up — so this can no longer be one row per request. Drop the
  // original single-column UNIQUE(request_id) (name unknown — it was
  // auto-generated by the inline `UNIQUE` on the column) if it's still
  // there, then move to a composite UNIQUE(request_id, turn) instead.
  await db.execute(sql`ALTER TABLE interview_answers ADD COLUMN IF NOT EXISTS turn TEXT NOT NULL DEFAULT 'opener'`);
  await db.execute(sql`
    DO $$
    DECLARE cname TEXT;
    BEGIN
      SELECT tc.constraint_name INTO cname
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'interview_answers' AND tc.constraint_type = 'UNIQUE' AND ccu.column_name = 'request_id';
      IF cname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE interview_answers DROP CONSTRAINT %I', cname);
      END IF;
    END $$;
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_answers_request_turn ON interview_answers(request_id, turn)`);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_interview_requests_player ON interview_requests(player_id, created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_interview_questions_lookup ON interview_questions(trigger_type, audience, kind)`);
}

// GENERIC is used for reaction/sign-off lines, which aren't about any one
// trigger type — they're the connective tissue between the two real
// questions, same as a real interviewer's "good stuff" and "cheers, back to
// you" work for any interview regardless of what it was actually about.
const GENERIC = "GENERIC";

const QUESTION_BANK: Array<{
  triggerType: string;
  audience: InterviewAudience;
  kind: InterviewQuestionKind;
  presenter: "chalky" | "ton";
  promptText: string;
}> = [
  // ══════════════════════════ MAJOR_UPSET ══════════════════════════════
  { triggerType: "MAJOR_UPSET", audience: "participant", kind: "opener", presenter: "chalky", promptText: "Walk us through it — what changed tonight?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", kind: "opener", presenter: "ton", promptText: "Be honest — did you see that result coming, or are you as surprised as the rest of us?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", kind: "opener", presenter: "chalky", promptText: "That's a result nobody had on the card. What was the turning point?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", kind: "opener", presenter: "ton", promptText: "Upset of the season contender, that. What's the mindset going into a game like that?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", kind: "opener", presenter: "chalky", promptText: "Take us inside the game — where did it actually swing?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", kind: "opener", presenter: "ton", promptText: "Everyone in the league is talking about this one. What's your side of it?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", kind: "opener", presenter: "chalky", promptText: "On paper that shouldn't have happened. What actually won it for you?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", kind: "opener", presenter: "ton", promptText: "Some people are calling that a fluke. What do you say to that?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", kind: "followup", presenter: "ton", promptText: "What does a win like that do for the group's belief?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", kind: "followup", presenter: "chalky", promptText: "Where does this rank among the results you've been part of?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", kind: "followup", presenter: "ton", promptText: "Does a result like that change how the rest of the league sees you?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", kind: "followup", presenter: "chalky", promptText: "Was there a specific tactic behind it, or did it just click on the night?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", kind: "followup", presenter: "ton", promptText: "Can you back it up next time out, or was tonight a one-off?" },
  { triggerType: "MAJOR_UPSET", audience: "participant", kind: "followup", presenter: "chalky", promptText: "What did the changing room look like after that one?" },

  // ══════════════════════════ WIN_STREAK ═══════════════════════════════
  { triggerType: "WIN_STREAK", audience: "participant", kind: "opener", presenter: "ton", promptText: "That's the streak building nicely. What's clicked for you lately?" },
  { triggerType: "WIN_STREAK", audience: "participant", kind: "opener", presenter: "chalky", promptText: "Consistency like that doesn't happen by accident. What's behind it?" },
  { triggerType: "WIN_STREAK", audience: "participant", kind: "opener", presenter: "ton", promptText: "Who's stopping you at this rate?" },
  { triggerType: "WIN_STREAK", audience: "participant", kind: "opener", presenter: "chalky", promptText: "Take us through the run — any game in there that stood out?" },
  { triggerType: "WIN_STREAK", audience: "participant", kind: "opener", presenter: "ton", promptText: "Are you feeling the pressure yet, or does it just keep getting easier?" },
  { triggerType: "WIN_STREAK", audience: "participant", kind: "opener", presenter: "chalky", promptText: "That's a serious run of form. What's the routine been like behind it?" },
  { triggerType: "WIN_STREAK", audience: "participant", kind: "opener", presenter: "ton", promptText: "Streak like that — are you even thinking about the run, or just game to game?" },
  { triggerType: "WIN_STREAK", audience: "participant", kind: "opener", presenter: "chalky", promptText: "What's different about you right now compared to a month ago?" },
  { triggerType: "WIN_STREAK", audience: "participant", kind: "followup", presenter: "chalky", promptText: "How long do you reckon this run can go?" },
  { triggerType: "WIN_STREAK", audience: "participant", kind: "followup", presenter: "ton", promptText: "Is there added pressure now, or does winning just get easier?" },
  { triggerType: "WIN_STREAK", audience: "participant", kind: "followup", presenter: "chalky", promptText: "Is anyone in the league adjusting how they play you yet?" },
  { triggerType: "WIN_STREAK", audience: "participant", kind: "followup", presenter: "ton", promptText: "Is there a number in your head — a streak you're chasing?" },
  { triggerType: "WIN_STREAK", audience: "participant", kind: "followup", presenter: "chalky", promptText: "What would snap the run, do you think?" },
  { triggerType: "WIN_STREAK", audience: "participant", kind: "followup", presenter: "ton", promptText: "Enjoying it, or is it starting to feel like a target on your back?" },

  // ══════════════════════════ 180_MILESTONE ════════════════════════════
  { triggerType: "180_MILESTONE", audience: "participant", kind: "opener", presenter: "chalky", promptText: "Maximum on the board. What did that throw feel like?" },
  { triggerType: "180_MILESTONE", audience: "participant", kind: "opener", presenter: "ton", promptText: "180! Give us the story behind it." },
  { triggerType: "180_MILESTONE", audience: "participant", kind: "opener", presenter: "chalky", promptText: "That's a big number to hit. Was that one coming, or did it surprise you too?" },
  { triggerType: "180_MILESTONE", audience: "participant", kind: "opener", presenter: "ton", promptText: "Every player wants that moment. How's it feel now you've got it?" },
  { triggerType: "180_MILESTONE", audience: "participant", kind: "opener", presenter: "chalky", promptText: "Talk us through the setup that led into that 180." },
  { triggerType: "180_MILESTONE", audience: "participant", kind: "opener", presenter: "ton", promptText: "The crowd noise on that one — did you hear it, or were you locked in?" },
  { triggerType: "180_MILESTONE", audience: "participant", kind: "opener", presenter: "chalky", promptText: "How many of those have you had this season?" },
  { triggerType: "180_MILESTONE", audience: "participant", kind: "opener", presenter: "ton", promptText: "Best 180 you've ever hit, or does tonight's top the lot?" },
  { triggerType: "180_MILESTONE", audience: "participant", kind: "followup", presenter: "ton", promptText: "Is that one going on the highlight reel?" },
  { triggerType: "180_MILESTONE", audience: "participant", kind: "followup", presenter: "chalky", promptText: "What's the next number you're chasing?" },
  { triggerType: "180_MILESTONE", audience: "participant", kind: "followup", presenter: "ton", promptText: "Do you feel it coming before you throw, or does it just happen?" },
  { triggerType: "180_MILESTONE", audience: "participant", kind: "followup", presenter: "chalky", promptText: "Does hitting one of those change how you approach the rest of the leg?" },
  { triggerType: "180_MILESTONE", audience: "participant", kind: "followup", presenter: "ton", promptText: "Any nerves stepping up after a maximum, or does it settle you?" },
  { triggerType: "180_MILESTONE", audience: "participant", kind: "followup", presenter: "chalky", promptText: "What's the secret — practice, or just a good night?" },

  // ══════════════════════════ CHAMPION ═════════════════════════════════
  { triggerType: "CHAMPION", audience: "participant", kind: "opener", presenter: "ton", promptText: "Season champion. How's that landing right now?" },
  { triggerType: "CHAMPION", audience: "participant", kind: "opener", presenter: "chalky", promptText: "That's the title wrapped up. What got you there this season?" },
  { triggerType: "CHAMPION", audience: "participant", kind: "opener", presenter: "ton", promptText: "Top of the league, nobody above you. What's next?" },
  { triggerType: "CHAMPION", audience: "participant", kind: "opener", presenter: "chalky", promptText: "Looking back over the season, what's the moment that mattered most?" },
  { triggerType: "CHAMPION", audience: "participant", kind: "opener", presenter: "ton", promptText: "Champion — say that back to yourself. How's it feel?" },
  { triggerType: "CHAMPION", audience: "participant", kind: "opener", presenter: "chalky", promptText: "What was the difference between this season and the ones before it?" },
  { triggerType: "CHAMPION", audience: "participant", kind: "opener", presenter: "ton", promptText: "Who do you want to thank, or is this all your own work?" },
  { triggerType: "CHAMPION", audience: "participant", kind: "followup", presenter: "chalky", promptText: "What was the moment you knew it was yours?" },
  { triggerType: "CHAMPION", audience: "participant", kind: "followup", presenter: "ton", promptText: "Any early thoughts on defending it next season?" },
  { triggerType: "CHAMPION", audience: "participant", kind: "followup", presenter: "chalky", promptText: "Did the pressure build as the season went on, or ease off once you were clear?" },
  { triggerType: "CHAMPION", audience: "participant", kind: "followup", presenter: "ton", promptText: "Is there a rival out there you're already thinking about for next season?" },
  { triggerType: "CHAMPION", audience: "participant", kind: "followup", presenter: "chalky", promptText: "What does the trophy actually mean to you?" },
  { triggerType: "CHAMPION", audience: "participant", kind: "followup", presenter: "ton", promptText: "Bigger celebration tonight, or are you already thinking about the next one?" },

  // ══════════════════════════ FORM_REVERSAL ════════════════════════════
  { triggerType: "FORM_REVERSAL", audience: "participant", kind: "opener", presenter: "ton", promptText: "Big turnaround in form. What flipped it?" },
  { triggerType: "FORM_REVERSAL", audience: "participant", kind: "opener", presenter: "chalky", promptText: "That's a real shift from where you were a few weeks back. What changed?" },
  { triggerType: "FORM_REVERSAL", audience: "participant", kind: "opener", presenter: "ton", promptText: "From rough patch to this — talk us through it." },
  { triggerType: "FORM_REVERSAL", audience: "participant", kind: "opener", presenter: "chalky", promptText: "Was there a specific moment that turned things around, or has it been building?" },
  { triggerType: "FORM_REVERSAL", audience: "participant", kind: "opener", presenter: "ton", promptText: "A few weeks ago people were writing you off. What do you say now?" },
  { triggerType: "FORM_REVERSAL", audience: "participant", kind: "opener", presenter: "chalky", promptText: "What was the low point, and how did you pull out of it?" },
  { triggerType: "FORM_REVERSAL", audience: "participant", kind: "opener", presenter: "ton", promptText: "Did you change anything, or did it just turn around on its own?" },
  { triggerType: "FORM_REVERSAL", audience: "participant", kind: "followup", presenter: "chalky", promptText: "Was there a specific conversation or change that sparked it?" },
  { triggerType: "FORM_REVERSAL", audience: "participant", kind: "followup", presenter: "ton", promptText: "Can this form carry all the way to the end of the season?" },
  { triggerType: "FORM_REVERSAL", audience: "participant", kind: "followup", presenter: "chalky", promptText: "Did anyone help you through the rough patch?" },
  { triggerType: "FORM_REVERSAL", audience: "participant", kind: "followup", presenter: "ton", promptText: "Do you look back at the bad run differently now?" },
  { triggerType: "FORM_REVERSAL", audience: "participant", kind: "followup", presenter: "chalky", promptText: "What's the one thing you'd tell yourself a few weeks ago?" },
  { triggerType: "FORM_REVERSAL", audience: "participant", kind: "followup", presenter: "ton", promptText: "Is the confidence all the way back, or still building?" },

  // ══════════════════════════ SHIFT_DOMINANCE ══════════════════════════
  { triggerType: "SHIFT_DOMINANCE", audience: "participant", kind: "opener", presenter: "chalky", promptText: "That was a dominant shift result. What worked so well tonight?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "participant", kind: "opener", presenter: "ton", promptText: "Your team ran away with that one — what was the difference?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "participant", kind: "opener", presenter: "chalky", promptText: "That scoreline doesn't happen by accident. Walk us through it." },
  { triggerType: "SHIFT_DOMINANCE", audience: "participant", kind: "opener", presenter: "ton", promptText: "Did you know early on that was going to be one-sided?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "participant", kind: "opener", presenter: "chalky", promptText: "What was the game plan going in, and did it hold up?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "participant", kind: "opener", presenter: "ton", promptText: "Performance like that — where does it rank for the shift this season?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "spectator", kind: "opener", presenter: "chalky", promptText: "Big night for the team — even from the sidelines, what stood out to you?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "spectator", kind: "opener", presenter: "ton", promptText: "Didn't get a leg tonight, but that's a team result. Anything to add?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "spectator", kind: "opener", presenter: "chalky", promptText: "Good result for the shift overall — any reaction from the bench?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "spectator", kind: "opener", presenter: "ton", promptText: "Wasn't your night to play, but it clearly worked out. Thoughts?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "spectator", kind: "opener", presenter: "chalky", promptText: "What did it look like from where you were sitting?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "spectator", kind: "opener", presenter: "ton", promptText: "Any wind-ups for the lads who did play, or just pure pride watching that?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "participant", kind: "followup", presenter: "chalky", promptText: "What was the difference as a team tonight?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "participant", kind: "followup", presenter: "ton", promptText: "Can the shift keep this level up?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "participant", kind: "followup", presenter: "chalky", promptText: "Is there one performance from tonight that stood out to you?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "participant", kind: "followup", presenter: "ton", promptText: "How's morale on the shift after a night like that?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "participant", kind: "followup", presenter: "chalky", promptText: "Does a result like that change the target for the rest of the season?" },
  { triggerType: "SHIFT_DOMINANCE", audience: "participant", kind: "followup", presenter: "ton", promptText: "Anything the shift needs to work on, even after a night like that?" },

  // ══════════════════ Generic reactions (after the opener answer) ═════
  { triggerType: GENERIC, audience: "participant", kind: "reaction", presenter: "chalky", promptText: "Good to hear it." },
  { triggerType: GENERIC, audience: "participant", kind: "reaction", presenter: "chalky", promptText: "Fair enough — let's dig a bit deeper." },
  { triggerType: GENERIC, audience: "participant", kind: "reaction", presenter: "chalky", promptText: "That tracks with what we saw out there." },
  { triggerType: GENERIC, audience: "participant", kind: "reaction", presenter: "chalky", promptText: "Interesting take." },
  { triggerType: GENERIC, audience: "participant", kind: "reaction", presenter: "chalky", promptText: "That's about what I expected you to say." },
  { triggerType: GENERIC, audience: "participant", kind: "reaction", presenter: "chalky", promptText: "Noted — let's push on a bit." },
  { triggerType: GENERIC, audience: "participant", kind: "reaction", presenter: "chalky", promptText: "Appreciate you being straight with us." },
  { triggerType: GENERIC, audience: "participant", kind: "reaction", presenter: "ton", promptText: "Love that honesty." },
  { triggerType: GENERIC, audience: "participant", kind: "reaction", presenter: "ton", promptText: "Can't argue with that." },
  { triggerType: GENERIC, audience: "participant", kind: "reaction", presenter: "ton", promptText: "Ha — I like it. One more for you." },
  { triggerType: GENERIC, audience: "participant", kind: "reaction", presenter: "ton", promptText: "Knew you'd say that." },
  { triggerType: GENERIC, audience: "participant", kind: "reaction", presenter: "ton", promptText: "Straight down the line, no messing about." },
  { triggerType: GENERIC, audience: "participant", kind: "reaction", presenter: "ton", promptText: "See, that's exactly why people like watching you." },
  { triggerType: GENERIC, audience: "participant", kind: "reaction", presenter: "ton", promptText: "Good answer. Let's go again." },

  // ══════════════════ Generic sign-offs (closes the interview) ════════
  { triggerType: GENERIC, audience: "participant", kind: "signoff", presenter: "chalky", promptText: "Great stuff — thanks for that, back to you at the desk." },
  { triggerType: GENERIC, audience: "participant", kind: "signoff", presenter: "chalky", promptText: "Appreciate you taking the time — that's all from us." },
  { triggerType: GENERIC, audience: "participant", kind: "signoff", presenter: "chalky", promptText: "That'll do us nicely — thanks for stopping by." },
  { triggerType: GENERIC, audience: "participant", kind: "signoff", presenter: "chalky", promptText: "Good insight, as always. Cheers." },
  { triggerType: GENERIC, audience: "participant", kind: "signoff", presenter: "chalky", promptText: "Thanks for the time — back to the studio." },
  { triggerType: GENERIC, audience: "participant", kind: "signoff", presenter: "ton", promptText: "Nice one, cheers for that." },
  { triggerType: GENERIC, audience: "participant", kind: "signoff", presenter: "ton", promptText: "Good chat — we'll let you get on." },
  { triggerType: GENERIC, audience: "participant", kind: "signoff", presenter: "ton", promptText: "Love it. That's us done — go get a pint." },
  { triggerType: GENERIC, audience: "participant", kind: "signoff", presenter: "ton", promptText: "Smashing stuff. We'll catch you again soon." },
  { triggerType: GENERIC, audience: "participant", kind: "signoff", presenter: "ton", promptText: "Cheers for that, back to you at home." },
];

export async function seedInterviewQuestionBank() {
  for (const q of QUESTION_BANK) {
    await db.execute(sql`
      INSERT INTO interview_questions (trigger_type, audience, kind, presenter, prompt_text)
      VALUES (${q.triggerType}, ${q.audience}, ${q.kind}, ${q.presenter}, ${q.promptText})
      ON CONFLICT (trigger_type, audience, kind, presenter, prompt_text) DO NOTHING
    `);
  }
  logger.info({ count: QUESTION_BANK.length }, "Interview Desk question bank seeded/verified");
}
