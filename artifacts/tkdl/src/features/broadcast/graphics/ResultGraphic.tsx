// TKDL LIVE — ResultGraphic (GRAPHIC_KIND_BY_STORY_TYPE: MATCH_RESULT,
// PAIR_RESULT, ELIMINATION,
// DROUGHT_ENDED, CLINICAL_FINISHING, DOUBLE_TROUBLE, SCORING_POWER,
// SCORING_WITHOUT_FINISHING, SEASON_BEST, PERSONAL_BEST,
// CAREER_MATCH_MILESTONE, CAREER_WIN_MILESTONE, 180_MILESTONE,
// ELIMINATION_MILESTONE, PAIR_ELIMINATED, SEASON_COMPARISON, SEASON_RECAP —
// the catch-all "here's the verified number behind this claim" kind, plus
// (for now) the three not-yet-designed FILLER story types).
//
// On kit.tsx's v3 "BigBoard" skin at `compact={false}` (major visual tier —
// real user feedback, via a reference image, "go big like this, one story
// at a time": that story's own graphic should dominate the frame, not sit
// in a small corner card) and the v2 "broadcast panel" skin at
// `compact={true}` (quiet/featured tier — the calmer, smaller treatment
// routine play still gets). Every hero-badge-only branch below passes
// BigPanel `fill={false}` (sized to its own content, not stretched to a
// wide wrapper it has nothing to fill — see BigPanel's own comment); the
// two percentile-bar branches (SCORING_POWER, SCORING_WITHOUT_FINISHING)
// keep the default `fill={true}` since their bars genuinely want the width.
//
// This is the widest catch-all graphic kind (14 real story types plus 3
// FILLER placeholders), so unlike HeadToHeadGraphic (this skin's other
// first example) it keeps a real fallback: a facts shape none of the cases
// below recognise (chiefly PRACTICE_ACTIVITY/SHADOW_BOT_PROMO/
// FEATURE_SPOTLIGHT, whose own facts shape hasn't been designed yet — see
// the broadcast filler-content build still queued after this) renders
// through the old GraphicFrame generic chip grid rather than showing
// nothing, at either tier.
import {
  Panel, PanelTag, HeroBadge, PanelBar, PanelLine, PanelFlag,
  BigPanel, BigPanelHeader, BigHeroNumber, BigRow, BigLine, BigBadge, BigMove,
  pct, str, num, bool,
} from "./kit";
import { GraphicFrame } from "./GraphicFrame";
import type { GraphicData, LeagueType } from "../types";
import { LEAGUE_ACCENT } from "../theme";

const ACCENT = "#ffd24a";

function Subject({ name, leagueAccent, big }: { name: string; leagueAccent: string; big?: boolean }) {
  return (
    <div className="font-black uppercase truncate" style={{ color: leagueAccent, fontSize: big ? "1.15rem" : "0.72rem", letterSpacing: "0.03em" }}>{name}</div>
  );
}

