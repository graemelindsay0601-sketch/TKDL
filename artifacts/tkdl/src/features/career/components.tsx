import { type ReactNode, useState, useId } from "react";
import { Link } from "wouter";
import { AlertCircle, ChevronRight, Inbox, Loader2, RotateCcw } from "lucide-react";
import type { CareerEvent } from "./types";
import { TONES, type Tone, country, eventDateLabel, eventStatus, primaryAction, tierStyle, circuitLabel, movementLabel, formatPence, isJuniorEvent } from "./model";
import { errorMessage } from "./api";
import {CareerEventIdentity} from "./identity";

/** Shared Career primitives. Built on TKDL's pdc-card surfaces, Oswald labels and palette. */
export const OSWALD = { fontFamily: "Oswald, sans-serif" } as const;

export function Label({ children, color = "rgba(255,255,255,0.55)", className = "" }: { children: ReactNode; color?: string; className?: string }) {
  return <span className={`uppercase font-black ${className}`} style={{ ...OSWALD, fontSize: "0.62rem", letterSpacing: "0.16em", color }}>{children}</span>;
}

export function CareerSection({ title, icon, action, children, accent = "#52657d", id }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; accent?: string; id?: string }) {
  const headingId = useId();
  return (
    <section className="pdc-card career-section overflow-hidden" aria-labelledby={headingId} id={id} style={{ ["--section-accent" as string]: accent }}>
      <div className="career-section-head px-4 py-2.5 border-b flex items-center justify-between gap-2">
        <h2 id={headingId} className="flex items-center gap-2 min-w-0">
          {icon && <span aria-hidden style={{ color: accent }}>{icon}</span>}
          <Label color="rgba(255,255,255,0.85)">{title}</Label>
        </h2>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function StatusBadge({ label, tone = "neutral", icon }: { label: string; tone?: Tone; icon?: ReactNode }) {
  const c = TONES[tone];
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-black uppercase max-w-full"
      style={{ ...OSWALD, fontSize: "0.6rem", letterSpacing: "0.08em", color: c, background: tone === "muted" ? "rgba(255,255,255,0.05)" : `${c}1a`, border: `1px solid ${tone === "muted" ? "rgba(255,255,255,0.1)" : `${c}40`}` }}>
      {icon}{label}
    </span>
  );
}

export function StatTile({ label, value, sub, tone = "neutral", to }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; to?: string }) {
  const body = (
    <div className="pdc-card career-stat h-full px-3 py-2.5 flex flex-col gap-1 min-w-0">
      <Label>{label}</Label>
      <div className="font-black tabular-nums leading-none truncate" style={{ ...OSWALD, fontSize: "clamp(1.15rem, 3.6vw, 1.55rem)", color: TONES[tone] === TONES.neutral ? "#fff" : TONES[tone] }}>{value}</div>
      {sub && <div className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.62)" }}>{sub}</div>}
    </div>
  );
  return to ? <Link href={to} className="block h-full rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff005c]">{body}</Link> : body;
}

