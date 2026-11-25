import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "wouter";
import { BroadcastPlayer } from "@/features/broadcast/BroadcastPlayer";
import { LeagueAwardsShow } from "@/features/broadcast/LeagueAwardsShow";
import { ReplayLibrary } from "@/features/broadcast/ReplayLibrary";
import { LiveExtras } from "@/features/broadcast/LiveExtras";
import { ChannelHome } from "@/features/broadcast/ChannelHome";
import "./tkdl-live.css";
import { Menu, X, Home, Radio, PlaySquare, Trophy, LayoutList, ArrowLeft } from "lucide-react";

/**
 * TKDL LIVE — the automated broadcast "show" (see the handover doc's
 * feasibility review). This is the very first scaffold: it just proves the
 * beta-toggle gating works end to end. Presenters, storylines, predictors
 * etc. get built into this screen phase by phase — see GET /api/broadcast/status
 * (routes/broadcast.ts) for how availability is decided.
 *
 * Gating mirrors card_shop/coins/card_clash exactly: while the tkdl_live
 * flag has adminTestMode on and isn't yet enabled for everyone, only an
 * admin session sees the real screen — everyone else gets a plain
 * "coming soon" placeholder with no hint of what's being built.
 */

type BroadcastStatus = {
  available:     boolean;
  liveForAll:    boolean;
  adminTestMode: boolean;
  isAdmin?:      boolean;
};

const SHELL_STYLE: CSSProperties = {
  background: "radial-gradient(ellipse at 20% 0%, rgba(255,0,92,0.15) 0%, transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(0,102,255,0.15) 0%, transparent 55%), #040208",
  fontFamily: "Oswald, sans-serif",
};

export default function TkdlLive() {
  const [status, setStatus] = useState<BroadcastStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [showAwards, setShowAwards] = useState(false);
  const [showReplays, setShowReplays] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showHome, setShowHome] = useState(true);

  useEffect(() => {
    fetch("/api/broadcast/status", { credentials: "include" })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setStatus)
      .catch(() => setFailed(true));
  }, []);

  // Once the real screen actually renders (not the coming-soon placeholder),
  // record the latest edition as seen — clears the "new edition" dot the
  // sidebar shows on this nav item. Fire-and-forget; a failure here just
  // means the dot stays lit a bit longer, never worth blocking the screen.
  useEffect(() => {
    if (!status?.available) return;
    fetch("/api/broadcast/mark-seen", { method: "POST", credentials: "include" }).catch(() => {});
  }, [status?.available]);

  // Still checking — a blank dark screen avoids a flash of "coming soon"
  // before we know whether this viewer is actually an admin.
  if (!status && !failed) {
    return <div className="fixed inset-0" style={SHELL_STYLE} />;
  }

  if (failed || !status?.available) {
    return (
      <div className="fixed inset-0 flex items-center justify-center select-none" style={SHELL_STYLE}>
        <div className="text-center px-6">
          <div className="font-black uppercase text-white/80" style={{ fontSize: "1.4rem", letterSpacing: "0.2em" }}>
            TKDL LIVE
          </div>
          <div className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            Coming soon.
          </div>
          <Link href="/" className="inline-block mt-6 text-xs font-bold uppercase" style={{ color: "#ff005c", letterSpacing: "0.15em" }}>
            ← Back to the Hub
          </Link>
        </div>
      </div>
    );
  }

  const previewOnly = status.adminTestMode && !status.liveForAll;

  return (
    <div className="fixed inset-0 select-none">
      {!showAwards && !showReplays && !showExtras && !showHome && <BroadcastPlayer />}

      {showHome && <ChannelHome
        onWatchLive={() => setShowHome(false)}
        onOpenExtras={() => { setShowHome(false); setShowExtras(true); }}
        onOpenReplays={() => { setShowHome(false); setShowReplays(true); }}
        onOpenAwards={() => { setShowHome(false); setShowAwards(true); }}
      />}

      {showAwards && <LeagueAwardsShow onClose={() => setShowAwards(false)} />}
      {showReplays && (
        <ReplayLibrary
          onClose={() => setShowReplays(false)}
          onOpenAwards={() => { setShowReplays(false); setShowAwards(true); }}
        />
      )}
      {showExtras && <LiveExtras onClose={() => setShowExtras(false)} />}

      {previewOnly && (
        // `top: max(1.5rem, ...)` instead of a plain `top-6` — on a phone
        // where this page draws edge-to-edge under the OS status bar (this
        // app's own manifest opts into that), a fixed 1.5rem collided
        // directly with the status bar's own clock/signal/battery icons
        // (real user screenshot: "TKDL LIVE" and this pill rendering right
        // on top of "09:43"). `env(safe-area-inset-top)` is 0 on any device
        // that doesn't need it, so this is a no-op everywhere else.
        <div className="lv-admin-chip"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "#ffd24a" }} />Admin preview</div>
      )}

      {/* Stacked (not side-by-side) so neither link's width has to be
          guessed — /broadcast (the plain standings board) is the other
          full-bleed kiosk screen, previously reachable only by its own URL
          with no way across from here. */}
      <button type="button" className="lv-menu-btn" aria-expanded={menuOpen} aria-label="TKDL LIVE menu" onClick={() => setMenuOpen(o => !o)}>
        {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />} Menu
      </button>
      {menuOpen && (
        <nav className="lv-menu" aria-label="TKDL LIVE destinations">
          <div className="lv-menu-k">TKDL LIVE</div>
          {([
            [() => setShowHome(true), Home, "#ffffff", "Channel home", "Every show and segment"],
            [() => setShowExtras(true), Radio, "#ff5c93", "Inside the league", "Profiles, voices and stats"],
            [() => setShowReplays(true), PlaySquare, "#7fb4ff", "Replay library", "Watch earlier editions"],
            [() => setShowAwards(true), Trophy, "#ffd24a", "League awards", "This season's winners"],
          ] as const).map(([go, Icon, c, label, sub]) => (
            <button key={label} type="button" onClick={() => { setMenuOpen(false); go(); }}>
              <span className="ico" style={{ ["--c" as any]: c }}><Icon className="w-4 h-4" /></span>
              <span>{label}<small>{sub}</small></span>
            </button>
          ))}
          <hr />
          <Link href="/broadcast"><span className="ico" style={{ ["--c" as any]: "#4ade80" }}><LayoutList className="w-4 h-4" /></span><span>Standings board<small>The big-screen table</small></span></Link>
          <Link href="/"><span className="ico" style={{ ["--c" as any]: "#a9a4bd" }}><ArrowLeft className="w-4 h-4" /></span><span>Back to the Hub</span></Link>
        </nav>
      )}
    </div>
  );
}
