import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "wouter";
import { Award, BadgeCheck, Briefcase, ChevronLeft, ChevronRight, Clapperboard, Crown, Film, Flag, Medal, RotateCcw, SkipForward, Star, Swords, TrendingUp, Trophy, X } from "lucide-react";
import { useCareerProfile, useLegacy, usePresentation, useSeasonReview, useSporting, useTrophyCabinet } from "../api";
import { BoundedList, CareerError, CareerLoading, Label, OSWALD, QueryState, StatusBadge } from "../components";
import { CareerEventIdentity, CareerPlayerCard } from "../identity";
import { AwardPresentation } from "../trophies";
import { CareerStageBackdrop, resolveAtmosphere, spectacleFor } from "../atmosphere";
import { formatPence, ordinal } from "../model";
import type { ShellContext } from "../shell";
import { usePlayerLegacy, type Chapter, type Moment, type PlayerLegacy, type SeasonRow } from "./api";
import "./player-legacy.css";

const KIND_ICON: Record<string, ReactNode> = {
  MAJOR_TITLE: <Crown size={16} aria-hidden />, TITLE: <Trophy size={16} aria-hidden />, FINAL: <Medal size={16} aria-hidden />, BIG_STAGE: <Star size={16} aria-hidden />,
  BEST_RANKING: <TrendingUp size={16} aria-hidden />, FIRST_RANKING: <TrendingUp size={16} aria-hidden />, FIRST_CARD: <BadgeCheck size={16} aria-hidden />,
  FIRST_TITLE: <Trophy size={16} aria-hidden />, FIRST_FINAL: <Medal size={16} aria-hidden />, FIRST_MAJOR: <Crown size={16} aria-hidden />, FIRST_EVENT: <Flag size={16} aria-hidden />,
  RIVAL: <Swords size={16} aria-hidden />, SPONSOR: <Briefcase size={16} aria-hidden />, PRODUCT: <Briefcase size={16} aria-hidden />, MERCH: <Briefcase size={16} aria-hidden />,
  INCOME: <Briefcase size={16} aria-hidden />, RETIRED: <Film size={16} aria-hidden />,
};
const icon = (kind: string) => KIND_ICON[kind] ?? <Star size={16} aria-hidden />;
const eventHref = (saveId: string, m: Moment) => m.eventId ? `/career/${saveId}/events/${m.eventId}` : null;

