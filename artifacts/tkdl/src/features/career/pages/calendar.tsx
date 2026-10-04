import { useMemo, useState } from "react";
import { Link } from "wouter";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useCalendar, useEnterEvent, errorMessage, type CalendarQuery } from "../api";
import { CALENDAR_STATUS_FILTERS, TIER_STYLES, circuitLabel, denialLabel, eventStatus, formatLabel, formatPence, matchesStatusFilter } from "../model";
import { CareerEmptyState, CareerError, CareerEventCard, CareerLoading, Label, OSWALD, Segmented } from "../components";
import type { ShellContext } from "../shell";
import type { CareerEvent, PresentationTier } from "../types";

type View = "MY_SCHEDULE" | "UPCOMING" | "SEASON" | "FEATURED";
const CIRCUITS = ["GRASSROOTS", "COUNTY", "REGIONAL", "NATIONAL_AMATEUR", "CHALLENGER", "VAULT", "Q_SCHOOL", "PRO_CIRCUIT", "EUROPEAN_SERIES", "WORLD_SERIES", "INVITATIONAL", "MAJOR", "WORLD_CHAMPIONSHIP", "SPECIAL"];

/** Screen 2 — Calendar: My Schedule first, then bounded world views, grouped by season swing. */
export function CalendarPage({ ctx }: { ctx: ShellContext }) {
  const { save, retired } = ctx;
  const [view, setView] = useState<View>("MY_SCHEDULE");
  const [circuit, setCircuit] = useState("");
  const [tier, setTier] = useState("");
  const [status, setStatus] = useState("ALL");
  const [season, setSeason] = useState(save.currentSeason);
  const isCurrent = season === save.currentSeason;
  const query: CalendarQuery = view === "MY_SCHEDULE" ? { scope: "MY_SCHEDULE", season }
    : view === "FEATURED" ? { scope: "FEATURED", season, fromWeek: isCurrent ? save.currentWeek : undefined }
    : view === "UPCOMING" ? { scope: "WORLD", season, fromWeek: isCurrent ? save.currentWeek : 1, toWeek: Math.min(52, (isCurrent ? save.currentWeek : 1) + 11), circuit: circuit || undefined }
    : { scope: "WORLD", season, circuit: circuit || undefined };
  const cal = useCalendar(save.id, query);
  const enter = useEnterEvent(save.id);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const pending = new Set(cal.data?.overview.pendingHumanMatches.map(p => p.eventId) ?? []);
  const events = useMemo(() => (cal.data?.events ?? []).filter(e => (!tier || e.presentation.tier === tier) && (!circuit || e.circuit === circuit) && matchesStatusFilter(e, status)), [cal.data, tier, circuit, status]);
  const groups = useMemo(() => {
    const out: { key: string; name: string; events: CareerEvent[] }[] = [];
    for (const g of cal.data?.overview.groupings ?? []) {
      const list = events.filter(e => e.dates.startWeek >= g.fromWeek && e.dates.startWeek <= g.toWeek);
      if (list.length) out.push({ key: g.key, name: `${g.name} · weeks ${g.fromWeek}–${g.toWeek}`, events: list });
    }
    return out;
  }, [cal.data, events]);
  const onEnter = (id: string) => { setMsg(null); enter.mutate(id, { onSuccess: r => setMsg(r.entered ? "Entry confirmed." : `Entry refused: ${r.denials.map(denialLabel).join(", ")}`), onError: e => setMsg(errorMessage(e)) }); };

  return (
    <div className="space-y-3">
      <div className="pdc-card px-3 py-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="flex items-center gap-2"><CalendarDays className="w-4 h-4" style={{ color: "#ff005c" }} aria-hidden /><Label color="#fff">Calendar · Season {season}</Label></h2>
          <label className="flex items-center gap-2 text-xs"><Label>Season</Label>
            <select value={season} onChange={e => setSeason(Number(e.target.value))} className="rounded-lg px-2 py-1.5 bg-black/40 border border-white/15 text-sm">
              {Array.from({ length: save.currentSeason }, (_, i) => save.currentSeason - i).map(s => <option key={s} value={s}>Season {s}</option>)}
            </select></label>
        </div>
        <Segmented<View> label="Calendar view" value={view} onChange={setView} options={[
          { value: "MY_SCHEDULE", label: "My schedule" }, { value: "UPCOMING", label: isCurrent ? "Next 12 weeks" : "First 12 weeks" },
          { value: "SEASON", label: "Whole season" }, { value: "FEATURED", label: "Featured" }]} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select label="Circuit" value={circuit} onChange={setCircuit} options={[["", "All circuits"], ...CIRCUITS.map(c => [c, circuitLabel(c)] as [string, string])]} />
          <Select label="Event level" value={tier} onChange={setTier} options={[["", "All levels"], ...(Object.keys(TIER_STYLES) as PresentationTier[]).map(t => [t, TIER_STYLES[t].label] as [string, string])]} />
          <Select label="Status" value={status} onChange={setStatus} options={CALENDAR_STATUS_FILTERS.map(f => [f.key, f.label] as [string, string])} />
        </div>
        {msg && <p role="status" className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>{msg}</p>}
      </div>

      {cal.isLoading ? <div className="pdc-card"><CareerLoading label="Loading calendar" /></div>
        : cal.error ? <CareerError error={cal.error} onRetry={() => cal.refetch()} />
        : groups.length === 0 ? <div className="pdc-card"><CareerEmptyState title={view === "MY_SCHEDULE" ? "No events in your schedule" : "No events match these filters"}>
            {view === "MY_SCHEDULE" ? <>Browse <button className="underline" onClick={() => setView("UPCOMING")}>upcoming events</button> to enter one.</> : "Try a different circuit, level or status."}</CareerEmptyState></div>
        : groups.map(g => (
          <section key={g.key} className="pdc-card overflow-hidden" aria-label={g.name}>
            <div className="px-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}><Label color="rgba(255,255,255,0.65)">{g.name}</Label></div>
            {g.events.map(e => (
              <div key={e.id}>
                <CareerEventCard event={e} saveId={save.id} awaitingMatch={pending.has(e.id)} retired={retired || !isCurrent} onEnter={retired || !isCurrent ? undefined : onEnter} entering={enter.isPending} />
                <button className="w-full flex items-center justify-center gap-1 py-1 text-xs career-row-link" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}
                  style={{ color: "rgba(255,255,255,0.4)", ...OSWALD, letterSpacing: "0.08em" }}>
                  {open === e.id ? "Hide details" : "Details"} <ChevronDown className="w-3 h-3" style={{ transform: open === e.id ? "rotate(180deg)" : undefined }} aria-hidden />
                </button>
                {open === e.id && <QuickFacts event={e} saveId={save.id} />}
              </div>
            ))}
          </section>
        ))}
    </div>
  );
}