export function CareerLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="career-loading career-surface" style={{ color: "rgba(255,255,255,0.72)" }}>
      <p>{label}…</p><div className="career-skeleton" aria-hidden/><div className="career-skeleton" aria-hidden/><div className="career-skeleton" aria-hidden/>
    </div>
  );
}
export function CareerError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 px-4 py-3 m-3 rounded-xl" style={{ background: "rgba(255,0,92,0.08)", border: "1px solid rgba(255,0,92,0.3)" }}>
      <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "#ff005c" }} aria-hidden />
      <span className="flex-1 text-sm font-bold" style={{ ...OSWALD, color: "#ff8fb4" }}>{errorMessage(error)}</span>
      {onRetry && <button onClick={onRetry} className="career-btn career-btn-ghost"><RotateCcw className="w-3.5 h-3.5" aria-hidden /> Retry</button>}
    </div>
  );
}
export function CareerEmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="px-4 py-7 text-center flex flex-col items-center gap-1.5">
      <span aria-hidden style={{ color: "rgba(255,255,255,0.25)" }}>{icon ?? <Inbox className="w-6 h-6" />}</span>
      <div className="font-black uppercase text-sm" style={{ ...OSWALD, color: "rgba(255,255,255,0.7)" }}>{title}</div>
      {children && <div className="text-xs max-w-sm" style={{ color: "rgba(255,255,255,0.62)" }}>{children}</div>}
    </div>
  );
}
/** Query-state wrapper: loading → error(+retry) → content. */
export function QueryState<T>({ query, label, children }: { query: { isLoading: boolean; error: unknown; data: T | undefined; refetch: () => unknown }; label?: string; children: (data: T) => ReactNode }) {
  if (query.isLoading) return <CareerLoading label={label} />;
  if (query.error || query.data === undefined) return <CareerError error={query.error ?? new Error("No data")} onRetry={() => query.refetch()} />;
  return <>{children(query.data)}</>;
}
/** Bounded DOM, with every record still reachable; aggregate facts stay untouched. */
export function BoundedList<T>({rows,children,size=20}:{rows:T[];children:(row:T,index:number)=>ReactNode;size?:number}) {
  const [page,setPage]=useState(0),p=Math.min(page,Math.max(0,Math.ceil(rows.length/size)-1));
  return <>{rows.slice(p*size,(p+1)*size).map((r,i)=>children(r,p*size+i))}{rows.length>size&&<div className="career-pagination"><button disabled={!p} onClick={()=>setPage(p-1)}>Previous records</button><span>Page {p+1} · {rows.length} records</span><button disabled={(p+1)*size>=rows.length} onClick={()=>setPage(p+1)}>Next records</button></div>}</>;
}