// ---------------------------------------------------------------- D1 profile
/** The player's long-term profile. Not a dashboard: identity, standing and honours. */
export function PlayerLegacyProfile({ ctx }: { ctx: ShellContext }) {
  const id = ctx.save.id;
  const legacy = usePlayerLegacy(id), sporting = useSporting(id, !ctx.retired), profile = useCareerProfile(id), presentation = usePresentation(id);
  if (legacy.isLoading) return <CareerLoading label="Reading your Career record" />;
  if (legacy.error || !legacy.data) return <CareerError error={legacy.error} onRetry={() => legacy.refetch()} />;
  const v = legacy.data;
  const rank = sporting.data?.worldRanking.standing?.position ?? null;
  const card = sporting.data?.tourCard.holdsCard ?? false;
  const name = profile.data?.displayName ?? v.name;
  const status = ctx.retired ? "Retired" : card ? "Tour Card professional" : v.seasons.some(s => s.tourCard) ? "Former Tour Card holder" : "Open circuit";
  const firsts = Object.values(v.firsts).filter((m): m is Moment => !!m).sort((a, b) => (a.season ?? 0) - (b.season ?? 0));
  return (
    <div className="pl-stack">
      <section className={`pl-hero${ctx.retired ? " is-retired" : ""}`} aria-label={`${name} Career profile`}>
        <div className="pl-hero__card">
          <CareerPlayerCard name={name} nickname={presentation.data?.identity.nickname} identity={presentation.data?.identity}
            sponsors={presentation.data?.placements} scale="profile" />
        </div>
        <div className="pl-hero__body">
          <p className="pl-eyebrow">{ctx.retired ? "Career archive · read-only" : `Season ${ctx.save.currentSeason} · ${status}`}</p>
          <h1 className="pl-hero__name" style={OSWALD}>{name}</h1>
          {typeof presentation.data?.identity.nickname === "string" && presentation.data.identity.nickname && <p className="pl-hero__nick">“{presentation.data.identity.nickname}”</p>}
          <div className="pl-chips">
            <StatusBadge label={status} tone={ctx.retired ? "muted" : card ? "success" : "neutral"} />
            {!ctx.retired && <StatusBadge label={rank ? `World #${rank}` : "Unranked"} tone={rank ? "info" : "muted"} />}
            {v.bestRanking && <StatusBadge label={`Career high #${v.bestRanking.position}`} tone="gold" />}
            {profile.data?.status === "COMPLETE" && <StatusBadge label={`Age ${profile.data.age}`} tone="muted" />}
          </div>
          <dl className="pl-stats">
            <Stat label="Titles" value={v.totals.titles} /><Stat label="Finals" value={v.totals.finals} />
            <Stat label="Major / World" value={v.totals.majorTitles} /><Stat label="Seasons" value={v.totals.seasons} />
            <Stat label="Match record" value={`${v.totals.wins}–${v.totals.losses}`} /><Stat label="Prize money" value={formatPence(v.totals.prizePence)} />
          </dl>
          {ctx.retired && <Link href={`/career/${id}/my-career/remembered`} className="career-btn career-btn-gold pl-hero__cta"><Clapperboard size={16} aria-hidden /> Watch A Career Remembered</Link>}
        </div>
      </section>

      <section className="pl-panel" aria-label="Career landmarks">
        <h2 className="pl-panel__title"><Flag size={15} aria-hidden /> Career landmarks</h2>
        {firsts.length ? <ol className="pl-landmarks">{firsts.map(m => (
          <li key={m.kind}><span className="pl-landmarks__season">{m.season ? `S${m.season}` : "—"}</span>{icon(m.kind)}<div><strong>{m.label}</strong><small>{m.detail}</small></div></li>))}</ol>
          : <p className="pl-empty">No landmarks yet. Your first event, final, title, ranking and Tour Card will appear here as they happen.</p>}
      </section>

      <HonoursShelf saveId={id} legacy={v} />

      <nav className="pl-links" aria-label="Career record">
        <Link href={`/career/${id}/my-career/achievements`} className="career-surface"><Trophy size={16} aria-hidden /> Trophy cabinet</Link>
        <Link href={`/career/${id}/my-career/history`} className="career-surface"><Award size={16} aria-hidden /> Season history</Link>
        <Link href={`/career/${id}/journey`} className="career-surface"><TrendingUp size={16} aria-hidden /> Ranking journey</Link>
        <Link href={`/career/${id}/relationships`} className="career-surface"><Swords size={16} aria-hidden /> Opponents & rivals</Link>
        <Link href={`/career/${id}/finances`} className="career-surface"><Briefcase size={16} aria-hidden /> Finances & sponsors</Link>
        <Link href={`/career/${id}/presentation`} className="career-surface"><Star size={16} aria-hidden /> Shirt & identity</Link>
        <Link href={`/career/${id}/my-career/remembered`} className="career-surface"><Clapperboard size={16} aria-hidden /> A Career Remembered</Link>
      </nav>
    </div>
  );
}
const Stat = ({ label, value }: { label: string; value: ReactNode }) => <div><dt>{label}</dt><dd style={OSWALD}>{value}</dd></div>;

