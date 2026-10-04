import { Link } from "wouter";
import { Crown, Star } from "lucide-react";
import { useCalendar, useEvent, useHistory, useMilestones, useQualification } from "../api";
import { formatLabel, formatPence, milestoneLabel, routeLines, TONES } from "../model";
import { CareerEmptyState, CareerError, CareerEventCard, CareerLoading, CareerSection, Label, OSWALD, StatusBadge } from "../components";
import type { ShellContext } from "../shell";
import { EventView } from "./event";

const WC_KEY = "world-darts-championship";

/**
 * Screen 6 — World Championship at The Palace (WORLD presentation tier).
 * Uses the real A3 instance. The current Career engine cannot execute its set-play
 * format, so the event is shown as unsupported/cancelled — never as a played tournament.
 */
export function PalacePage({ ctx }: { ctx: ShellContext }) {
  const { save, retired } = ctx;
  const cal = useCalendar(save.id, { scope: "WORLD", season: save.currentSeason, circuit: "WORLD_CHAMPIONSHIP" });
  const wc = cal.data?.events.find(e => e.definitionKey === WC_KEY);
  const qualifiers = (cal.data?.events ?? []).filter(e => e.definitionKey !== WC_KEY);
  const past = useHistory(save.id, { definition: WC_KEY });
  const qual = useQualification(save.id, { eventId: wc?.id }, !!wc && !retired);
  const milestones = useMilestones(save.id, 100);
  const wcMilestones = (milestones.data?.milestones ?? []).filter(m => m.kind === "FIRST_WORLD_CHAMPIONSHIP");

  return (
    <div className="career-palace p-3 sm:p-5 space-y-3">
      <header className="text-center py-4 sm:py-6 space-y-2">
        <Crown className="w-7 h-7 mx-auto" style={{ color: "#ffd24a" }} aria-hidden />
        <Label color="#ffd24a">The pinnacle · Season {save.currentSeason}</Label>
        <h2 className="font-black uppercase leading-none" style={{ ...OSWALD, fontSize: "clamp(1.9rem, 7vw, 3.4rem)", letterSpacing: "0.05em", color: "#ffe79a" }}>World Championship</h2>
        <div className="uppercase" style={{ ...OSWALD, letterSpacing: "0.32em", fontSize: "0.8rem", color: "rgba(255,231,154,0.7)" }}>at The Palace</div>
      </header>
      {cal.isLoading ? <CareerLoading label="Loading the World Championship" /> : cal.error ? <CareerError error={cal.error} onRetry={() => cal.refetch()} /> : !wc ? (
        <div className="pdc-card"><CareerEmptyState title="No World Championship in this season's calendar" icon={<Crown className="w-6 h-6" />} /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="pdc-card p-4 space-y-1"><Label color="#ffd24a">Dates</Label><div style={{ ...OSWALD, color: "#fff" }}>Weeks {wc.dates.startWeek}–{wc.dates.endWeek} · {wc.venue.name}</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>{formatLabel(wc.format)} · field of {wc.field.size}</div></div>
            <div className="pdc-card p-4 space-y-1"><Label color="#ffd24a">Prize</Label><div style={{ ...OSWALD, color: "#fff" }}>{wc.finance?.topPrizePence ? `Champion: ${formatPence(wc.finance.topPrizePence)}` : "—"}</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>{!wc.capability.executable ? "Defined as World Ranking money, but nothing is awarded while the format is unsupported" : wc.finance?.rankingEligible ? "Ranking money (World Ranking)" : "Non-ranking"}</div></div>
            <div className="pdc-card p-4 space-y-1"><Label color="#ffd24a">Engine status</Label>
              <StatusBadge label={wc.capability.executable ? "Playable" : "Set-play format not supported yet"} tone={wc.capability.executable ? "success" : "muted"} />
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>{wc.capability.executable ? "" : wc.status === "CANCELLED" ? "Recorded as cancelled this season. No field, draw or result was invented." : "It will be cancelled when it starts; qualification is still recorded as a fact."}</div></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <CareerSection title="Your qualification" icon={<Star className="w-3.5 h-3.5" />} accent="#ffd24a">
              {retired ? <CareerEmptyState title="Retired Career" /> : qual.isLoading ? <CareerLoading /> : qual.data?.events[0] ? (
                <div className="px-4 py-3 space-y-2">
                  <StatusBadge label={qual.data.events[0].eligible ? "Qualified on current facts" : "Not qualified yet"} tone={qual.data.events[0].eligible ? "gold" : "muted"} />
                  <ul className="space-y-1 text-sm">{routeLines(qual.data.events[0].routes).map((l, i) => <li key={i} className="flex gap-2"><span aria-hidden style={{ color: l.met ? TONES.success : TONES.muted }}>{l.met ? "✓" : "✗"}</span><span style={{ color: "rgba(255,255,255,0.85)" }}>{l.text}</span></li>)}</ul>
                </div>) : qual.error ? <CareerError error={qual.error} onRetry={() => qual.refetch()} />
                : <CareerEmptyState title="No qualification facts">The World Championship is not among this season's upcoming events.</CareerEmptyState>}
              {wcMilestones.map((m, i) => <p key={i} className="px-4 pb-3 text-xs" style={{ color: "#ffd24a" }}>{milestoneLabel(m).title} · S{m.season} W{m.week}</p>)}
            </CareerSection>
            <CareerSection title="Previous champions" icon={<Crown className="w-3.5 h-3.5" />} accent="#ffd24a">
              {past.isLoading ? <CareerLoading /> : past.data?.length ? <ul>{past.data.map(r => <li key={r.eventId} className="px-4 py-2 text-sm flex justify-between items-center"><span style={{ ...OSWALD, color: "#fff" }}>Season {r.season}</span>
                  {r.participantKey === "HUMAN" ? <span style={{ color: "#ffd24a" }}>You</span> : <Link href={`/career/${save.id}/events/${r.eventId}`} className="career-btn career-btn-ghost">View final</Link>}</li>)}</ul>
                : <CareerEmptyState title="No World Championship has been played yet">Its set-play format is not supported by the Career engine yet, so no champion exists.</CareerEmptyState>}
            </CareerSection>
          </div>
          <CareerSection title="Qualifiers" icon={<Star className="w-3.5 h-3.5" />} accent="#ffd24a">
            {qualifiers.length ? qualifiers.map(e => <CareerEventCard key={e.id} event={e} saveId={save.id} retired={retired} compact />) : <CareerEmptyState title="No qualifiers this season" />}
          </CareerSection>
          <PalaceEvent ctx={ctx} eventId={wc.id} />
        </>
      )}
    </div>
  );
}

function PalaceEvent({ ctx, eventId }: { ctx: ShellContext; eventId: string }) {
  const q = useEvent(ctx.save.id, eventId);
  if (q.isLoading) return <CareerLoading />;
  if (q.error || !q.data) return <CareerError error={q.error} onRetry={() => q.refetch()} />;
  return <EventView ctx={ctx} detail={q.data} palace />;
}
