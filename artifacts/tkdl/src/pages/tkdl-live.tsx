import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "wouter";
import { BroadcastPlayer } from "@/features/broadcast/BroadcastPlayer";

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
  background: "radial-gradient(ellipse at 20% 20%, rgba(255,0,92,0.12) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(0,102,255,0.1) 0%, transparent 55%), #06040e",
  fontFamily: "Oswald, sans-serif",
};

export default function TkdlLive() {
  const [status, setStatus] = useState<BroadcastStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/broadcast/status", { credentials: "include" })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setStatus)
      .catch(() => setFailed(true));
  }, []);

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
      <BroadcastPlayer />

      {previewOnly && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-1.5 rounded-full"
          style={{ background: "rgba(255,210,74,0.14)", border: "1px solid rgba(255,210,74,0.4)", backdropFilter: "blur(8px)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#ffd24a" }} />
          <span className="font-black uppercase text-xs" style={{ color: "#ffd24a", letterSpacing: "0.15em" }}>
            Admin Preview — players can't see this yet
          </span>
        </div>
      )}

      <Link href="/" className="absolute bottom-14 right-4 z-40 text-xs font-bold uppercase" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em" }}>
        ← Back to the Hub
      </Link>
    </div>
  );
}