/** Latest titles with their real catalogue trophies; events without a trophy never get one. */
function HonoursShelf({ saveId, legacy }: { saveId: string; legacy: PlayerLegacy }) {
  const cabinet = useTrophyCabinet(saveId, 0);
  const shelf = (cabinet.data?.titles ?? []).filter(t => t.classification !== "QUALIFIER" && t.circuit !== "Q_SCHOOL").slice(0, 4);
  return (
    <section className="pl-panel" aria-label="Recent honours">
      <h2 className="pl-panel__title"><Trophy size={15} aria-hidden /> Recent honours</h2>
      {cabinet.isLoading ? <CareerLoading /> : cabinet.error ? <CareerError error={cabinet.error} onRetry={() => cabinet.refetch()} /> :
        shelf.length ? <div className="pl-shelf">{shelf.map(t => (
          <Link key={t.eventId} href={`/career/${saveId}/events/${t.eventId}`} className="pl-shelf__item">
            <AwardPresentation event={{ definitionKey: t.canonicalEventId, circuit: t.circuit, classification: t.classification }} persistedTrophyId={t.trophy?.id ?? null} size="sm" eventName={t.name} />
            <strong>{t.name}</strong><small>Season {t.season}{t.trophy ? ` · ${t.trophy.name}` : " · no trophy awarded"}</small>
          </Link>))}</div>
        : <p className="pl-empty">{legacy.totals.finals ? `${legacy.totals.finals} final${legacy.totals.finals === 1 ? "" : "s"} reached — the first title is still to come.` : "No titles yet. Nothing is shown until you actually win one."}</p>}
    </section>
  );
}