export function ResultGraphic({ leagueType, data, compact }: { leagueType: LeagueType | null; data: GraphicData; compact?: boolean }) {
  const leagueAccent = leagueType ? LEAGUE_ACCENT[leagueType] : ACCENT;
  const subject = str(data, "playerName") ?? str(data, "winnerName") ?? str(data, "entityName");
  const big = !compact;

  // MATCH_RESULT / PAIR_RESULT — the guaranteed, factual result card used
  // when a completed match has no more dramatic detector to lead with.
  // `resultKind` distinguishes these baseline stories from ELIMINATION and
  // PAIR_ELIMINATED, which deliberately use stronger red consequence styling.
  const resultKind = str(data, "resultKind");
  if (resultKind === "singles" || resultKind === "doubles") {
    const winner = str(data, resultKind === "doubles" ? "winnerTeamName" : "winnerName");
    const loser = str(data, resultKind === "doubles" ? "loserTeamName" : "loserName");
    const winnerBefore = num(data, "winnerPointsBefore");
    const winnerAfter = num(data, "winnerPointsAfter");
    const loserBefore = num(data, "loserPointsBefore");
    const loserAfter = num(data, "loserPointsAfter");
    const movement = winnerBefore !== null && winnerAfter !== null && loserBefore !== null && loserAfter !== null
      ? `${winnerBefore} → ${winnerAfter} pts · ${loserBefore} → ${loserAfter} pts`
      : null;
    if (winner && loser) {
      if (big) {
        return (
          <BigPanel accent={leagueAccent} fill={false}>
            <BigPanelHeader icon="✓" kind="Confirmed Result" leagueType={leagueType} accent={leagueAccent} />
            <div className="flex items-baseline gap-3">
              <span className="font-black uppercase truncate" style={{ color: leagueAccent, fontSize: "1.7rem" }}>{winner}</span>
              <span style={{ color: "rgba(255,255,255,0.42)", fontSize: "0.9rem" }}>beat</span>
              <span className="font-bold uppercase truncate" style={{ color: "rgba(255,255,255,0.72)", fontSize: "1.4rem" }}>{loser}</span>
            </div>
            {movement && <BigLine>{movement}</BigLine>}
          </BigPanel>
        );
      }
      return (
        <Panel accent={leagueAccent} compact>
          <PanelTag icon="✓" kind="Confirmed Result" leagueType={leagueType} accent={leagueAccent} compact />
          <div className="flex items-baseline gap-2">
            <span className="font-black uppercase truncate" style={{ color: leagueAccent, fontSize: "0.95rem" }}>{winner}</span>
            <span style={{ color: "rgba(255,255,255,0.42)", fontSize: "0.66rem" }}>beat</span>
            <span className="font-bold uppercase truncate" style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.85rem" }}>{loser}</span>
          </div>
          {movement && <PanelLine>{movement}</PanelLine>}
        </Panel>
      );
    }
  }

  // SEASON_BEST / PERSONAL_BEST — a verified record claim.
  const metric = str(data, "metric");
  const recordValue = data["value"];
  if (metric && (typeof recordValue === "number" || typeof recordValue === "string") && bool(data, "verifiedRecordClaim")) {
    if (big) {
      return (
        <BigPanel accent={ACCENT} fill={false}>
          <BigPanelHeader icon="🏆" kind="Verified Best" leagueType={leagueType} accent={ACCENT} />
          {subject && <Subject name={subject} leagueAccent={leagueAccent} big />}
          <BigHeroNumber value={String(recordValue)} label={metric} accent={ACCENT} />
          <BigBadge accent={ACCENT}>Verified</BigBadge>
        </BigPanel>
      );
    }
    return (
      <Panel accent={ACCENT} compact>
        <PanelTag icon="🏆" kind="Verified Best" leagueType={leagueType} accent={ACCENT} compact />
        {subject && <Subject name={subject} leagueAccent={leagueAccent} />}
        <HeroBadge value={String(recordValue)} label={metric} accent={ACCENT} compact />
        <PanelFlag accent={ACCENT}>Verified</PanelFlag>
      </Panel>
    );
  }

  // 180_MILESTONE
  const career180s = num(data, "career180s");
  if (career180s !== null) {
    const thrownTonight = num(data, "matchThrown180s");
    if (big) {
      return (
        <BigPanel accent={ACCENT} fill={false}>
          <BigPanelHeader icon="🎯" kind="180" leagueType={leagueType} accent={ACCENT} />
          {subject && <Subject name={subject} leagueAccent={leagueAccent} big />}
          <BigHeroNumber value={String(career180s)} label="180s This Season" accent={ACCENT} />
          {thrownTonight !== null && <BigLine>{thrownTonight} thrown tonight</BigLine>}
        </BigPanel>
      );
    }
    return (
      <Panel accent={ACCENT} compact>
        <PanelTag icon="🎯" kind="180" leagueType={leagueType} accent={ACCENT} compact />
        {subject && <Subject name={subject} leagueAccent={leagueAccent} />}
        <HeroBadge value={String(career180s)} label="180s This Season" accent={ACCENT} compact />
        {thrownTonight !== null && <PanelLine>{thrownTonight} thrown tonight</PanelLine>}
      </Panel>
    );
  }

  // CAREER_MATCH_MILESTONE / CAREER_WIN_MILESTONE / ELIMINATION_MILESTONE
  const careerGamesPlayed = num(data, "careerGamesPlayed");
  const careerWins = num(data, "careerWins");
  const careerEliminations = num(data, "careerEliminations");
  if (careerGamesPlayed !== null || careerWins !== null || careerEliminations !== null) {
    const [value, label] =
      careerGamesPlayed !== null ? [careerGamesPlayed, "Career Matches"]
      : careerWins !== null ? [careerWins, "Career Wins"]
      : [careerEliminations, "Career Eliminations"];
    if (big) {
      return (
        <BigPanel accent={ACCENT} fill={false}>
          <BigPanelHeader icon="🎖️" kind="Milestone" leagueType={leagueType} accent={ACCENT} />
          {subject && <Subject name={subject} leagueAccent={leagueAccent} big />}
          <BigHeroNumber value={String(value)} label={label as string} accent={ACCENT} />
        </BigPanel>
      );
    }
    return (
      <Panel accent={ACCENT} compact>
        <PanelTag icon="🎖️" kind="Milestone" leagueType={leagueType} accent={ACCENT} compact />
        {subject && <Subject name={subject} leagueAccent={leagueAccent} />}
        <HeroBadge value={String(value)} label={label as string} accent={ACCENT} compact />
      </Panel>
    );
  }

  // CLINICAL_FINISHING / DOUBLE_TROUBLE — checkout rate vs own baseline.
  const checkoutRate = num(data, "checkoutRate");
  if (checkoutRate !== null) {
    const attempts = num(data, "checkoutAttempts");
    const baseline = num(data, "ownBaselineCheckoutRate");
    const clinical = baseline !== null ? checkoutRate > baseline : true;
    const tone = clinical ? "#22c55e" : "#ff005c";
    if (big) {
      return (
        <BigPanel accent={tone} fill={false}>
          <BigPanelHeader icon={clinical ? "🎯" : "🌧️"} kind={clinical ? "Clinical Finishing" : "Double Trouble"} leagueType={leagueType} accent={tone} />
          {subject && <Subject name={subject} leagueAccent={leagueAccent} big />}
          <BigHeroNumber value={pct(checkoutRate)} label={attempts !== null ? `Checkout, ${attempts} Tries` : "Checkout Rate"} accent={tone} />
          {baseline !== null && <BigLine>Own baseline: {pct(baseline)}</BigLine>}
        </BigPanel>
      );
    }
    return (
      <Panel accent={tone} compact>
        <PanelTag icon={clinical ? "🎯" : "🌧️"} kind={clinical ? "Clinical Finishing" : "Double Trouble"} leagueType={leagueType} accent={tone} compact />
        {subject && <Subject name={subject} leagueAccent={leagueAccent} />}
        <HeroBadge value={pct(checkoutRate)} label={attempts !== null ? `Checkout, ${attempts} Tries` : "Checkout Rate"} accent={tone} compact />
        {baseline !== null && <PanelLine>Own baseline: {pct(baseline)}</PanelLine>}
      </Panel>
    );
  }

  // SCORING_POWER
  const scoringRate30 = num(data, "scoringRate30");
  const scoringPercentile = num(data, "scoringPercentile");
  if (scoringRate30 !== null) {
    if (big) {
      return (
        <BigPanel accent={ACCENT}>
          <BigPanelHeader icon="📈" kind="Scoring Power" leagueType={leagueType} accent={ACCENT} />
          {subject && <Subject name={subject} leagueAccent={leagueAccent} big />}
          <BigHeroNumber value={scoringRate30.toFixed(1)} label="Per 30 Darts" accent={ACCENT} />
          {scoringPercentile !== null && <BigRow label="League Percentile" valueLabel={pct(scoringPercentile)} fraction={scoringPercentile} accent={ACCENT} />}
        </BigPanel>
      );
    }
    return (
      <Panel accent={ACCENT} compact>
        <PanelTag icon="📈" kind="Scoring Power" leagueType={leagueType} accent={ACCENT} compact />
        {subject && <Subject name={subject} leagueAccent={leagueAccent} />}
        <HeroBadge value={scoringRate30.toFixed(1)} label="Per 30 Darts" accent={ACCENT} compact />
        {scoringPercentile !== null && <PanelBar label="League Percentile" valueLabel={pct(scoringPercentile)} fraction={scoringPercentile} accent={ACCENT} compact />}
      </Panel>
    );
  }

  // SCORING_WITHOUT_FINISHING — dual percentile read, no single rate given.
  if (scoringPercentile !== null) {
    const checkoutPercentile = num(data, "checkoutPercentile");
    if (big) {
      return (
        <BigPanel accent="#ff005c">
          <BigPanelHeader icon="🌧️" kind="Scoring, No Finish" leagueType={leagueType} accent="#ff005c" />
          {subject && <Subject name={subject} leagueAccent={leagueAccent} big />}
          <div className="flex flex-col gap-3">
            <BigRow label="Scoring Percentile" valueLabel={pct(scoringPercentile)} fraction={scoringPercentile} accent="#22c55e" delay={0} />
            {checkoutPercentile !== null && <BigRow label="Checkout Percentile" valueLabel={pct(checkoutPercentile)} fraction={checkoutPercentile} accent="#ff005c" delay={1} />}
          </div>
        </BigPanel>
      );
    }
    return (
      <Panel accent="#ff005c" compact>
        <PanelTag icon="🌧️" kind="Scoring, No Finish" leagueType={leagueType} accent="#ff005c" compact />
        {subject && <Subject name={subject} leagueAccent={leagueAccent} />}
        <PanelBar label="Scoring Percentile" valueLabel={pct(scoringPercentile)} fraction={scoringPercentile} accent="#22c55e" compact />
        {checkoutPercentile !== null && <PanelBar label="Checkout Percentile" valueLabel={pct(checkoutPercentile)} fraction={checkoutPercentile} accent="#ff005c" compact />}
      </Panel>
    );
  }

  // ELIMINATION / DROUGHT_ENDED — a result strip with a streak/stake context.
  const winnerName = str(data, "winnerName");
  const loserName = str(data, "loserName");
  if (winnerName && loserName) {
    const endedLossStreak = num(data, "endedLossStreak");
    const stake = num(data, "stake");
    const droughtEnded = endedLossStreak !== null;
    const tone = droughtEnded ? "#22c55e" : "#ff005c";
    if (big) {
      return (
        <BigPanel accent={tone} fill={false}>
          <BigPanelHeader icon={droughtEnded ? "☀️" : "❌"} kind={droughtEnded ? "Drought Ended" : "Eliminated"} leagueType={leagueType} accent={tone} />
          <div className="flex items-baseline gap-3">
            <span className="font-black uppercase truncate" style={{ color: leagueAccent, fontSize: "1.7rem" }}>{winnerName}</span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.9rem" }}>beat</span>
            <span className="font-bold uppercase truncate" style={{ color: "rgba(255,255,255,0.55)", fontSize: "1.4rem" }}>{loserName}</span>
          </div>
          {droughtEnded && <BigLine>Ended a {endedLossStreak}-match losing run</BigLine>}
          {!droughtEnded && stake !== null && <BigLine>{stake} points on the line</BigLine>}
        </BigPanel>
      );
    }
    return (
      <Panel accent={tone} compact>
        <PanelTag icon={droughtEnded ? "☀️" : "❌"} kind={droughtEnded ? "Drought Ended" : "Eliminated"} leagueType={leagueType} accent={tone} compact />
        <div className="flex items-baseline gap-2">
          <span className="font-black uppercase truncate" style={{ color: leagueAccent, fontSize: "0.95rem" }}>{winnerName}</span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.66rem" }}>beat</span>
          <span className="font-bold uppercase truncate" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>{loserName}</span>
        </div>
        {droughtEnded && <PanelLine>Ended a {endedLossStreak}-match losing run</PanelLine>}
        {!droughtEnded && stake !== null && <PanelLine>{stake} points on the line</PanelLine>}
      </Panel>
    );
  }

  // PAIR_ELIMINATED — teams, no extra context fact.
  const winnerTeamName = str(data, "winnerTeamName");
  const loserTeamName = str(data, "loserTeamName");
  if (winnerTeamName && loserTeamName) {
    if (big) {
      return (
        <BigPanel accent="#ff005c" fill={false}>
          <BigPanelHeader icon="❌" kind="Eliminated" leagueType={leagueType} accent="#ff005c" />
          <div className="flex items-baseline gap-3">
            <span className="font-black uppercase truncate" style={{ color: leagueAccent, fontSize: "1.7rem" }}>{winnerTeamName}</span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.9rem" }}>beat</span>
            <span className="font-bold uppercase truncate" style={{ color: "rgba(255,255,255,0.55)", fontSize: "1.4rem" }}>{loserTeamName}</span>
          </div>
        </BigPanel>
      );
    }
    return (
      <Panel accent="#ff005c" compact>
        <PanelTag icon="❌" kind="Eliminated" leagueType={leagueType} accent="#ff005c" compact />
        <div className="flex items-baseline gap-2">
          <span className="font-black uppercase truncate" style={{ color: leagueAccent, fontSize: "0.95rem" }}>{winnerTeamName}</span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.66rem" }}>beat</span>
          <span className="font-bold uppercase truncate" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>{loserTeamName}</span>
        </div>
      </Panel>
    );
  }

  // SEASON_COMPARISON — this year vs last, win rate and/or position.
  const currentSeasonWinRate = num(data, "currentSeasonWinRate");
  if (currentSeasonWinRate !== null) {
    const previousSeasonWinRate = num(data, "previousSeasonWinRate");
    const currentSeasonPosition = num(data, "currentSeasonPosition");
    const previousSeasonFinalPosition = num(data, "previousSeasonFinalPosition");
    const improved = bool(data, "improved");
    const tone = improved ? "#22c55e" : "#ff005c";
    // currentSeasonName/previousSeasonName: absent on a comparison detected
    // before these facts existed (this story type is never re-detected once
    // its season closes, so old rows never gain them) — falls back to the
    // old generic "last season" wording rather than showing nothing. See
    // story-detectors-archive.ts's own comment on why several different
    // SEASON_COMPARISON stories, each genuinely about a different pair of
    // months, used to be impossible to tell apart on screen.
    const previousSeasonLabel = str(data, "previousSeasonName") ?? "last season";
    if (big) {
      return (
        <BigPanel accent={tone} fill={false}>
          <BigPanelHeader icon={improved ? "📈" : "📉"} kind="Season vs Season" leagueType={leagueType} accent={tone} />
          {subject && <Subject name={subject} leagueAccent={leagueAccent} big />}
          {currentSeasonPosition !== null && previousSeasonFinalPosition !== null ? (
            <BigMove before={`P${previousSeasonFinalPosition}`} after={`P${currentSeasonPosition}`} accent={tone} improved={improved} />
          ) : (
            <BigHeroNumber value={pct(currentSeasonWinRate)} label="Win Rate" accent={tone} />
          )}
          {previousSeasonWinRate !== null && <BigLine>Was {pct(previousSeasonWinRate)} in {previousSeasonLabel}</BigLine>}
        </BigPanel>
      );
    }
    return (
      <Panel accent={tone} compact>
        <PanelTag icon={improved ? "📈" : "📉"} kind="Season vs Season" leagueType={leagueType} accent={tone} compact />
        {subject && <Subject name={subject} leagueAccent={leagueAccent} />}
        {currentSeasonPosition !== null && previousSeasonFinalPosition !== null ? (
          <div className="flex items-center gap-2">
            <span className="font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.4)", fontSize: "1rem", textDecoration: "line-through", textDecorationColor: "rgba(255,255,255,0.25)" }}>P{previousSeasonFinalPosition}</span>
            <span aria-hidden="true" style={{ color: tone, fontSize: "0.9rem" }}>{improved ? "↗" : "↘"}</span>
            <span className="font-black tabular-nums" style={{ color: tone, fontSize: "1.4rem" }}>P{currentSeasonPosition}</span>
          </div>
        ) : (
          <HeroBadge value={pct(currentSeasonWinRate)} label="Win Rate" accent={tone} compact />
        )}
        {previousSeasonWinRate !== null && <PanelLine>Was {pct(previousSeasonWinRate)} in {previousSeasonLabel}</PanelLine>}
      </Panel>
    );
  }

  // SEASON_RECAP — the season that just closed, in real numbers: how many
  // matches were actually played, and who won the most of them.
  const matchesPlayed = num(data, "matchesPlayed");
  if (matchesPlayed !== null) {
    const topWins = num(data, "topWins");
    const topEntityName = str(data, "topEntityName");
    const seasonLabel = str(data, "seasonName");
    if (big) {
      return (
        <BigPanel accent={ACCENT} fill={false}>
          <BigPanelHeader icon="📋" kind="Season Recap" leagueType={leagueType} accent={ACCENT} />
          <BigHeroNumber value={String(matchesPlayed)} label={seasonLabel ? `Matches Played, ${seasonLabel}` : "Matches Played"} accent={ACCENT} />
          {topEntityName && topWins !== null && <BigLine>{topEntityName} led the way with {topWins} wins</BigLine>}
        </BigPanel>
      );
    }
    return (
      <Panel accent={ACCENT} compact>
        <PanelTag icon="📋" kind="Season Recap" leagueType={leagueType} accent={ACCENT} compact />
        <HeroBadge value={String(matchesPlayed)} label="Matches Played" accent={ACCENT} compact />
        {topEntityName && topWins !== null && <PanelLine>{topEntityName}: {topWins} wins</PanelLine>}
      </Panel>
    );
  }

  // Unrecognised shape (FILLER story types, or a future addition to this
  // catch-all) — the old generic chip grid, so there's still something
  // real on screen rather than nothing.
  return <GraphicFrame kind="Result" icon="🏆" accent={ACCENT} leagueType={leagueType} data={data} highlightKeys={["value", "points", "count", "milestone"]} compact={compact} />;
}
