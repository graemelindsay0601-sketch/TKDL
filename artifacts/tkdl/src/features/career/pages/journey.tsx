import { Link } from "wouter";
import { BadgeCheck, Compass, CreditCard, Flag as FlagIcon, Milestone as MilestoneIcon, TrendingUp, Trophy } from "lucide-react";
import { useHistory, useMilestones, useRankingHistory, useSporting, useTourCard } from "../api";
import { careerChapter, circuitLabel, milestoneLabel, ordinal, sourceLabel, stageLabel, titleCase, TONES } from "../model";
import { CareerEmptyState, CareerError, CareerLoading, CareerSection, Label, OSWALD, StatusBadge } from "../components";
import type { ShellContext } from "../shell";

const BIG = new Set(["MAJOR", "WORLD_CHAMPIONSHIP", "EUROPEAN_SERIES", "WORLD_SERIES", "INVITATIONAL"]);

/**
 * Screen 7 — Career Journey (factual shell). Every line is an A3 result, an A5
 * milestone, a card record or a ranking snapshot. No narrative prose (A7 plugs in
 * at the `JourneyStoryExtension` slot below).
 */
export function JourneyPage({ ctx }: { ctx: ShellContext }) {
  const id = ctx.save.id;
  const sporting = useSporting(id);
  const milestones = useMilestones(id, 100);
  const cards = useTourCard(id);
  const history = useHistory(id, { participant: "HUMAN" });
  const world = useRankingHistory(id, "pro-world", "HUMAN", 1);
  const chapter = sporting.data ? careerChapter(sporting.data, ctx.save) : null;
  const finals = (history.data ?? []).filter(r => r.champion || r.stageReached === "FINAL");
  const appearances = (history.data ?? []).filter(r => BIG.has(r.circuit)).slice(0, 8);
  const qSchool = (milestones.data?.milestones ?? []).filter(m => m.kind === "Q_SCHOOL_FINAL_STAGE_REACHED");

  return (
    <div className="space-y-3">
      <section className="pdc-card p-4 md:p-5">
        <Label color="#ff005c">Where you are</Label>
        {sporting.isLoading ? <CareerLoading /> : sporting.error ? <CareerError error={sporting.error} onRetry={() => sporting.refetch()} /> : chapter && (
          <div className="flex flex-wrap items-end gap-3 mt-1">
            <h2 className="font-black uppercase leading-none" style={{ ...OSWALD, fontSize: "clamp(1.4rem, 4.5vw, 2rem)", color: "#fff" }}>{chapter.label}</h2>
            <StatusBadge label={`Season ${ctx.save.currentSeason} · week ${ctx.save.currentWeek}`} tone="neutral" />
            <NextObjective ctx={ctx} />
          </div>
        )}
      </section>
      {/* A7 extension point: narrative/news renders here later. A6 renders nothing in its place. */}
      <JourneyStoryExtension />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CareerSection title="Milestones" icon={<MilestoneIcon className="w-3.5 h-3.5" />} accent="#4ade80">
          {milestones.isLoading ? <CareerLoading /> : milestones.error ? <CareerError error={milestones.error} onRetry={() => milestones.refetch()} /> : milestones.data?.milestones.length ? (
            <ol className="px-4 py-2">{milestones.data.milestones.map((m, i) => { const l = milestoneLabel(m); return (
              <li key={m.id ?? i} className="flex items-start gap-3 py-1.5 border-b last:border-b-0" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <span className="w-16 shrink-0 text-xs pt-0.5" style={{ ...OSWALD, color: "rgba(255,255,255,0.45)" }}>S{m.season} W{m.week}</span>
                <span aria-hidden style={{ color: TONES[l.tone] }}>●</span>
                <div className="min-w-0"><div className="text-sm" style={{ color: "#fff" }}>{l.title}</div>{l.detail && <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.5)" }}>{l.detail}</div>}</div>
              </li>); })}</ol>
          ) : <CareerEmptyState title="No milestones yet">Your first ranking entry, Q-School progress and Tour Card news are recorded here as they happen.</CareerEmptyState>}
        </CareerSection>
        <div className="space-y-3">
          <CareerSection title="Tour Card history" icon={<CreditCard className="w-3.5 h-3.5" />} accent="#38bdf8">
            {cards.isLoading ? <CareerLoading /> : cards.data?.history.length ? (
              <ul>{cards.data.history.map(c => (
                <li key={c.id} className="px-4 py-2 border-b last:border-b-0 flex items-center gap-2 text-sm flex-wrap" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <span style={{ ...OSWALD, color: "#fff" }}>S{c.term.startSeason}–S{c.term.endSeason}</span><span style={{ color: "rgba(255,255,255,0.65)" }}>{sourceLabel(c.source)}</span>
                  <span className="ml-auto"><StatusBadge label={c.status === "ACTIVE" ? "Active" : titleCase(c.endReason ?? c.status)} tone={c.status === "ACTIVE" ? "success" : c.status === "LOST" ? "danger" : "muted"} /></span>
                </li>))}</ul>
            ) : <CareerEmptyState title="No Tour Card yet">Q-School and the Challenger ranking are the routes to a card.</CareerEmptyState>}
          </CareerSection>
          <CareerSection title="Q-School" icon={<FlagIcon className="w-3.5 h-3.5" />} accent="#ffd24a" action={<Link href={`/career/${id}/q-school`} className="career-btn career-btn-ghost">Q-School</Link>}>
            {qSchool.length ? <ul>{qSchool.map((m, i) => <li key={i} className="px-4 py-2 text-sm" style={{ color: "#fff" }}>Season {m.season}: {milestoneLabel(m).title}{milestoneLabel(m).detail ? ` — ${milestoneLabel(m).detail}` : ""}</li>)}</ul>
              : <CareerEmptyState title="No Q-School Final Stage yet" />}
          </CareerSection>
          <CareerSection title="World Ranking progress" icon={<TrendingUp className="w-3.5 h-3.5" />} accent="#c084fc">
            {world.data?.seasonHighs.length ? <p className="px-4 py-3 text-sm" style={{ color: "#fff" }}>Career high {world.data.careerHigh ? ordinal(world.data.careerHigh.position) : "—"} · season highs {world.data.seasonHighs.map(s => `S${s.season} ${ordinal(s.best)}`).join(" · ")}</p>
              : <CareerEmptyState title="Not on the World Ranking yet">World Ranking money comes from Pro Circuit, European Series and major events.</CareerEmptyState>}
          </CareerSection>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CareerSection title="Titles & finals" icon={<Trophy className="w-3.5 h-3.5" />} accent="#ffd24a">
          {history.isLoading ? <CareerLoading /> : finals.length ? <ResultList rows={finals.slice(0, 8)} saveId={id} /> : <CareerEmptyState title="No titles or finals yet" />}
        </CareerSection>
        <CareerSection title="Big-stage appearances" icon={<BadgeCheck className="w-3.5 h-3.5" />} accent="#ff005c">
          {history.isLoading ? <CareerLoading /> : appearances.length ? <ResultList rows={appearances} saveId={id} /> : <CareerEmptyState title="No major or televised appearances yet" />}
        </CareerSection>
      </div>
    </div>
  );
}

