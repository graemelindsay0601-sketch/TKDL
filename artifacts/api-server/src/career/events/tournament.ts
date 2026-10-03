import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerExecutor } from "../database.ts";
import type { CareerActor } from "../world/service.ts";
import { CareerError } from "../service.ts";
import { HUMAN, type StoredEvent } from "./types.ts";
import { saveEvent, worldIn, type Root } from "./repository.ts";
import { capability } from "./capability.ts";
import { matchOperationKey, populateRound, resultFromDraw } from "./draw.ts";

export const liveReceiptSchema = z.object({ matchId: z.string(), receiptId: z.string().min(1).max(120), score: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]) }).strict();
export type LiveReceipt = z.infer<typeof liveReceiptSchema>;
async function complete(tx: CareerExecutor, root: Root, event: StoredEvent) {
  event.result = resultFromDraw(event.draw!);
  const route = event.definition.qualification;
  if (route && event.definition.classification !== "SPECIAL") event.result.qualificationRecipients = event.result.finishes.filter(f => f.position <= route.top).map(f => f.participant);
  event.status = "COMPLETED";
  await saveEvent(tx, root.id, event);
  for (const finish of event.result.finishes) await tx.execute(sql`UPDATE career_event_entries SET status=${finish.position === 1 ? "CHAMPION" : "ELIMINATED"}
    WHERE career_save_id=${root.id} AND event_id=${event.id} AND participant_key=${finish.participant}`);
  if (route) {
    let targetId: string | null = null;
    const row = (await tx.execute(sql`SELECT id FROM career_events WHERE career_save_id=${root.id} AND season=${event.season}
      AND ${route.targetKind === "EVENT" ? sql`snapshot->'definition'->>'key'=${route.targetKey}` : sql`snapshot->'definition'->>'family'=${route.targetKey}`}
      AND start_day>${event.endDay} ORDER BY start_day,id LIMIT 1`)).rows[0];
    if (!row) throw new CareerError(409, "Qualification target missing");
    if (route.targetKind === "EVENT") targetId = String(row.id);
    for (const key of event.result.qualificationRecipients) await tx.execute(sql`INSERT INTO career_event_entitlements(career_save_id,source_event_id,participant_key,target_key,target_kind,target_event_id,season)
      VALUES(${root.id},${event.id},${key},${route.targetKey},${route.targetKind},${targetId},${event.season}) ON CONFLICT DO NOTHING`);
  }
}
/** A trusted future live-scoring adapter supplies validated scores; never a public arbitrary winner endpoint. */
export async function progressTournament(tx: CareerExecutor, actor: CareerActor, root: Root, event: StoredEvent, day: number, receipt?: LiveReceipt) {
  const support = capability(event.definition.format);
  if (support.status !== "SUPPORTED") return support;
  if (receipt) liveReceiptSchema.parse(receipt);
  if (!event.draw) throw new CareerError(409, "Draw must be locked first");
  if (receipt) {
    const existing = event.draw.rounds.flat().find(m => m.id === receipt.matchId);
    if (existing?.receipt) {
      if (existing.receipt !== receipt.receiptId || JSON.stringify(existing.score) !== JSON.stringify(receipt.score)) throw new CareerError(409, "Conflicting live result retry");
      return { status: "PROGRESSED" as const, event };
    }
    if (event.status === "COMPLETED") throw new CareerError(409, "Completed result is immutable");
  }
  if (event.status === "COMPLETED") return { status: "PROGRESSED" as const, event };
  if (event.season !== root.current_season || day < event.startDay || day > event.endDay) throw new CareerError(409, "Event is outside its competition window");
  event.status = "IN_PROGRESS";
  let receiptUsed = false;
  for (let r = 0; r < event.draw.rounds.length; r++) {
    populateRound(event.draw, r);
    for (const match of event.draw.rounds[r]) {
      if (match.winner) continue;
      if (!match.a || !match.b) {
        if (r !== 0) continue;
        match.winner = match.a ?? match.b; match.source = "BYE"; continue;
      }
      if (match.a === HUMAN || match.b === HUMAN) {
        if (!receipt || match.id !== receipt.matchId) continue;
        const required = (event.definition.format.bestOfLegs + 1) / 2;
        const [a, b] = receipt.score;
        if (!((a === required && b < required) || (b === required && a < required))) throw new CareerError(409, "Invalid live match score");
        match.score = receipt.score; match.winner = a > b ? match.a : match.b; match.loser = a > b ? match.b : match.a;
        match.source = "LIVE"; match.receipt = receipt.receiptId; receiptUsed = true;
      } else {
        match.a2Key = matchOperationKey(event.season, event.id, match.id);
        const result = await worldIn(tx).simulateMatch(actor, root.id, { matchKey: match.a2Key, playerAId: match.a, playerBId: match.b,
          context: { category: event.definition.prestige >= 85 ? "major" : event.definition.classification === "QUALIFIER" ? "qualifier" : event.definition.prestige < 35 ? "local" : "floor", roundImportance: (r + 1) / event.draw.rounds.length, elimination: true },
          format: { bestOf: event.definition.format.bestOfLegs, firstThrow: match.firstThrow } });
        match.winner = result.winnerId; match.loser = result.loserId; match.source = "A2"; match.score = [result.stats[0].legsWon, result.stats[1].legsWon];
      }
      if (match.loser) await tx.execute(sql`UPDATE career_event_entries SET status='ELIMINATED' WHERE career_save_id=${root.id} AND event_id=${event.id} AND participant_key=${match.loser}`);
    }
    if (event.draw.rounds[r].some(m => !m.winner)) break;
  }
  if (receipt && !receiptUsed) throw new CareerError(409, "Live receipt is not for a ready human match");
  if (event.draw.rounds.at(-1)![0].winner) await complete(tx, root, event);
  else await saveEvent(tx, root.id, event);
  return { status: "PROGRESSED" as const, event };
}
