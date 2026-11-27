import { Target, Lock, Check } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import "./league-target.css";

type Step = { hits: number; id: string; name: string; category: string; rarity: string; owned: boolean };
export type LeagueTarget = {
  available: boolean; live: boolean; month: string; label: string; unit: string; blurb: string; target: number; value: number;
  daysLeft: number; minMatches: number; sharing: number;
  history: { month: string; label: string; target: number; value: number | null; hit: boolean | null; live: boolean }[];
  me: null | { matches: number; qualifies: boolean; hits: number; next: { hits: number; name: string; category: string } | null; ladder: Step[] };
};

const MONTH = (k: string, short = false) => new Date(`${k}-01T12:00:00Z`).toLocaleString("en-GB", { month: short ? "short" : "long", timeZone: "UTC" });
const KIND: Record<string, string> = { LEADERBOARD_TAG: "Tag", BANNER: "Banner", FRAME: "Frame", CLUBHOUSE_ROOM: "Clubhouse room", NAME_STYLE: "Name style" };

/** Hub card: this month's League Target, your part in it, and the exclusive unlocks it leads to. */
export function LeagueTargetCard() {
  const { data } = useFetch<LeagueTarget>("/api/league-target");
  if (!data?.available) return null;
  return <LeagueTargetView t={data} />;
}

export function LeagueTargetView({ t }: { t: LeagueTarget }) {
  const pct = Math.min(100, Math.round((t.value / Math.max(1, t.target)) * 100));
  const hit = t.value >= t.target;
  const togo = Math.max(0, t.target - t.value);
  const me = t.me;
  return (
    <section className={`lt-card${hit ? " is-hit" : ""}`} data-testid="league-target">
      <span className="lt-sheen" aria-hidden />
      <header className="lt-head">
        <span className="lt-icon"><Target className="w-4 h-4" /></span>
        <span className="lt-kick">League Target · {MONTH(t.month, true)}</span>
        {!t.live && <span className="lt-chip lt-preview">Preview</span>}
        <span className="lt-chip">{t.daysLeft} {t.daysLeft === 1 ? "day" : "days"} left</span>
      </header>

      <div className="lt-main">
        <div className="lt-big"><b>{t.value}</b><span>/ {t.target}</span></div>
        <div className="lt-what">
          <div className="lt-label">{t.label}</div>
          <div className="lt-status">{hit ? "Target hit — locked in for the month" : `${togo} ${t.unit} to go`}</div>
        </div>
      </div>

      <div className="lt-bar" role="progressbar" aria-valuenow={t.value} aria-valuemax={t.target}>
        <span className="lt-fill" style={{ width: `${pct}%` }} />
        {[25, 50, 75].map(x => <span key={x} className="lt-tick" style={{ left: `${x}%` }} />)}
      </div>
      <p className="lt-blurb">{t.blurb}</p>

      {me && (
        <div className={`lt-me${me.qualifies ? " in" : ""}`}>
          {me.qualifies
            ? <><Check className="w-3.5 h-3.5" /> You're in — {me.matches} matches this month</>
            : <>Play {t.minMatches - me.matches} more {t.minMatches - me.matches === 1 ? "match" : "matches"} this month to share in it</>}
          <span className="lt-sharing">{t.sharing} sharing</span>
        </div>
      )}

      {me && (
        <div className="lt-ladder">
          <div className="lt-ladder-head">
            <span>Exclusive unlocks</span>
            <span>{me.hits} {me.hits === 1 ? "target" : "targets"} hit</span>
          </div>
          <div className="lt-steps">
            {me.ladder.map(s => {
              const next = !s.owned && me.next?.hits === s.hits;
              return (
                <div key={s.id} className={`lt-step r-${s.rarity.toLowerCase()}${s.owned ? " owned" : ""}${next ? " next" : ""}`}>
                  <span className="lt-step-n">{s.owned ? <Check className="w-3 h-3" /> : s.hits}</span>
                  <span className="lt-step-name">{s.name}</span>
                  <span className="lt-step-kind">{KIND[s.category] ?? s.category}</span>
                  {!s.owned && !next && <Lock className="lt-step-lock w-3 h-3" />}
                </div>
              );
            })}
          </div>
          <p className="lt-note">Only from League Targets — never in the Store.</p>
        </div>
      )}

      {t.history.length > 0 && (
        <div className="lt-history">
          {t.history.slice().reverse().map(h => (
            <span key={h.month} className={`lt-past${h.hit ? " hit" : ""}`} title={`${h.label}: ${h.value ?? 0} / ${h.target}`}>
              {MONTH(h.month, true)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
