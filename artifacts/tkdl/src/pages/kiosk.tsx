// ── /kiosk — retired, redirects to the Standings Board ─────────────────────
// This used to be its own full-screen venue-display page, but it turned out
// to duplicate /broadcast almost exactly: same full-bleed no-nav layout,
// same GET /leaderboard + GET /matches data, same 30s auto-refresh. Once
// /broadcast got its own visual redesign (featured-player rotation, results
// ticker, title-race callout, upset badges) it was strictly the better of
// the two, so rather than maintain both, this route now just forwards here
// — anything already pointed at /kiosk (a saved bookmark, a QR code stuck
// to the venue wall) keeps working, it just lands on the better page.
import { Redirect } from "wouter";

export default function Kiosk() {
  return <Redirect to="/broadcast" />;
}
