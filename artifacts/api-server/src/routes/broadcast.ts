import { Router } from "express";
import { getFeatureStatus, FEATURES } from "../services/feature-flags-service";

/**
 * TKDL LIVE — the automated broadcast "show" feature.
 *
 * This is a beta feature gated behind the tkdl_live flag using the same
 * enabled/adminTestMode pattern as card_shop/coins/card_clash: while
 * adminTestMode is on and the flag isn't yet enabled for everyone, only an
 * admin session sees it "available" — regular players get `available: false`
 * and the frontend shows a coming-soon placeholder instead. Once an admin
 * flips it live (POST /admin/feature-flags/tkdl_live/enable-all, via the
 * existing generic admin panel), everyone sees `available: true`.
 *
 * isAdmin comes from req.session.isAdmin (set at login in routes/auth.ts,
 * the same real session flag requireAdminSession.ts checks) — NOT from
 * req.user, which is never actually populated anywhere in this codebase
 * (see the now-dead isAdmin check in card-clash.ts's /feature-status route).
 */

const router = Router();

router.get("/broadcast/status", async (req, res): Promise<void> => {
  const isAdmin = (req.session as any)?.isAdmin === true;
  const status = await getFeatureStatus(FEATURES.TKDL_LIVE, isAdmin);
  res.json(status);
});

export default router;
