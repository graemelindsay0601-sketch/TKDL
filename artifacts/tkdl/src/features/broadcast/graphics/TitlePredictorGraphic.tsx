// TKDL LIVE — TitlePredictorGraphic (GRAPHIC_KIND_BY_STORY_TYPE: TITLE_SWING,
// NEW_FAVOURITE, DEAD_HEAT, TITLE_RACE). A probability-bar shaped visual —
// a stacked ranking of bars for the full race, two near-level bars flagged
// "Dead Heat," a crown-swap move for a new favourite, or a single big
// percentage with a delta arrow for a swing — instead of the old shared
// chip grid rendering "currentProbability"/"previousProbability" as
// unrelated label/value pills (see kit.tsx's own header).
//
// On kit.tsx's v3 "BigBoard" skin at `compact={false}` (major visual tier —
// this is one of the two graphics rebuilt as the direction check for the
// user's reference-image "go big like this, one story at a time" call: a
// real numbered-row standings table for the ranked race, a giant glowing
// number for the swing case) and the v2 "broadcast panel" skin at
// `compact={true}` (quiet/featured tier — the calmer, smaller treatment
// routine play still gets).
import {
  Panel, PanelTag, PanelBar, PanelFlag, PanelLine,
  BigPanel, BigPanelHeader, BigRow, BigMove, BigHeroNumber, BigBadge, BigLine,
  pct, str, num, numArray,
} from "./kit";
import type { GraphicData, LeagueType } from "../types";
import { LEAGUE_ACCENT } from "../theme";

const ACCENT = "#a855f7";