export function SeasonProgress({ week, groupings, current }: { week: number; groupings?: { key: string; name: string; fromWeek: number; toWeek: number }[]; current?: string }) {
  const pct = Math.round(((week - 1) / 52) * 100);
  return (
    <div className="w-full" aria-label={`Season progress: week ${week} of 52`}>
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }} role="progressbar" aria-valuemin={1} aria-valuemax={52} aria-valuenow={week}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #ff005c, #c084fc, #ffd24a)" }} />
      </div>
      {groupings && (
        <div className="hidden sm:flex mt-1">
          {groupings.map(g => (
            <div key={g.key} style={{ width: `${((g.toWeek - g.fromWeek + 1) / 52) * 100}%`, ...OSWALD, fontSize: "0.55rem", letterSpacing: "0.08em", color: g.key === current ? "#fff" : "rgba(255,255,255,0.3)" }}
              className="uppercase truncate pr-1">{g.name}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Flag({ code }: { code: string | null | undefined }) {
  const c = country(code);
  if (!c) return null;
  return <span title={c.name} aria-label={c.name} role="img">{c.flag || code}</span>;
}
export function Movement({ movement, isNew }: { movement: number | null | undefined; isNew?: boolean }) {
  const m = movementLabel(movement, isNew);
  return <span className="tabular-nums font-black" style={{ ...OSWALD, fontSize: "0.7rem", color: TONES[m.tone] }} aria-label={m.aria}>{m.text}</span>;
}
export function TierBadge({ tier }: { tier: string }) {
  const t = tierStyle(tier);
  return <span className="px-1.5 rounded font-bold uppercase" style={{ ...OSWALD, fontSize: "0.55rem", letterSpacing: "0.08em", color: t.accent, background: `${t.accent}18`, border: `1px solid ${t.accent}33` }}>{t.label}</span>;
}

/** A6.5 Junior Development Circuit marker (under-18 events). */
export function JuniorBadge() {
  return <span className="px-1.5 rounded font-bold uppercase" style={{ ...OSWALD, fontSize: "0.55rem", letterSpacing: "0.08em", color: "#7ee0a1", background: "#7ee0a118", border: "1px solid #7ee0a133" }} title="Junior event: under 18 only">Junior · U18</span>;
}

/** Compact event row/card used by Home, Calendar and the Palace. Tier controls emphasis only. */
export function CareerEventCard({ event, saveId, awaitingMatch, retired, onEnter, entering, compact }: {
  event: CareerEvent; saveId: string; awaitingMatch?: boolean; retired?: boolean; onEnter?: (id: string) => void; entering?: boolean; compact?: boolean;
}) {
  const tier = tierStyle(event.presentation.tier);
  const status = eventStatus(event, { awaitingMatch });
  const action = primaryAction(event, { awaitingMatch, retired });
  const href = `/career/${saveId}/events/${event.id}`;
  return (
    <CareerEventIdentity eventKey={event.definitionKey} circuit={event.circuit} level={event.presentation.tier}>
    <div className="relative flex flex-wrap sm:flex-nowrap items-stretch gap-x-3 gap-y-2 px-3 py-2.5 border-b last:border-b-0" style={{ borderColor: "rgba(255,255,255,0.05)", background: tier.emphasis >= 4 ? tier.surface : undefined }}>
      <div className="absolute left-0 top-0 bottom-0" style={{ width: 2 + Math.min(tier.emphasis, 3), background: tier.accent, opacity: 0.4 + tier.emphasis * 0.1 }} aria-hidden />
      <div className="pl-1.5 w-14 shrink-0 flex flex-col justify-center">
        <span className="font-black tabular-nums" style={{ ...OSWALD, fontSize: "0.8rem", color: "#fff" }}>{eventDateLabel(event)}</span>
      </div>
      <Link href={href} className="flex-1 min-w-0 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff005c]">
        <div className="font-black uppercase leading-tight line-clamp-2 break-words" style={{ ...OSWALD, fontSize: compact ? "0.78rem" : "0.85rem", color: "#fff" }}>{event.name}</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>
          <span>{circuitLabel(event.circuit)}</span>
          {isJuniorEvent(event) && <JuniorBadge />}
          <span aria-hidden>·</span><span className="truncate">{event.venue.city}</span>
          {event.finance && event.finance.topPrizePence > 0 && <><span aria-hidden>·</span><span>Top prize {formatPence(event.finance.topPrizePence, { compact: true })}</span></>}
          <StatusBadge label={status.label} tone={status.tone} />
        </div>
      </Link>
      <div className={`shrink-0 flex items-center ${action.kind === "ENTER" && onEnter ? "w-full sm:w-auto pl-[4.25rem] sm:pl-0" : ""}`}>
        {action.kind === "ENTER" && onEnter ? (
          <button className="career-btn career-btn-primary w-full sm:w-auto" onClick={() => onEnter(event.id)} disabled={entering} aria-label={`Enter ${event.name}`}>
            {entering ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : null}{action.label}
          </button>
        ) : (
          <Link href={href} className="career-btn career-btn-ghost" aria-label={`${action.label}: ${event.name}`}>
            {action.kind === "PLAY_MATCH" ? "Your match" : <ChevronRight className="w-4 h-4" aria-hidden />}
          </Link>
        )}
      </div>
    </div></CareerEventIdentity>
  );
}

/** Accessible segmented tabs (roving buttons with aria-pressed; content rendered by caller). */
export function Segmented<T extends string>({ value, options, onChange, label, wrap }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void; label: string; wrap?: boolean }) {
  return (
    <div role="group" aria-label={label} className={`tkdl-tab-rail${wrap ? " tkdl-tab-rail--wrap" : ""}`}>
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className="tkdl-tab-trigger career-chip" data-active={value === o.value}>
          {o.label}{o.count !== undefined && <span className="opacity-60 ml-1">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Two-step confirm for destructive actions (no browser dialogs). */
export function ConfirmButton({ label, confirmLabel, description, onConfirm, danger, disabled, busy }: { label: string; confirmLabel: string; description: string; onConfirm: () => void; danger?: boolean; disabled?: boolean; busy?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button className={`career-btn ${danger ? "career-btn-danger" : "career-btn-ghost"}`} disabled={disabled || busy} onClick={() => setOpen(true)}>{label}</button>;
  return (
    <div role="alertdialog" aria-label={confirmLabel} className="w-full rounded-lg p-2.5 flex flex-col gap-2" style={{ background: danger ? "rgba(255,0,92,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${danger ? "rgba(255,0,92,0.35)" : "rgba(255,255,255,0.12)"}` }}>
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>{description}</p>
      <div className="flex gap-2 flex-wrap">
        <button className={`career-btn ${danger ? "career-btn-danger" : "career-btn-primary"}`} disabled={busy} onClick={() => { onConfirm(); setOpen(false); }} autoFocus>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}{confirmLabel}</button>
        <button className="career-btn career-btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
