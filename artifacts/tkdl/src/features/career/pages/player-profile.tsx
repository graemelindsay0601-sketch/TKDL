import { Link } from "wouter";
import { ArrowLeft, ArrowUpRight, Medal, Swords } from "lucide-react";
import { useCareerLife, useCareerRelationships, useNpcLegacy, useNpcLife, useWorldPlayers } from "../api";
import { CareerSection } from "../components";
import type { ShellContext } from "../shell";
import { CareerShirt, type ShirtIdentity } from "../identity";
import { CareerStageBackdrop, resolveAtmosphere, spectacleFor } from "../atmosphere";
import { CareerPageHero } from "../page-hero";
import { country } from "../model";
import "./player-profile.css";

type ProfileProps = { ctx: ShellContext; npcId: string };
type SponsorRecord = {
  id: string;
  sponsorKey: string;
  category: string;
  status: string;
  start: { season: number; week: number };
  end: { season: number; week: number } | null;
  sponsor?: {
    displayName?: string;
    shortName?: string;
    commercialTier?: string;
    representative?: { displayName?: string; role?: string };
  };
};

const saveRoot = (ctx: ShellContext) => `/career/${ctx.save.id}`;
const seasonWeek = (period: { season: number; week: number }) => `S${period.season} · W${period.week}`;

function sponsorRecords(value: unknown): SponsorRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SponsorRecord =>
    !!item && typeof item === "object" &&
    typeof (item as SponsorRecord).id === "string" &&
    typeof (item as SponsorRecord).sponsorKey === "string" &&
    typeof (item as SponsorRecord).status === "string" &&
    !!(item as SponsorRecord).start && typeof (item as SponsorRecord).start.season === "number" &&
    typeof (item as SponsorRecord).start.week === "number",
  );
}