// ---------------------------------------------------------------- D2 trophy cabinet
export function TrophyCabinet({ ctx }: { ctx: ShellContext }) {
  const id = ctx.save.id;
  const [offset, setOffset] = useState(0);
  const cabinet = useTrophyCabinet(id, offset), legacy = usePlayerLegacy(id), archive = useLegacy(id);
  if (cabinet.isLoading || legacy.isLoading) return <CareerLoading label="Opening the trophy cabinet" />;
  if (cabinet.error || !cabinet.data) return <CareerError error={cabinet.error} onRetry={() => cabinet.refetch()} />;
  const titles = cabinet.data.titles;
  const isQualifier = (t: typeof titles[number]) => t.classification === "QUALIFIER" || t.circuit === "Q_SCHOOL";
  const major = titles.filter(t => !isQualifier(t) && ["MAJOR", "WORLD_CHAMPIONSHIP"].includes(t.circuit));
  const other = titles.filter(t => !isQualifier(t) && !["MAJOR", "WORLD_CHAMPIONSHIP"].includes(t.circuit));
  const sessions = titles.filter(isQualifier);
  const finals = legacy.data?.finals ?? [];
  const awards = (archive.data?.honours ?? []).filter(a => a.participant === "HUMAN");
  return (
    <div className="pl-stack">
      <header className="pl-cabinet-head">
        <p className="pl-eyebrow">Trophy cabinet</p>
        <h1 style={OSWALD}>{cabinet.data.total} {cabinet.data.total === 1 ? "title" : "titles"} won</h1>
        <p className="pl-dim">Every piece below is an actual A3 champion result. Repeat wins stay separate; events that award no trophy never get one.</p>
      </header>
      <Shelf title="Majors & World Championship" tone="gold" empty="No major or World title yet." items={major} saveId={id} />
      <Shelf title="Tournament titles" tone="silver" empty={major.length ? "No other titles on this page." : "No tournament titles yet."} items={other} saveId={id} />
      {sessions.length > 0 && <section className="pl-panel" aria-label="Qualifier and session wins">
        <h2 className="pl-panel__title"><BadgeCheck size={15} aria-hidden /> Qualifier & session wins</h2>
        <p className="pl-dim pl-small">Session and qualifier wins are recorded achievements, not championship titles, so no trophy is shown.</p>
        <ul className="pl-list">{sessions.map(t => <li key={t.eventId}><Link href={`/career/${id}/events/${t.eventId}`}>{t.name}</Link><span>Season {t.season}</span></li>)}</ul>
      </section>}
      <section className="pl-panel" aria-label="Finals">
        <h2 className="pl-panel__title"><Medal size={15} aria-hidden /> Runner-up finishes</h2>
        {finals.length ? <div className="pl-list" role="list"><BoundedList rows={finals} size={12}>{m => <div role="listitem" key={`${m.eventId}`}>{eventHref(id, m) ? <Link href={eventHref(id, m)!}>{m.label}</Link> : m.label}<span>{m.detail}</span></div>}</BoundedList></div>
          : <p className="pl-empty">No lost finals recorded.</p>}
      </section>
      <section className="pl-panel" aria-label="Season awards">
        <h2 className="pl-panel__title"><Award size={15} aria-hidden /> Season awards</h2>
        {archive.isLoading ? <CareerLoading /> : awards.length ? <ul className="pl-awards">{awards.map(a => <li key={`${a.season}:${a.kind}`}><Award size={18} aria-hidden />
          <div><strong>{a.kind.replace(/_/g, " ").toLowerCase().replace(/^\w/, x => x.toUpperCase())} · season {a.season}</strong><small>{a.reason}</small></div></li>)}</ul>
          : <p className="pl-empty">No season awards recorded. Awards are given only at the end of a completed season.</p>}
      </section>
      {(offset > 0 || cabinet.data.nextOffset !== null) && <div className="pl-pager">
        <button className="career-btn career-btn-ghost" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))}>Newer titles</button>
        <button className="career-btn career-btn-ghost" disabled={cabinet.data.nextOffset === null} onClick={() => cabinet.data!.nextOffset !== null && setOffset(cabinet.data!.nextOffset)}>Older titles</button>
      </div>}
    </div>
  );
}
type CabinetTitle = NonNullable<ReturnType<typeof useTrophyCabinet>["data"]>["titles"][number];
function Shelf({ title, tone, empty, items, saveId }: { title: string; tone: "gold" | "silver"; empty: string; items: CabinetTitle[]; saveId: string }) {
  const groups = useMemo(() => {
    const map = new Map<string, CabinetTitle[]>();
    for (const t of items) map.set(t.trophyIdentityId, [...(map.get(t.trophyIdentityId) ?? []), t]);
    return [...map.values()];
  }, [items]);
  return (
    <section className={`pl-shelf-panel is-${tone}`} aria-label={title}>
      <h2 className="pl-panel__title">{tone === "gold" ? <Crown size={15} aria-hidden /> : <Trophy size={15} aria-hidden />} {title}</h2>
      {groups.length ? <div className="pl-cabinet">{groups.map(g => {
        const t = g[0];
        return (
          <CareerEventIdentity key={t.trophyIdentityId} eventKey={t.canonicalEventId} circuit={t.circuit} className="pl-cabinet__item">
            <div className="pl-cabinet__trophy"><AwardPresentation event={{ definitionKey: t.canonicalEventId, circuit: t.circuit, classification: t.classification }} persistedTrophyId={t.trophy?.id ?? null} size="md" eventName={t.name} />
              {g.length > 1 && <span className="pl-cabinet__count" aria-label={`${g.length} wins`}>×{g.length}</span>}</div>
            <strong>{t.name}</strong>
            <small>{t.trophy ? t.trophy.name : "No trophy awarded for this event"}</small>
            <ul>{g.map(e => <li key={e.eventId}><Link href={`/career/${saveId}/events/${e.eventId}`}>Season {e.season}{e.venue?.displayName ? ` · ${e.venue.displayName}` : ""}</Link></li>)}</ul>
          </CareerEventIdentity>
        );
      })}</div> : <p className="pl-empty">{empty}</p>}
    </section>
  );
}