export function TitlePredictorGraphic({ leagueType, data, compact }: { leagueType: LeagueType | null; data: GraphicData; compact?: boolean }) {
  const leagueAccent = leagueType ? LEAGUE_ACCENT[leagueType] : ACCENT;
  const big = !compact;

  // TITLE_RACE — the full field, ranked.
  const namesJoined = str(data, "viableEntityNamesJoined");
  const probabilities = numArray(data, "probabilities");
  if (namesJoined && probabilities) {
    const names = namesJoined.split(", ");
    const ranked = names.map((name, i) => ({ name, p: probabilities[i] ?? 0 })).sort((a, b) => b.p - a.p);
    const shown = ranked.slice(0, big ? 5 : 2);
    const overflow = ranked.length - shown.length;

    if (big) {
      return (
        <BigPanel accent={ACCENT} dense>
          <BigPanelHeader icon="🔮" kind="Title Race" leagueType={leagueType} accent={ACCENT} />
          <div className="flex flex-col gap-1">
            {shown.map((entry, i) => (
              <BigRow key={entry.name} rank={i + 1} label={entry.name} valueLabel={pct(entry.p)} fraction={entry.p} accent={i === 0 ? leagueAccent : "rgba(255,255,255,0.45)"} delay={i} dense />
            ))}
          </div>
          {overflow > 0 && <BigLine>+{overflow} more still in the mix</BigLine>}
        </BigPanel>
      );
    }
    return (
      <Panel accent={ACCENT} compact>
        <PanelTag icon="🔮" kind="Title Race" leagueType={leagueType} accent={ACCENT} compact />
        <div className="flex flex-col gap-1.5">
          {shown.map((entry, i) => (
            <PanelBar key={entry.name} label={entry.name} valueLabel={pct(entry.p)} fraction={entry.p} accent={i === 0 ? leagueAccent : "rgba(255,255,255,0.4)"} compact />
          ))}
        </div>
        {overflow > 0 && <PanelLine>+{overflow} more in the mix</PanelLine>}
      </Panel>
    );
  }

  // DEAD_HEAT — two near-level bars.
  const firstName = str(data, "firstEntityName");
  const secondName = str(data, "secondEntityName");
  const firstP = num(data, "firstProbability");
  const secondP = num(data, "secondProbability");
  if (firstName && secondName && firstP !== null && secondP !== null) {
    if (big) {
      return (
        <BigPanel accent={ACCENT}>
          <BigPanelHeader icon="🔮" kind="Title Predictor" leagueType={leagueType} accent={ACCENT} />
          <div className="flex flex-col gap-3">
            <BigRow label={firstName} valueLabel={pct(firstP)} fraction={firstP} accent={leagueAccent} delay={0} />
            <BigRow label={secondName} valueLabel={pct(secondP)} fraction={secondP} accent="rgba(255,255,255,0.45)" delay={1} />
          </div>
          <BigBadge accent={ACCENT}>Dead Heat</BigBadge>
        </BigPanel>
      );
    }
    return (
      <Panel accent={ACCENT} compact>
        <PanelTag icon="🔮" kind="Title Predictor" leagueType={leagueType} accent={ACCENT} compact />
        <div className="flex flex-col gap-1.5">
          <PanelBar label={firstName} valueLabel={pct(firstP)} fraction={firstP} accent={leagueAccent} compact />
          <PanelBar label={secondName} valueLabel={pct(secondP)} fraction={secondP} accent="rgba(255,255,255,0.4)" compact />
        </div>
        <PanelFlag accent={ACCENT}>Dead Heat</PanelFlag>
      </Panel>
    );
  }

  // NEW_FAVOURITE — a crown-swap move.
  const newFavourite = str(data, "newFavouriteEntityName");
  const previousFavourite = str(data, "previousFavouriteEntityName");
  const favouriteP = num(data, "probability");
  if (newFavourite && previousFavourite) {
    if (big) {
      return (
        <BigPanel accent={ACCENT} fill={false}>
          <BigPanelHeader icon="🔮" kind="New Favourite" leagueType={leagueType} accent={ACCENT} />
          <BigMove before={previousFavourite} after={newFavourite} accent={ACCENT} improved />
          {favouriteP !== null && <BigLine>{pct(favouriteP)} title probability</BigLine>}
        </BigPanel>
      );
    }
    return (
      <Panel accent={ACCENT} compact>
        <PanelTag icon="🔮" kind="New Favourite" leagueType={leagueType} accent={ACCENT} compact />
        <div className="bug-chip-in font-black uppercase truncate" style={{ animationDelay: "80ms", color: ACCENT, fontSize: "1rem" }}>{previousFavourite} → {newFavourite}</div>
        {favouriteP !== null && <PanelLine>{pct(favouriteP)} title probability</PanelLine>}
      </Panel>
    );
  }

  // TITLE_SWING — one big number plus its delta.
  const entityName = str(data, "entityName");
  const currentProbability = num(data, "currentProbability");
  const deltaPoints = num(data, "deltaPoints");
  if (entityName && currentProbability !== null) {
    const rising = (deltaPoints ?? 0) > 0;
    if (big) {
      return (
        <BigPanel accent={ACCENT} fill={false}>
          <BigPanelHeader icon="🔮" kind="Title Predictor" leagueType={leagueType} accent={ACCENT} />
          <div className="bug-chip-in font-black uppercase truncate" style={{ animationDelay: "80ms", color: leagueAccent, fontSize: "1.3rem" }}>{entityName}</div>
          <BigHeroNumber value={pct(currentProbability)} label="Title Chance" accent={ACCENT} />
          {deltaPoints !== null && <BigLine>{rising ? "▲" : "▼"} {pct(Math.abs(deltaPoints))} since last time</BigLine>}
        </BigPanel>
      );
    }
    return (
      <Panel accent={ACCENT} compact>
        <PanelTag icon="🔮" kind="Title Predictor" leagueType={leagueType} accent={ACCENT} compact />
        <div className="bug-chip-in font-black uppercase truncate" style={{ animationDelay: "80ms", color: leagueAccent, fontSize: "0.9rem" }}>{entityName}</div>
        <div className="bug-chip-in font-black tabular-nums" style={{ animationDelay: "120ms", color: ACCENT, fontSize: "1.9rem" }}>{pct(currentProbability)}</div>
        {deltaPoints !== null && <PanelLine>{rising ? "▲" : "▼"} {pct(Math.abs(deltaPoints))} since last time</PanelLine>}
      </Panel>
    );
  }

  if (big) {
    return (
      <BigPanel accent={ACCENT} fill={false}>
        <BigPanelHeader icon="🔮" kind="Title Predictor" leagueType={leagueType} accent={ACCENT} />
        <BigLine>No prediction data for this story.</BigLine>
      </BigPanel>
    );
  }
  return (
    <Panel accent={ACCENT} compact>
      <PanelTag icon="🔮" kind="Title Predictor" leagueType={leagueType} accent={ACCENT} compact />
      <PanelLine>No prediction data for this story.</PanelLine>
    </Panel>
  );
}