function NextObjective({ ctx }: { ctx: ShellContext }) {
  const s = useSporting(ctx.save.id).data;
  if (!s || ctx.retired) return null;
  const text = s.tourCard.current ? `Next: Tour Card review end of S${s.tourCard.current.reviewSeason} (World top ${s.tourCard.current.retention.maxPosition})` : "Next: earn a Tour Card at Q-School or via the Challenger ranking";
  return <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.7)" }}><Compass className="w-3.5 h-3.5" aria-hidden />{text}</span>;
}
/** Reserved slot for A7 narrative. Intentionally renders nothing in A6. */
export function JourneyStoryExtension() { return null; }

export function ResultList({ rows, saveId }: { rows: { eventId: string; season: number; week: number; name: string; circuit: string; stageReached: string; champion: boolean }[]; saveId: string }) {
  return (
    <ul>{rows.map(r => (
      <li key={r.eventId} className="px-4 py-2 border-b last:border-b-0 flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <Link href={`/career/${saveId}/events/${r.eventId}`} className="flex-1 min-w-0 career-row-link rounded">
          <div className="text-sm truncate font-bold" style={{ ...OSWALD, color: "#fff" }}>{r.name}</div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>S{r.season} W{r.week} · {circuitLabel(r.circuit)}</div></Link>
        <StatusBadge label={r.champion ? "Champion" : stageLabel(r.stageReached)} tone={r.champion ? "gold" : "neutral"} />
      </li>))}</ul>
  );
}
