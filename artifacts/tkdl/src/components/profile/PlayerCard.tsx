// Profile 2.0: the Player Card. Ratings 40–99 worked out from real league matches
// (rules in shared/darts-rules/player-ratings.ts), shown as a collectable card with a band
// (Bronze / Silver / Gold / Elite) and where each rating ranks in the league.
import { useEffect, useState } from "react";
import { Info, Share2 } from "lucide-react";
import { RATING_INFO, RATING_ORDER, type RatingKey } from "@/lib/darts-rules";
import { shareCard } from "@/lib/share-card";
import "./player-card.css";

type CardData = {
  playerId: number; name: string; minMatches: number;
  card: null | {
    overall: number; sample: number; of: number;
    ratings: Record<RatingKey, number | null>;
    raw: { tonRate: number | null; bigRate: number | null; checkoutPct: number | null; avgLegDarts: number | null; upsets: number | null };
    band: { id: "bronze" | "silver" | "gold" | "elite"; name: string };
    ranks: Record<RatingKey | "overall", number | null>;
  };
};

const BAND_ACCENT = { bronze: "#d08a4a", silver: "#cfd8e6", gold: "#ffd24a", elite: "#b388ff" } as const;
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 10 > 3 || [11, 12, 13].includes(n % 100) ? 0 : n % 10]}`;

function rawLine(k: RatingKey, raw: NonNullable<CardData["card"]>["raw"]): string | null {
  switch (k) {
    case "SCO": return raw.tonRate == null ? null : `${raw.tonRate}% of visits 100+`;
    case "FIN": return raw.checkoutPct == null ? "No checkout darts recorded yet" : `${raw.checkoutPct}% at the double`;
    case "POW": return raw.bigRate == null ? null : `${raw.bigRate} big scores per 100 visits`;
    case "PAC": return raw.avgLegDarts == null ? "No 501 wins with darts recorded yet" : `${raw.avgLegDarts} darts per 501 leg won`;
    case "FRM": return "Newest results count most";
    case "BIG": return raw.upsets ? `${raw.upsets} upset win${raw.upsets === 1 ? "" : "s"} lately` : "ELO-led";
  }
}

export function PlayerCard({ playerId, avatarUrl, tier, elo, title }: { playerId: number; avatarUrl: string | null; tier: string; elo: number; title?: string | null }) {
  const [d, setD] = useState<CardData | null>(null);
  const [failed, setFailed] = useState(false);
  const [how, setHow] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "busy" | "done">("idle");
  useEffect(() => {
    setD(null); setFailed(false);
    fetch(`/api/players/${playerId}/card`).then(r => r.ok ? r.json() : Promise.reject()).then(setD).catch(() => setFailed(true));
  }, [playerId]);

  if (failed) return null;
  if (!d) return <div className="pc-wrap"><div className="pc-card pc-loading" /></div>;
  const c = d.card;
  if (!c) {
    return (
      <div className="pc-empty">
        <strong>Player Card</strong>
        <p>Ratings appear after {d.minMatches} league 501/301 matches with stats from the scorer. Play a few more and the card fills itself in.</p>
      </div>
    );
  }
  const accent = BAND_ACCENT[c.band.id];
  const best = RATING_ORDER.filter(k => c.ranks[k] === 1);

  const save = async () => {
    setShareState("busy");
    try {
      await shareCard({
        eyebrow: `TKDL Player Card · ${c.band.name}`, title: d.name, subtitle: `${c.overall} overall · ${tier} · ${elo} ELO`, badge: String(c.overall), accent, secondaryAccent: "#a855f7",
        stats: RATING_ORDER.map(k => ({ label: RATING_INFO[k].name, value: c.ratings[k] == null ? "—" : String(c.ratings[k]) })),
        footer: `From the last ${c.sample} league X01 matches`,
      }, `tkdl-card-${d.name}`);
      setShareState("done");
    } catch { setShareState("idle"); }
  };

  return (
    <div className="pc-wrap">
      <div className={`pc-card band-${c.band.id}`} style={{ ["--pc-acc" as string]: accent }}>
        <div className="pc-shine" />
        <div className="pc-top">
          <div className="pc-ovr">
            <b>{c.overall}</b>
            <span>OVR</span>
            {c.ranks.overall && <em>{ordinal(c.ranks.overall)} of {c.of}</em>}
          </div>
          <div className="pc-photo">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{d.name.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="pc-band">{c.band.name}</div>
        </div>
        <div className="pc-name">{d.name}</div>
        {title && <div className="pc-title">“{title}”</div>}
        <div className="pc-meta">{tier} · {elo} ELO</div>
        <div className="pc-grid">
          {RATING_ORDER.map(k => {
            const v = c.ratings[k];
            return (
              <div key={k} className={`pc-stat ${v == null ? "na" : ""} ${c.ranks[k] === 1 ? "top" : ""}`}>
                <b>{v ?? "—"}</b><span>{k}</span>
                <i style={{ width: `${v == null ? 0 : ((v - 40) / 59) * 100}%` }} />
              </div>
            );
          })}
        </div>
        {best.length > 0 && <div className="pc-best">Best in the league: {best.map(k => RATING_INFO[k].name).join(", ")}</div>}
        <div className="pc-foot">Last {c.sample} league X01 matches</div>
      </div>
      <div className="pc-actions">
        <button type="button" onClick={() => setHow(h => !h)}><Info size={14} />How it's worked out</button>
        <button type="button" onClick={save} disabled={shareState === "busy"}><Share2 size={14} />{shareState === "done" ? "Saved" : "Save card"}</button>
      </div>
      {how && (
        <div className="pc-how">
          {RATING_ORDER.map(k => (
            <div key={k} className="pc-how-row">
              <b>{k}</b>
              <div><strong>{RATING_INFO[k].name}{c.ranks[k] ? ` · ${ordinal(c.ranks[k]!)} in the league` : ""}</strong><small>{RATING_INFO[k].how}. {rawLine(k, c.raw)}</small></div>
            </div>
          ))}
          <p>Ratings run from 40 to 99, using only league matches the scorer recorded. Overall is a weighted mix (scoring and finishing count most). A rating shows "—" when there isn't data for it yet.</p>
        </div>
      )}
    </div>
  );
}