// ---------------------------------------------------------------- D3 season timeline
export function CareerTimeline({ ctx }: { ctx: ShellContext }) {
  const legacy = usePlayerLegacy(ctx.save.id);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="pl-panel" aria-label="Season by season">
      <h2 className="pl-panel__title"><Award size={15} aria-hidden /> Season by season</h2>
      <QueryState query={legacy} label="Reading season history">{v => !v.seasons.length ? <p className="pl-empty">No seasons recorded yet.</p> :
        <div className="pl-timeline" role="list">
          <BoundedList rows={[...v.seasons].reverse()} size={10}>{s => (
            <div role="listitem" key={s.season} className={`pl-season${s.titles ? " has-title" : ""}${s.partial ? " is-partial" : ""}`}>
              <button type="button" className="pl-season__head" aria-expanded={open === s.season} onClick={() => setOpen(open === s.season ? null : s.season)}>
                <span className="pl-season__num" style={OSWALD}>S{s.season}</span>
                <span className="pl-season__main"><strong>{s.identity ?? (s.partial ? (v.retired ? "Final, partial season" : "Season in progress") : "Completed season · no review recorded")}</strong>
                  <small>{s.appearances} events · {s.wins}–{s.losses} · {s.titles} title{s.titles === 1 ? "" : "s"} · {s.finals} final{s.finals === 1 ? "" : "s"}</small></span>
                <span className="pl-season__rank">{rankMove(s)}</span>
              </button>
              {open === s.season && <SeasonDetail saveId={ctx.save.id} row={s} />}
            </div>)}</BoundedList>
        </div>}</QueryState>
    </section>
  );
}
function rankMove(s: SeasonRow) {
  if (s.startRank === null && s.endRank === null) return <span className="pl-dim">Unranked</span>;
  if (s.startRank === null || s.endRank === null) return <span>#{s.endRank ?? s.startRank}</span>;
  const up = s.endRank < s.startRank;
  return <span className={up ? "pl-up" : s.endRank > s.startRank ? "pl-down" : ""} aria-label={`World rank ${s.startRank} to ${s.endRank}`}>#{s.startRank} → #{s.endRank}</span>;
}
function SeasonDetail({ saveId, row: s }: { saveId: string; row: SeasonRow }) {
  const review = useSeasonReview(saveId, s.reviewed ? s.season : null);
  return (
    <div className="pl-season__body">
      <dl className="pl-stats pl-stats--small">
        <Stat label="Prize" value={formatPence(s.prizePence)} /><Stat label="Commercial" value={formatPence(s.commercialPence)} />
        <Stat label="Tour Card" value={s.tourCard ? "Held" : "No"} /><Stat label="World rank" value={s.endRank ? ordinal(s.endRank) : "Unranked"} />
      </dl>
      {s.bestFinish && <p><Label>Best result</Label> <Link className="underline" href={`/career/${saveId}/events/${s.bestFinish.eventId}`}>{s.bestFinish.name}</Link> · {s.bestFinish.champion ? "Champion" : ordinal(s.bestFinish.position)}</p>}
      {s.titleNames.length > 0 && <p><Label>Titles</Label> {s.titleNames.join(" · ")}</p>}
      {s.rival && <p><Label>Most-met opponent</Label> {s.rival.name} · {s.rival.meetings} meetings · {s.rival.wins}–{s.rival.losses}</p>}
      {s.sponsors.length > 0 && <p><Label>Sponsors</Label> {s.sponsors.join(" · ")}</p>}
      {!s.reviewed ? <p className="pl-dim pl-small">{s.partial ? "This season has no end-of-season review yet; partial seasons are never given awards." : "No end-of-season review was recorded for this season; the figures above come from permanent results."}</p> :
        review.isLoading ? <CareerLoading label="Reading season review" /> : review.error ? <CareerError error={review.error} onRetry={() => review.refetch()} /> : review.data && <>
          {review.data.story.length > 0 && <div className="pl-story">{review.data.story.map(t => <p key={t}>{t}</p>)}</div>}
          {review.data.awards.filter(a => a.participant === "HUMAN").map(a => <p key={a.kind}><Award size={14} className="inline" aria-hidden /> {a.kind.replace(/_/g, " ").toLowerCase()} — {a.reason}</p>)}
          {review.data.changes.length > 0 && <ul className="pl-small">{review.data.changes.map(c => <li key={c}>{c}</li>)}</ul>}
          <p className="pl-dim pl-small">{review.data.provenance === "CAPTURED" ? "Captured at season end — later changes do not rewrite it." : "Reconstructed from permanent records."}</p>
        </>}
    </div>
  );
}