export function WorldPlayerProfile({ ctx, npcId }: ProfileProps) {
  const base = saveRoot(ctx);
  const playerQuery = useWorldPlayers(ctx.save.id, 0, "", "ALL", npcId);
  const lifeQuery = useNpcLife(ctx.save.id, npcId);
  const legacyQuery = useNpcLegacy(ctx.save.id, npcId);
  const relationshipsQuery = useCareerRelationships(ctx.save.id);
  const careerLifeQuery = useCareerLife(ctx.save.id);
  const player = playerQuery.data?.players.find(candidate => candidate.id === npcId);
  const country = typeof player?.country === "string" ? player.country : null;
  const region = typeof player?.region === "string" ? player.region : null;
  const nickname = typeof player?.nickname === "string" ? player.nickname : null;
  const identity = relationshipsQuery.data?.world.players.find(candidate => candidate.id === npcId);
  const persistedSponsors = sponsorRecords(player?.sponsorshipFoundation?.relationships);
  const confirmedProfile = !!player;

  return <CareerSection title="Darts World · Player profile">
    <div className="tkdl-player-profile px-3 sm:px-4">
      <Link className="player-back" href={`${base}/world/players`}><ArrowLeft size={15} aria-hidden /> All world players</Link>
      {playerQuery.isLoading && <LoadingPanel label="Loading verified player identity" />}
      {playerQuery.error && <ErrorPanel title="Player identity unavailable" error={playerQuery.error} onRetry={() => void playerQuery.refetch()} />}
      {!playerQuery.isLoading && !playerQuery.error && !confirmedProfile && <div className="player-panel player-empty" role="status">
        This player ID is not present in the saved Darts World directory. No profile is assembled from partial or guessed identity data.
      </div>}
      {player && <>
        <header className="player-profile-head player-profile-head--stage">
          {/* G1: the player's real stature — ranked professionals on the tour floor, others in a club room; retired players in archive grade. */}
          {(() => { const stage = resolveAtmosphere({ eventClass: player.ranking !== null ? "PROFESSIONAL_TOUR" : "GRASSROOTS" });
            return <CareerStageBackdrop atmosphere={stage} spectacle={spectacleFor("ARRIVAL", stage.level)} documentary={player.status === "RETIRED"} animate={false} eager />; })()}
          <div className="player-profile-head__row">
          {player.shirt && <span className="player-portrait" aria-hidden="true"><CareerShirt playerId={player.id} identity={player.shirt as ShirtIdentity} name={player.name} scale="featured" /></span>}
          <div className="player-profile-head__text">
          <div className="player-eyebrow">Saved Darts World identity</div>
          <h1 className="player-name">{player.name}</h1>
          <div className="player-facts">
            <span className="player-fact">{player.status === "RETIRED" ? "Retired" : player.status === "ACTIVE" ? "Active" : "Status unavailable"}</span>
            {country && <span className="player-fact">{country}</span>}
            {region && <span className="player-fact">{region}</span>}
            <span className="player-fact">{player.ranking === null ? "No current World Ranking" : `World #${player.ranking}`}</span>
            {identity && <span className="player-fact">{identity.age} years old</span>}
          </div>
          <div className="player-link-list">
            {identity && <span className="player-fact">{identity.status === "RETIRED" && identity.retiredSeason !== null ? `Retired after Season ${identity.retiredSeason}` : `Entered Season ${identity.createdSeason}`}</span>}
            {nickname && <span className="player-fact">“{nickname}”</span>}
          </div>
        </div></div>
        </header>

        <div className="player-profile-grid">
          <section className="player-panel">
            <h2>Career record</h2>
            {legacyQuery.isLoading && <LoadingLines label="Loading career record" />}
            {legacyQuery.error && <ErrorPanel title="Career history unavailable" error={legacyQuery.error} onRetry={() => void legacyQuery.refetch()} />}
            {!legacyQuery.isLoading && !legacyQuery.error && legacyQuery.data?.totals && <div className="player-metric-grid">
              <Metric label="Appearances" value={legacyQuery.data.totals.appearances} />
              <Metric label="Titles" value={legacyQuery.data.totals.titles} />
              <Metric label="Finals" value={legacyQuery.data.totals.finals} />
              <Metric label="Wins / losses" value={`${legacyQuery.data.totals.wins} / ${legacyQuery.data.totals.losses}`} />
            </div>}
            {!legacyQuery.isLoading && !legacyQuery.error && !legacyQuery.data?.totals && <Empty text="No results for this player yet." />}
            {legacyQuery.data?.rankings.length ? <div className="player-record-row mt-3">
              <strong>Recorded ranking snapshots</strong>
              <small>{legacyQuery.data.rankings.slice().sort((a, b) => b.season - a.season || b.week - a.week).slice(0, 5).map(rank => `S${rank.season} W${rank.week}: #${rank.position}`).join(" · ")}</small>
            </div> : null}
          </section>

          <section className="player-panel">
            <h2>Public standing</h2>
            {lifeQuery.isLoading && <LoadingLines label="Loading public player profile" />}
            {lifeQuery.error && <ErrorPanel title="Public profile unavailable" error={lifeQuery.error} onRetry={() => void lifeQuery.refetch()} />}
            {!lifeQuery.isLoading && !lifeQuery.error && lifeQuery.data && <>
              <div className="player-record-row"><strong>{lifeQuery.data.standing}</strong><small>Standing returned by Career Life</small></div>
              <div className="player-record-row"><strong>{lifeQuery.data.publicDraw}</strong><small>Public draw returned by Career Life</small></div>
              <p>{lifeQuery.data.retired ? "Career Life marks this player as retired." : "Career Life marks this player as active."}</p>
              {lifeQuery.data.notes && <p>{lifeQuery.data.notes}</p>}
            </>}
          </section>

          <section className="player-panel">
            <h2><Medal size={17} className="inline-block mr-2 align-[-3px]" aria-hidden />Honours</h2>
            {legacyQuery.isLoading && <LoadingLines label="Loading honours" />}
            {legacyQuery.error && <p className="player-empty">Honours are unavailable until the history read succeeds.</p>}
            {!legacyQuery.isLoading && !legacyQuery.error && legacyQuery.data?.awards.length ? <div className="player-row-list">
              {legacyQuery.data.awards.map((award, index) => <div className="player-record-row" key={`${award.kind}-${award.season}-${award.name}-${index}`}>
                <strong>{award.name}</strong><small>{award.kind.replaceAll("_", " ")} · Season {award.season}{award.reason ? ` · ${award.reason}` : ""}</small>
              </div>)}
            </div> : null}
            {!legacyQuery.isLoading && !legacyQuery.error && !legacyQuery.data?.awards.length && <Empty text="No titles yet." />}
            {!!legacyQuery.data?.titles.length && <div className="player-record-row mt-3">
              <h3>Recorded championships</h3>
              <ul className="player-row-list">{legacyQuery.data.titles.slice(0, 6).map(result => <li className="player-record-row" key={result.id}>
                <strong>{result.name}</strong>
                <small>Season {result.season} · {result.circuit} · Champion</small>
                <Link className="player-event-link" href={`${base}/world/events/${encodeURIComponent(result.key)}`}>Event family details <ArrowUpRight className="inline" size={13} aria-hidden /></Link>
              </li>)}</ul>
            </div>}
          </section>

          <section className="player-panel player-panel--wide">
            <h2>Sponsor relationships</h2>
            {player.sponsorshipFoundation?.source === "PERSISTED_SP_A" && persistedSponsors.length > 0 ? <>
              <p>Who sponsors this player, and for how long.</p>
              <div className="player-row-list">{persistedSponsors.map(record => <div className="player-record-row" key={record.id}>
                <strong>{record.sponsor?.displayName ?? record.sponsorKey}</strong>
                <small>{record.category.replaceAll("_", " ")} · {record.status.toLowerCase()} · Began {seasonWeek(record.start)}{record.end ? ` · Ended ${seasonWeek(record.end)}` : ""}</small>
                {record.sponsor?.commercialTier && <small>{record.sponsor.commercialTier.toLowerCase()} tier</small>}
                {record.sponsor?.representative?.displayName && <small>Recorded representative: {record.sponsor.representative.displayName}</small>}
              </div>)}</div>
            </> : player.sponsorshipFoundation?.source === "PERSISTED_SP_A" ? <Empty text="No sponsors." /> :
              <Empty text="This Career save has no persisted sponsor-history record for this player. No commercial portfolio is substituted for saved agreement history." />}
          </section>

          <section className="player-panel">
            <h2><Swords size={17} className="inline-block mr-2 align-[-3px]" aria-hidden />Head-to-head</h2>
            <RivalryProfile ctx={ctx} npcId={npcId} />
          </section>

          <section className="player-panel">
            <h2>Career Life stories</h2>
            {careerLifeQuery.isLoading && <LoadingLines label="Loading linked Career stories" />}
            {careerLifeQuery.error && <ErrorPanel title="Career stories unavailable" error={careerLifeQuery.error} onRetry={() => void careerLifeQuery.refetch()} />}
            {!careerLifeQuery.isLoading && !careerLifeQuery.error && (() => {
              const stories = careerLifeQuery.data?.news.filter(story => story.opponentId === npcId) ?? [];
              return stories.length ? <div className="player-row-list">
                {stories.slice(0, 5).map(story => <div className="player-record-row" key={story.id}>
                  <strong>{story.title}</strong>
                  <small>Season {story.season}{story.week === null ? "" : ` · Week ${story.week}`} · {story.significance.toLowerCase()}</small>
                  <p>{story.body}</p>
                  <Link className="player-event-link" href={`${base}/world/news`}>Open Career newsroom <ArrowUpRight className="inline" size={13} aria-hidden /></Link>
                </div>)}
              </div> : <Empty text="No Career Life stories returned for this opponent." />;
            })()}
          </section>
        </div>
      </>}
    </div>
  </CareerSection>;
}

