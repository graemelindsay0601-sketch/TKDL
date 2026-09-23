import { useCallback, useEffect, useState } from "react";
import {
  Trophy, Swords, Sparkles, Award, CalendarCheck, Crown, Target, Compass,
  Tag, ShoppingBag, Package, Gift, Star, ShieldAlert, RotateCcw, Loader2,
} from "lucide-react";

interface Transaction {
  id: number;
  playerId: number;
  delta: number;
  balanceAfter: number;
  reason: string;
  detail: string | null;
  createdAt: string;
}

// One entry per lib/db/src/schema/player-currency.ts's CURRENCY_REASONS —
// an unrecognised reason (there shouldn't be one, but the type isn't
// enforced over the wire) falls back to a generic coin icon rather than
// rendering nothing.
const REASON_META: Record<string, { label: string; Icon: typeof Trophy; color: string }> = {
  match_win:              { label: "Match win",           Icon: Trophy,       color: "#22c55e" },
  card_clash_match:       { label: "Card Clash match",     Icon: Swords,       color: "#a855f7" },
  card_clash_card_bonus:  { label: "Card Clash bonus",     Icon: Sparkles,     color: "#a855f7" },
  achievement:            { label: "Achievement",          Icon: Award,        color: "#ffd24a" },
  daily_login:            { label: "Daily login",          Icon: CalendarCheck, color: "#38bdf8" },
  season_reward:          { label: "Season reward",        Icon: Crown,        color: "#ffd24a" },
  challenge:               { label: "Challenge",            Icon: Target,       color: "#00e5a0" },
  quest:                   { label: "Quest",                Icon: Compass,      color: "#00e5a0" },
  card_sell:               { label: "Card sold",            Icon: Tag,          color: "#9ca3af" },
  cosmetic_purchase:       { label: "Store purchase",       Icon: ShoppingBag,  color: "#ff005c" },
  card_pack_purchase:      { label: "Pack purchase",        Icon: Package,      color: "#ff005c" },
  pack_redeem_credit:      { label: "Pack redeemed",        Icon: Gift,         color: "#38bdf8" },
  featured_card_purchase:  { label: "Featured card",        Icon: Star,         color: "#ff005c" },
  admin_grant:             { label: "Admin grant",          Icon: ShieldAlert,  color: "#9ca3af" },
  admin_removal:           { label: "Admin adjustment",     Icon: ShieldAlert,  color: "#9ca3af" },
  admin_reset:             { label: "Account reset",        Icon: RotateCcw,    color: "#9ca3af" },
};
const DEFAULT_META = { label: "Coins", Icon: Sparkles, color: "#9ca3af" };

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const PAGE_SIZE = 25;

export function TransactionHistory({ playerId }: { playerId: number }) {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (offset: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const r = await fetch(`/api/players/${playerId}/currency-transactions?limit=${PAGE_SIZE}&offset=${offset}`, { credentials: "include" });
      if (!r.ok) { setFailed(true); return; }
      const data = await r.json() as { transactions: Transaction[]; hasMore: boolean };
      setRows(prev => append ? [...prev, ...data.transactions] : data.transactions);
      setHasMore(data.hasMore);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [playerId]);

  useEffect(() => { void load(0, false); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "rgba(255,255,255,0.25)" }} />
      </div>
    );
  }

  if (failed && rows.length === 0) {
    return (
      <div style={{
        textAlign: "center", padding: "16px", borderRadius: "10px",
        background: "rgba(255,0,92,0.04)", border: "1px dashed rgba(255,0,92,0.15)",
        fontSize: "0.72rem", color: "rgba(255,0,92,0.6)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.03em",
      }}>
        Couldn't load transaction history — try again shortly.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{
        textAlign: "center", padding: "16px", borderRadius: "10px",
        background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)",
        fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.03em",
      }}>
        No coin activity yet — win a match or complete a challenge to get started.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {rows.map(tx => {
        const meta = REASON_META[tx.reason] ?? DEFAULT_META;
        const credit = tx.delta > 0;
        return (
          <div key={tx.id} className="flex items-center gap-2.5 py-2 px-1"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}35` }}>
              <meta.Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.8)" }}>
                {tx.detail || meta.label}
              </div>
              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                {tx.detail ? meta.label + " · " : ""}{timeAgo(tx.createdAt)}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-black text-sm" style={{ fontFamily: "Oswald, sans-serif", color: credit ? "#22c55e" : "#ff005c" }}>
                {credit ? "+" : ""}{tx.delta}
              </div>
              <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
                bal {tx.balanceAfter}
              </div>
            </div>
          </div>
        );
      })}
      {hasMore && (
        <button
          onClick={() => void load(rows.length, true)}
          disabled={loadingMore}
          className="w-full mt-1"
          style={{
            fontSize: "0.65rem", fontWeight: 700, fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em",
            color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "8px", padding: "8px 0", cursor: loadingMore ? "default" : "pointer",
          }}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
