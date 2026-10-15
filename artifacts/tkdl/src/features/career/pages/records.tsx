import { Link } from "wouter";
import { Crosshair, Trophy } from "lucide-react";
import { useWorldRecords, type WorldRecordsView } from "../api";
import { CareerError, CareerLoading, CareerSection } from "../components";
import { CareerPageHero } from "../page-hero";
import type { ShellContext } from "../shell";

type Entry = WorldRecordsView["records"][number]["entries"][number];
const SOURCE: Record<Entry["source"], string> = { LIVE: "Live darts", QUICK_SIM: "Quick-sim", SIMULATED: "Tour" };
const value = (unit: string, v: number) => unit === "average" ? v.toFixed(2) : unit === "legs" ? `${v} leg${v === 1 ? "" : "s"}` : String(v);

/** The records book: the best recorded match statistics in this Career and every nine-dart leg, your entries highlighted. */
export function RecordsPage({ ctx }: { ctx: ShellContext }) {
  const records = useWorldRecords(ctx.save.id), base = `/career/${ctx.save.id}`;
  if (records.isLoading) return <CareerLoading />;
  if (records.error || !records.data) return <CareerError error={records.error} onRetry={() => records.refetch()} />;
  const all = records.data.records, nines = all.find(r => r.key === "nine-darter")?.entries ?? [];
  const yours = all.flatMap(r => r.entries).filter(e => e.you).length;
  const name = (e: Entry) => e.you ? <strong>{e.name} (you)</strong> : <Link href={`${base}/world/players/${e.participantKey}/profile`}>{e.name}</Link>;
  return <div className="space-y-3 career-records">
    <CareerPageHero kicker="Darts World" title="Records Book" accent="#e9c77a" stage={{ venue: { venueType: "exhibition" }, eventClass: "MAJOR" }}
      subtitle={<p>The best performances recorded in this Career's darts world, from every match played. Steel-tip only; averages count from six legs.</p>}
      stats={[{ label: "Nine-darters", value: nines.length, tone: "gold" }, { label: "Your entries", value: yours }]} />
    <CareerSection title="Nine-dart finishes" icon={<Crosshair aria-hidden />} accent="#ffd24a">
      {nines.length ? <ol className="career-records__list">{nines.map(e => <li key={`${e.matchId}:${e.participantKey}`} className={e.you ? "is-you" : undefined}>
        <span>{name(e)}</span><small>{e.eventName} · Season {e.season}, week {Math.ceil(e.day / 7)} · {SOURCE[e.source]}</small></li>)}</ol>
        : <p className="p-4 text-sm text-white/70">No nine-darter yet. The first one in this darts world will be remembered here.</p>}
      {records.data.nineDartersSince === "BOOK_ADDED" && <p className="px-4 pb-3 text-xs text-white/60">Nine-darters are counted from when the records book was added to this Career.</p>}
    </CareerSection>
    {all.filter(r => r.key !== "nine-darter").map(r => <CareerSection key={r.key} title={r.label} icon={<Trophy aria-hidden />} accent="#e9c77a">
      {r.entries.length ? <ol className="career-records__list">{r.entries.map((e, i) => <li key={`${e.matchId}:${e.participantKey}`} className={e.you ? "is-you" : undefined}>
        <b>{i + 1}</b><span>{name(e)}</span><em>{value(r.unit, e.value)}</em><small>{e.eventName} · Season {e.season} · {SOURCE[e.source]}</small></li>)}</ol>
        : <p className="p-4 text-sm text-white/70">Nothing recorded yet.</p>}
    </CareerSection>)}
  </div>;
}