/** Standalone head-to-head route (/world/rivalries/:npcId): opponent hero over the shared H2H record. */
export function RivalryPage({ ctx, npcId }: ProfileProps) {
  const relationships = useCareerRelationships(ctx.save.id);
  const relationship = relationships.data?.opponents.find(opponent => opponent.player.id === npcId);
  const base = saveRoot(ctx);
  const p = relationship?.player;
  return <div className="tkdl-player-profile space-y-3">
    {relationship && p && <CareerPageHero kicker="Head-to-head" title={p.name} accent="#ff7a93" stage={{ venue: { venueType: "studio" }, eventClass: "PROFESSIONAL_TOUR" }}
      watermark={`${relationship.humanWins}–${relationship.npcWins}`}
      subtitle={<p>{[country(p.nationality)?.name ?? p.nationality, `Age ${p.age}`, p.worldRanking ? `World #${p.worldRanking}` : "Unranked", p.status === "RETIRED" ? "Retired" : null].filter(Boolean).join(" · ")}</p>}
      portrait={<CareerShirt playerId={p.id} name={p.name} scale="featured" />}
      actions={<Link className="career-btn" href={`${base}/world/players/${encodeURIComponent(p.id)}/profile`}>Full player profile</Link>}
      stats={[
        { label: "Meetings", value: relationship.meetings, sub: `${relationship.eventCount} events · ${relationship.seasonCount} ${relationship.seasonCount === 1 ? "season" : "seasons"}` },
        { label: "Your wins", value: relationship.humanWins, tone: "good" },
        { label: "Their wins", value: relationship.npcWins, tone: relationship.npcWins > relationship.humanWins ? "bad" : "neutral" },
        { label: "Win rate", value: relationship.winPercentage === null ? "—" : `${relationship.winPercentage}%`, sub: `${relationship.finals} ${relationship.finals === 1 ? "final" : "finals"} · ${relationship.majorMeetings} major/world`, tone: "gold" },
      ]} />}
    <section className="player-panel">
      <h2><Swords size={17} className="inline-block mr-2 align-[-3px]" aria-hidden />Played record</h2>
      <RivalryProfile ctx={ctx} npcId={npcId} compact={!!relationship} />
    </section>
  </div>;
}

