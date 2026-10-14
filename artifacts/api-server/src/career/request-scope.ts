import { AsyncLocalStorage } from "node:async_hooks";
import type { RequestHandler } from "express";
import type { CareerDatabase } from "./database.ts";

/**
 * Career read concurrency. Every Career request locks its save root (lockRoot). Writes keep the
 * exclusive FOR UPDATE lock; GET requests take FOR SHARE, so the dozen reads a Career screen issues
 * at once run side by side instead of queueing behind each other (they still wait for any write, and
 * writes still wait for them, so a read never sees a half-applied advance).
 *
 * Reads may run idempotent upkeep (status catch-up UPDATEs, ON CONFLICT DO NOTHING inserts); two
 * concurrent reads doing the same upkeep can rarely deadlock or race, so read transactions retry.
 */
const scope = new AsyncLocalStorage<{ read: boolean }>();

export const careerRequestScope: RequestHandler = (req, _res, next) =>
  scope.run({ read: req.method === "GET" || req.method === "HEAD" }, next);

export const isCareerRead = () => scope.getStore()?.read === true;

const RETRYABLE = new Set(["40P01", "40001", "23505"]);
const codeOf = (error: unknown): string | undefined => {
  for (let e = error as { code?: unknown; cause?: unknown } | undefined, depth = 0; e && depth < 4; e = e.cause as typeof e, depth++)
    if (typeof e.code === "string") return e.code;
  return undefined;
};

export function readRetryingCareerDatabase(database: CareerDatabase): CareerDatabase {
  return {
    execute: query => database.execute(query),
    async transaction(work) {
      for (let attempt = 1; ; attempt++) {
        try { return await database.transaction(work); }
        catch (error) {
          if (!isCareerRead() || attempt >= 3 || !RETRYABLE.has(codeOf(error) ?? "")) throw error;
        }
      }
    },
  };
}
