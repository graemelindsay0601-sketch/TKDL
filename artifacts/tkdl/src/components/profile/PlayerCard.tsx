// Profile 2.0: Player Cards, one per game (501, 301, Cricket, Around the World). Six ratings
// each, 40–99, from real league matches (rules in shared/darts-rules/player-ratings.ts), a band
// (Bronze / Silver / Gold / Elite) and league ranks. Swipe or tap to switch game.
import { useEffect, useRef, useState } from "react";
import { Info, Lock, Share2 } from "lucide-react";
import { CARD_GAME_NAME, CARD_RATINGS, type CardGame } from "@/lib/darts-rules";
import { shareCard } from "@/lib/share-card";
import "./player-card.css";

type Unlocked = {
  game: CardGame; locked: false; overall: number; sample: number; of: number;
  ratings: Record<string, number | null>; raw: Record<string, number | null>;
  band: { id: "bronze" | "silver" | "gold" | "elite"; name: string };
  ranks: Record<string, number | null>;
  /** Ratings where this player is outright top of the league. */
  best: string[];
};
type Locked = { game: CardGame; locked: true; played: number; need: number };
type Card = Unlocked | Locked;

const BAND_ACCENT = { bronze: "#d08a4a", silver: "#cfd8e6", gold: "#ffd24a", elite: "#b388ff" } as const;
const TAB_NAME: Record<CardGame, string> = { "501": "501", "301": "301", CRICKET: "Cricket", ATW: "ATW" };
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 10 > 3 || [11, 12, 13].includes(n % 100) ? 0 : n % 10]}`;

/** A plain-English line under each rating in "How it's worked out". */
function rawLine(game: CardGame, k: string, raw: Record<string, number | null>): string {
  const detail = game === "CRICKET" || game === "ATW";
  if (detail && !["FRM", "WIN"].includes(k) && !raw.detailGames) return "Needs 3 games scored live on the new scorer";
  switch (k) {
    case "SCO": return raw.tonRate == null ? "No visit stats yet" : `${raw.tonRate}% of visits 100+ · ${raw.t180s ?? 0} × 180`;
    case "FIN": return raw.checkoutPct == null ? "No checkout darts recorded yet" : `${raw.checkoutPct}% at the double`;
    case "PAC": return game === "ATW" ? (raw.avgDarts == null ? "No wins with stats yet" : `${raw.avgDarts} darts to get round`)
      : game === "CRICKET" ? "Darts in the games you won" : raw.avgLegDarts == null ? "No wins with darts recorded yet" : `${raw.avgLegDarts} darts per leg won`;
    case "CON": return raw.legSpread == null ? "Needs 3 wins with darts recorded" : `Legs usually within ±${raw.legSpread} darts`;
    case "MPR": return raw.mpr == null ? "—" : `${raw.mpr} marks per round`;
    case "BIG": return raw.nineMarks ? `${raw.nineMarks} nine-mark visit${raw.nineMarks === 1 ? "" : "s"}` : "No nine-mark visits yet";
    case "WIN": return `${raw.winPct ?? 0}% won`;
    case "FRM": return "";
    default: return detail ? `From ${raw.detailGames ?? 0} live-scored games` : "";
  }
}

export function PlayerCard({ playerId, avatarUrl, tier, elo, title }: { playerId: number; avatarUrl: string | null; tier: string; elo: number; title?: string | null }) {
  const [d, setD] = useState<{ name: string; cards: Card[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [game, setGame] = useState<CardGame | null>(null);
  const [how, setHow] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "busy" | "done">("idle");
  const touch = useRef<number | null>(null);
  useEffect(() => {
    setD(null); setFailed(false); setGame(null);
    fetch(`/api/players/${playerId}/card`).then(r => r.ok ? r.json() : Promise.reject()).then((x: { name: string; cards: Card[] }) => {
      setD(x);
      // Open on their best unlocked card.
      const best = x.cards.filter((c): c is Unlocked => !c.locked).sort((a, b) => b.overall - a.overall)[0];
      setGame(best?.game ?? "501");
    }).catch(() => setFailed(true));
  }, [playerId]);
  useEffect(() => { setShareState("idle"); }, [game]);

  if (failed) return null;
  if (!d || !game) return <div className="pc-wrap"><div className="pc-card pc-loading" /></div>;
  const idx = d.cards.findIndex(c => c.game === game);
  const c = d.cards[idx];
  const step = (dir: 1 | -1) => setGame(d.cards[(idx + dir + d.cards.length) % d.cards.length].game);
  const info = CARD_RATINGS[game];
  const accent = c.locked ? "#6b6780" : BAND_ACCENT[c.band.id];
  const best = c.locked ? [] : info.filter(i => c.best.includes(i.key));

  const save = async () => {
    if (c.locked) return;
    setShareState("busy");
    try {
      await shareCard({
        eyebrow: `TKDL ${CARD_GAME_NAME[game]} Card · ${c.band.name}`, title: d.name, subtitle: `${c.overall} overall · ${tier} · ${elo} ELO`,
        badge: String(c.overall), accent, secondaryAccent: "#a855f7",
        stats: info.map(i => ({ label: i.name, value: c.ratings[i.key] == null ? "—" : String(c.ratings[i.key]) })),
        footer: `From the last ${c.sample} league ${CARD_GAME_NAME[game]} games`,
      }, `tkdl-${game}-card-${d.name}`);
      setShareState("done");
    } catch { setShareState("idle"); }
  };

  return (
    <div className="pc-wrap">
      <div className="pc-games" role="tablist" aria-label="Card game">
        {d.cards.map(x => (
          <button key={x.game} type="button" role="tab" aria-selected={x.game === game} className={`${x.game === game ? "on" : ""} ${x.locked ? "locked" : ""}`} onClick={() => setGame(x.game)}>
            {x.locked && <Lock size={10} />}{TAB_NAME[x.game]}{!x.locked && <em>{x.overall}</em>}
          </button>
        ))}
      </div>
      <div className={`pc-card ${c.locked ? "is-locked" : `band-${c.band.id}`}`} style={{ ["--pc-acc" as string]: accent }}
        onTouchStart={e => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={e => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); }}>
        <div className="pc-shine" />
        <div className="pc-top">
          <div className="pc-ovr">
            <b>{c.locked ? "—" : c.overall}</b>
            <span>OVR</span>
            {!c.locked && c.ranks.overall && <em>{ordinal(c.ranks.overall)} of {c.of}</em>}
          </div>
          <div className="pc-photo">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{d.name.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="pc-band">{c.locked ? "Locked" : c.band.name}</div>
        </div>
        <div className="pc-game">{CARD_GAME_NAME[game]}</div>
        <div className="pc-name">{d.name}</div>
        {title && <div className="pc-title">“{title}”</div>}
        <div className="pc-meta">{tier} · {elo} ELO</div>
        <div className="pc-grid">
          {info.map(i => {
            const v = c.locked ? null : c.ratings[i.key];
            return (
              <div key={i.key} className={`pc-stat ${v == null ? "na" : ""} ${!c.locked && c.best.includes(i.key) ? "top" : ""}`}>
                <b>{v ?? "—"}</b><span>{i.key}</span>
                <i style={{ width: `${v == null ? 0 : ((v - 40) / 59) * 100}%` }} />
              </div>
            );
          })}
        </div>
        {c.locked
          ? <div className="pc-lock"><Lock size={14} />Play {c.need - c.played} more league {CARD_GAME_NAME[game]} game{c.need - c.played === 1 ? "" : "s"} to unlock</div>
          : (game === "CRICKET" || game === "ATW") && (c.raw.detailGames ?? 0) < 3
            ? <div className="pc-lock">Results only so far · fills in with games scored live on the new scorer</div>
            : best.length > 0 && <div className="pc-best">Best in the league: {best.map(i => i.name).join(", ")}</div>}
        <div className="pc-foot">{c.locked ? `${c.played} of ${c.need} games played` : `Last ${c.sample} league ${CARD_GAME_NAME[game]} games`}</div>
      </div>
      <div className="pc-dots">{d.cards.map(x => <i key={x.game} className={x.game === game ? "on" : ""} />)}</div>
      {!c.locked && (
        <div className="pc-actions">
          <button type="button" onClick={() => setHow(h => !h)}><Info size={14} />How it's worked out</button>
          <button type="button" onClick={save} disabled={shareState === "busy"}><Share2 size={14} />{shareState === "done" ? "Saved" : "Save card"}</button>
        </div>
      )}
      {how && !c.locked && (
        <div className="pc-how">
          {info.map(i => (
            <div key={i.key} className="pc-how-row">
              <b>{i.key}</b>
              <div><strong>{i.name}{c.ranks[i.key] ? ` · ${ordinal(c.ranks[i.key]!)} in the league` : ""}</strong><small>{i.how}.{rawLine(game, i.key, c.raw) ? ` ${rawLine(game, i.key, c.raw)}` : ""}</small></div>
            </div>
          ))}
          <p>Ratings run from 40 to 99, using only league games. Each game has its own card, so you can be Gold at cricket and Bronze at 501. A rating shows "—" when there isn't data for it yet.</p>
        </div>
      )}
    </div>
  );
}