// ---------------------------------------------------------------- D4 documentary
/** "A Career Remembered": six chapters from saved evidence; skippable, replayable, revisitable. */
export function CareerRemembered({ ctx }: { ctx: ShellContext }) {
  const legacy = usePlayerLegacy(ctx.save.id);
  return <QueryState query={legacy} label="Gathering the archive">{v => <Documentary v={v} saveId={ctx.save.id} preview={!ctx.retired} />}</QueryState>;
}
export type DocAction = "next" | "back" | "skip" | "replay" | { to: number };
/** Documentary navigation: -1 is the title card, 0..chapters-1 the chapters, chapters the end card. */
export function docStep(step: number, action: DocAction, chapters: number): number {
  const clamp = (n: number) => Math.max(-1, Math.min(chapters, n));
  if (action === "next") return clamp(step + 1);
  if (action === "back") return clamp(step - 1);
  if (action === "skip") return chapters - 1;
  if (action === "replay") return -1;
  return clamp(action.to);
}
export function Documentary({ v, saveId, preview, initialStep = -1 }: { v: PlayerLegacy; saveId: string; preview: boolean; initialStep?: number }) {
  const [step, setStep] = useState(initialStep);
  const last = v.chapters.length;
  const stage = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } stage.current?.focus({ preventScroll: true }); }, [step]);
  const nav = (a: DocAction) => setStep(s => docStep(s, a, last));
  const go = (n: number) => nav({ to: n });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); nav("next"); }
    if (e.key === "ArrowLeft") { e.preventDefault(); nav("back"); }
    if (e.key === "End") { e.preventDefault(); nav("skip"); }
  };
  const chapter: Chapter | null = step >= 0 && step < last ? v.chapters[step] : null;
  const exit = `/career/${saveId}/my-career`;
  // G1/F1: archival backdrop at the level of the biggest recorded event in view (never invented).
  const TIERS = ["LOCAL", "STANDARD", "FEATURED", "TELEVISED", "MAJOR", "WORLD"];
  const topTier = (tiers: (string | undefined)[]) => tiers.filter((t): t is string => !!t && TIERS.includes(t)).sort((a, b) => TIERS.indexOf(b) - TIERS.indexOf(a))[0] ?? null;
  const docTier = chapter ? topTier(chapter.moments.map(m => m.tier)) : topTier(v.titles.map(m => m.tier));
  const docAtmosphere = resolveAtmosphere(docTier ? { presentationTier: docTier } : null);
  return (
    <section className="pl-doc" aria-label="A Career Remembered" aria-roledescription="documentary">
      <header className="pl-doc__bar">
        <span className="pl-doc__brand"><Clapperboard size={15} aria-hidden /> A Career Remembered{preview ? " · so far" : ""}</span>
        <nav className="pl-doc__chapters" aria-label="Chapters">{v.chapters.map((c, i) => (
          <button key={c.key} type="button" aria-current={step === i ? "step" : undefined} className={c.available ? "" : "is-missing"} onClick={() => go(i)}
            aria-label={`Chapter ${c.number}: ${c.title}${c.available ? "" : " (no recorded evidence)"}`}>{c.number}</button>))}</nav>
        <Link href={exit} className="pl-doc__exit" aria-label="Exit documentary"><X size={18} aria-hidden /></Link>
      </header>
      <div ref={stage} className="pl-doc__stage" tabIndex={-1} onKeyDown={onKey} aria-live="polite">
        <CareerStageBackdrop atmosphere={docAtmosphere} spectacle={spectacleFor("DOCUMENTARY_CHAPTER", docAtmosphere.level)} documentary eager className="pl-doc__backdrop" />
        {step === -1 && <div className="pl-doc__card pl-doc__title" key="title">
          <p className="pl-eyebrow">{preview ? "Your story so far" : `Retired · season ${v.retiredAt?.season}, week ${v.retiredAt?.week}`}</p>
          <h1 style={OSWALD}>A Career Remembered</h1>
          <h2 style={OSWALD}>{v.name}</h2>
          <p className="pl-dim">{v.totals.seasons} season{v.totals.seasons === 1 ? "" : "s"} · {v.totals.titles} title{v.totals.titles === 1 ? "" : "s"} · six chapters from the saved record</p>
          {preview && <p className="pl-small pl-dim">The full retrospective is presented when you retire. Until then this preview shows the record as it stands.</p>}
        </div>}
        {chapter && <article className={`pl-doc__card pl-doc__chapter${chapter.available ? "" : " is-missing"}`} key={chapter.key} aria-label={`Chapter ${chapter.number}: ${chapter.title}`}>
          <p className="pl-eyebrow">Chapter {chapter.number} of {last}</p>
          <h2 style={OSWALD}>{chapter.title}</h2>
          <p className="pl-doc__summary">{chapter.summary}</p>
          {chapter.available ? <ol className="pl-doc__moments">{chapter.moments.map((m, i) => (
            <li key={`${m.kind}:${i}`} style={{ "--pl-i": i } as CSSProperties}>
              <span className="pl-doc__icon">{icon(m.kind)}</span>
              <div><strong>{eventHref(saveId, m) ? <Link href={eventHref(saveId, m)!}>{m.label}</Link> : m.label}</strong><small>{m.detail}</small></div>
              {m.season !== null && <span className="pl-doc__season">S{m.season}</span>}
            </li>))}</ol>
            : <p className="pl-doc__missing">Not part of this Career’s record. Nothing has been invented to fill it.</p>}
        </article>}
        {step === last && <div className="pl-doc__card pl-doc__title" key="end">
          <p className="pl-eyebrow">End of the retrospective</p>
          <h2 style={OSWALD}>{v.name}</h2>
          <p className="pl-dim">{v.totals.wins}–{v.totals.losses} · {v.totals.titles} titles · {v.totals.finals} finals{v.bestRanking ? ` · career-high World #${v.bestRanking.position}` : ""}</p>
          <div className="pl-doc__endactions">
            <button type="button" className="career-btn career-btn-gold" onClick={() => nav("replay")}><RotateCcw size={16} aria-hidden /> Replay</button>
            <Link href={exit} className="career-btn career-btn-ghost">Return to My Career</Link>
            <Link href={`/career/${saveId}/my-career/history`} className="career-btn career-btn-ghost">Browse the full history</Link>
          </div>
        </div>}
      </div>
      <footer className="pl-doc__controls">
        <button type="button" className="career-btn career-btn-ghost" disabled={step === -1} onClick={() => nav("back")}><ChevronLeft size={16} aria-hidden /> Back</button>
        {step < last && <button type="button" className="career-btn career-btn-gold" onClick={() => nav("next")}>{step === -1 ? "Begin" : step === last - 1 ? "Finish" : "Next chapter"} <ChevronRight size={16} aria-hidden /></button>}
        {step < last - 1 && <button type="button" className="career-btn career-btn-ghost" onClick={() => nav("skip")}><SkipForward size={16} aria-hidden /> Skip to the final record</button>}
        {step === last && <button type="button" className="career-btn career-btn-ghost" onClick={() => nav("replay")}><RotateCcw size={16} aria-hidden /> Replay</button>}
      </footer>
      <p className="pl-doc__source pl-small pl-dim">{v.source}</p>
    </section>
  );
}