function QuickFacts({ event, saveId }: { event: CareerEvent; saveId: string }) {
  const s = eventStatus(event);
  const f = event.finance;
  return (
    <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
      <Info label="Format" value={formatLabel(event.format)} />
      <Info label="Venue" value={`${event.venue.name}, ${event.venue.city}`} />
      <Info label="Field" value={`${event.field.entrants || "—"} / ${event.field.size}`} />
      <Info label="Entries" value={`Weeks ${event.registration.opensWeek}–${event.registration.closesWeek}`} />
      {f && <Info label="You pay (est.)" value={formatPence(f.estimatedPlayerCostPence)} />}
      {f && <Info label="Top prize" value={f.topPrizePence ? formatPence(f.topPrizePence) : "None"} />}
      <Info label="Ranking" value={event.rankingCategory ? (f?.rankingEligible ? "Ranking money" : "Non-ranking") : "Non-ranking"} />
      <Info label="Status" value={s.detail ?? s.label} />
      {event.human && event.human.denials.length > 0 && <div className="col-span-2 sm:col-span-4"><Label>Why not</Label><div>{[...new Set(event.human.denials)].map(denialLabel).join(" · ")}</div></div>}
      <div className="col-span-2 sm:col-span-4"><Link href={`/career/${saveId}/events/${event.id}`} className="career-btn career-btn-ghost">Full event page</Link></div>
    </div>
  );
}
const Info = ({ label, value }: { label: string; value: string }) => <div className="min-w-0"><Label>{label}</Label><div className="truncate" title={value}>{value}</div></div>;
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex flex-col gap-1"><Label>{label}</Label>
      <select value={value} onChange={e => onChange(e.target.value)} className="rounded-lg px-2.5 py-2 text-sm bg-black/40 border border-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff005c]">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
