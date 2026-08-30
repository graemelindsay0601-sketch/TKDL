/**
 * The one and only admin gate for the whole app.
 *
 * Previously, several route files each had their own copy of an "admin PIN"
 * check that accepted a raw PIN sent with every single request (as an
 * X-Admin-Pin header or an `adminPin` field in the body), with no rate
 * limiting and a hardcoded fallback PIN if ADMIN_PIN wasn't set in the
 * environment. Some of those routes were reachable from pages any logged-in
 * player can open (not just the PIN-gated /admin page), so a player who
 * guessed or viewed the default PIN in the shipped frontend bundle could
 * hit them directly.
 *
 * The real PIN check now lives in exactly one place: POST /admin/verify-pin
 * in routes/admin.ts, which is rate-limited and sets req.session.isAdmin
 * on success. Every other admin-only route — across every file — should
 * use THIS middleware, which only trusts that session flag. There is no PIN
 * fallback here on purpose: if you're not verified, you're not an admin.
 */
import type { Request, Response, NextFunction } from "express";

export function requireAdminSession(req: Request, res: Response, next: NextFunction): void {
  if (!(req.session as any)?.isAdmin) {
    res.status(403).json({ error: "Admin access required — verify the admin PIN first" });
    return;
  }
  next();
}
