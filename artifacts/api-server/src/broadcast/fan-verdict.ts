import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { ProgrammeSegment } from "./director-math.ts";
import { buildFanVerdictSegment, type FanVerdictOption, type FanVerdictReaction } from "./fan-verdict-math.ts";

type PollRow = {
  id: number;
  question: string;
  activity_at: Date | string;
};

type CommentRow = {
  player_name: string;
  content: string;
};

/** Latest poll whose voting activity belongs to this Edition window and
 * has at least two votes. A poll airs once; the result is frozen with the
 * Edition, so later re-votes do not make different viewers see different
 * figures halfway through the same programme. */
export async function collectFanVerdictSegments(cutoffStart: Date, cutoffEnd: Date): Promise<ProgrammeSegment[]> {
  const poll = (await db.execute(sql`
    SELECT cp.id, cp.content AS question,
           GREATEST(cp.created_at, MAX(pv.created_at)) AS activity_at
    FROM community_posts cp
    JOIN community_poll_votes pv ON pv.post_id = cp.id
    WHERE cp.post_type = 'poll'
      AND cp.status = 'approved'
      AND cp.created_at <= ${cutoffEnd}
      AND NOT EXISTS (
        SELECT 1
        FROM broadcast_editions e
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.programme->'segments', '[]'::jsonb)) AS aired(segment)
        WHERE e.status = 'PUBLISHED'
          AND aired.segment->'facts'->>'pollId' = cp.id::text
      )
    GROUP BY cp.id, cp.content, cp.created_at
    HAVING COUNT(pv.id) >= 2
       AND GREATEST(cp.created_at, MAX(pv.created_at)) > ${cutoffStart}
       AND GREATEST(cp.created_at, MAX(pv.created_at)) <= ${cutoffEnd}
    ORDER BY activity_at DESC, cp.id DESC
    LIMIT 1
  `)).rows[0] as PollRow | undefined;

  if (!poll) return [];

  const options = (await db.execute(sql`
    SELECT po.id, po.label, COUNT(pv.id)::int AS votes
    FROM community_poll_options po
    LEFT JOIN community_poll_votes pv ON pv.option_id = po.id
    WHERE po.post_id = ${poll.id}
    GROUP BY po.id, po.label, po.sort_order
    ORDER BY po.sort_order ASC, po.id ASC
  `)).rows as FanVerdictOption[];

  // Real, already-public reactions on this exact poll's own community post —
  // same visibility the comment already has in the app today, just surfaced
  // again on air. post_comments has no profanity filter and no per-comment
  // approval (unlike community_posts itself, gated above by status =
  // 'approved'), so this is the one broadcast fact source that is raw player
  // free text rather than a verified numeric/named fact. The minimum-length
  // filter below is a basic quality gate, not a safety one — it only keeps
  // out one- or two-word noise, so keep the list short (earliest, substantive
  // comments only) and never widen this query to pull more without adding
  // real moderation first.
  const comments = (await db.execute(sql`
    SELECT pl.name AS player_name, pc.content
    FROM post_comments pc
    JOIN players pl ON pl.id = pc.player_id
    WHERE pc.post_id = ${poll.id}
      AND char_length(trim(pc.content)) >= 15
    ORDER BY pc.created_at ASC
    LIMIT 3
  `)).rows as CommentRow[];

  const reactions: FanVerdictReaction[] = comments.map(row => ({
    playerName: row.player_name,
    text: row.content,
  }));

  return [buildFanVerdictSegment({
    pollId: poll.id,
    question: poll.question,
    activityAt: new Date(poll.activity_at),
    options,
    reactions,
  })];
}