export function RivalryProfile({ ctx, npcId, compact = false }: ProfileProps & { compact?: boolean }) {
  const relationships = useCareerRelationships(ctx.save.id);
  const relationship = relationships.data?.opponents.find(opponent => opponent.player.id === npcId);
  const base = saveRoot(ctx);

  if (relationships.isLoading) return <LoadingLines label="Loading opponent relationship history" />;
  if (relationships.error) return <ErrorPanel title="Head-to-head unavailable" error={relationships.error} onRetry={() => void relationships.refetch()} />;
  if (!relationship) return <Empty text="No played head-to-head or relationship record is returned for this opponent. No rivalry is inferred." />;

  return <div>
    {relationship.labels.length ? <div className="player-tag-list mb-3">{relationship.labels.map(label => <span className="player-tag" key={label}>{label}</span>)}</div> : <p>Nothing special between you yet.</p>}
    {!compact && <><div className="player-metric-grid">
      <Metric label="Meetings" value={relationship.meetings} />
      <Metric label="Wins" value={relationship.humanWins} />
      <Metric label="Opponent wins" value={relationship.npcWins} />
      <Metric label="Win rate" value={relationship.winPercentage === null ? "Not available" : `${relationship.winPercentage}%`} />
    </div>
    <p>{relationship.eventCount} events · {relationship.seasonCount} seasons · {relationship.finals} finals · {relationship.majorMeetings} major/world meetings · {relationship.qualificationMeetings} qualification meetings</p></>}
    {!!relationship.evidence.length && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-stone-600">{relationship.evidence.map(item => <li key={item}>{item}</li>)}</ul>}
    <h3>Played meetings</h3>
    {relationship.history.length ? <div className="player-row-list">
      {relationship.history.map(meeting => <div className="player-record-row" key={meeting.id}>
        <Link className="player-event-link" href={`${base}/events/${encodeURIComponent(meeting.eventId)}`}>{meeting.date ?? `Season ${meeting.season}, day ${meeting.day}`} · {meeting.name} <ArrowUpRight className="inline" size={13} aria-hidden /></Link>
        <small>{meeting.won ? "Career player won" : "Opponent won"} · {meeting.stage} · Round {meeting.round}{meeting.final ? " · Final" : ""}{meeting.major ? " · Major / world" : ""}{meeting.qualification ? " · Qualification" : ""}
          {meeting.legsHuman === null || meeting.legsNpc === null ? "" : ` · Legs ${meeting.legsHuman}–${meeting.legsNpc}`}
          {meeting.setsHuman === null || meeting.setsNpc === null ? "" : ` · Sets ${meeting.setsHuman}–${meeting.setsNpc}`}</small>
      </div>)}
    </div> : <Empty text="You haven't played each other yet." />}
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="player-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="player-empty" role="status">{text}</div>;
}

function LoadingPanel({ label }: { label: string }) {
  return <section className="player-panel player-panel--dark" role="status" aria-label={label}><LoadingLines label={label} /></section>;
}

function LoadingLines({ label }: { label: string }) {
  return <div className="player-loading-lines" role="status" aria-label={label}>
    <span /><span /><span /><span className="sr-only">{label}</span>
  </div>;
}

function ErrorPanel({ title, error, onRetry }: { title: string; error: unknown; onRetry: () => void }) {
  const message = error instanceof Error ? error.message : "A temporary data error occurred.";
  return <div className="player-status" role="alert">
    <strong>{title}</strong><p className="my-1">{message}</p>
    <button type="button" className="player-link" onClick={onRetry}>Retry</button>
  </div>;
}
