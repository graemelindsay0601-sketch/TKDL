import { Fragment, useState } from "react";
import {ContextHelp} from "../guidance";
import {Link} from "wouter";
import {usePresentation} from "../api";
import {CareerShirt} from "../identity";
import {npcShirt} from "../../../../../api-server/src/career/content/visual";
import { BarChart3, ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";
import { useRankingExplain, useRankingHistory, useRankingLists, useRankingTable, type TableQuery } from "../api";
import { formatPence, ordinal } from "../model";
import { CareerEmptyState, CareerError, CareerLoading, CareerSection, Flag, Label, Movement, OSWALD, Segmented, StatTile } from "../components";
import type { ShellContext } from "../shell";
import type { RankingListMeta, RankingRow } from "../types";

const PAGE = 50;

/** Screen 4 — Rankings over A5's bounded APIs. Lists come from server metadata; nothing is inferred client-side. */
export function RankingsPage({ ctx }: { ctx: ShellContext }) {
  const lists = useRankingLists(ctx.save.id);
  const [listKey, setListKey] = useState<string | null>(null);
  if (lists.isLoading) return <div className="pdc-card"><CareerLoading label="Loading rankings" /></div>;
  if (lists.error || !lists.data) return <CareerError error={lists.error} onRetry={() => lists.refetch()} />;
  const key = listKey ?? lists.data[0]?.key;
  const meta = lists.data.find(l => l.key === key);
  return (
    <div className="space-y-3">
      <ContextHelp saveId={ctx.save.id} topic="rankings"/>
      <div className="pdc-card px-3 py-2.5">
        <label className="sm:hidden flex flex-col gap-1"><Label>Ranking list</Label>
          <select value={key ?? ""} onChange={e => setListKey(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm bg-black/40 border border-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff005c]">
            {lists.data.map(l => <option key={l.key} value={l.key}>{l.name}{l.human.standing ? ` — you are ${ordinal(l.human.standing.position)}` : ""}</option>)}
          </select></label>
        <div className="hidden sm:block"><Segmented label="Ranking list" value={key ?? ""} onChange={setListKey} options={lists.data.map(l => ({ value: l.key, label: l.name }))} /></div>
      </div>
      {meta ? <ListView key={meta.key} saveId={ctx.save.id} meta={meta} /> : <div className="pdc-card"><CareerEmptyState title="No ranking lists" /></div>}
    </div>
  );
}

function ListView({ saveId, meta }: { saveId: string; meta: RankingListMeta }) {
  const h = meta.human;
  const me = h.standing;
  const [view, setView] = useState<TableQuery["view"]>(me ? "AROUND" : "TOP");
  const [offset, setOffset] = useState(0);
  const [showExplain, setShowExplain] = useState(false);
  const q: TableQuery = view === "AROUND" ? { view, participant: "HUMAN", radius: 6 } : view === "TOP" ? { view, limit: 32 } : { view, limit: PAGE, offset };
  const table = useRankingTable(saveId, meta.key, q, !!meta.published);
  const history = useRankingHistory(saveId, meta.key, "HUMAN", 12);
  const explain = useRankingExplain(saveId, meta.key, "HUMAN", showExplain);
  const windowLabel = meta.window.kind === "ROLLING" ? `Rolling ${meta.window.weeks} weeks` : "This season only";

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatTile label="Your position" tone={me ? "gold" : "neutral"} value={me ? <span className="inline-flex items-baseline gap-2">{ordinal(me.position)} <Movement movement={me.movement} isNew={me.isNew} /></span> : "Unranked"}
          sub={meta.published ? `${meta.published.participantCount} ranked · published S${meta.published.season} W${meta.published.week}` : "Not published yet"} />
        <StatTile label="Ranking money" value={formatPence(me?.valuePence ?? 0)} sub={windowLabel} />
        <StatTile label="Career high" value={h.careerHighPosition ? ordinal(h.careerHighPosition) : "—"} sub={h.seasonHighPosition ? `Season high ${ordinal(h.seasonHighPosition)}` : undefined} />
        <StatTile label="Next cut" value={(() => { const c = h.cutLines.filter(c => !c.inside && c.valueAtCutPence !== null).sort((a, b) => b.cutPosition - a.cutPosition)[0];
          return c ? `Top ${c.cutPosition}` : me ? "Inside all cuts" : "—"; })()}
          sub={(() => { const c = h.cutLines.filter(c => !c.inside && c.valueAtCutPence !== null).sort((a, b) => b.cutPosition - a.cutPosition)[0];
            return c ? `${formatPence(c.gapPence)} behind${c.placesOutside ? ` · ${c.placesOutside} places outside` : ""}` : undefined; })()} />
      </div>

      <CareerSection title={meta.name} icon={<BarChart3 className="w-3.5 h-3.5" />} accent="#c084fc"
        action={meta.published ? <span className="text-xs whitespace-nowrap" style={{ color: "rgba(255,255,255,0.62)" }}>S{meta.published.season} W{meta.published.week}</span> : undefined}>
        <div className="px-3 pt-2.5 pb-1 flex flex-wrap items-center justify-between gap-2">
          <Segmented label="Table view" value={view} onChange={v => { setView(v); setOffset(0); }} options={[...(me ? [{ value: "AROUND" as const, label: "Around me" }] : []), { value: "TOP", label: "Top 32" }, { value: "PAGE", label: "Full table" }]} />
          {meta.cutLines.length > 0 && <span className="text-xs inline-flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.62)" }}><span aria-hidden className="inline-block w-5 border-t border-dashed" style={{ borderColor: "rgba(255,210,74,0.7)" }} />Cut lines: top {meta.cutLines.join(", ")}</span>}
        </div>
        {!meta.published ? <CareerEmptyState title="Not published yet">The first {meta.name} is published after the first week in which ranking money is won.</CareerEmptyState>
          : table.isLoading ? <CareerLoading /> : table.error || !table.data ? <CareerError error={table.error} onRetry={() => table.refetch()} />
          : table.data.rows.length === 0 ? <CareerEmptyState title="Nobody ranked">This list currently has no ranked players.</CareerEmptyState>
          : <RankingTable rows={table.data.rows} cutLines={meta.cutLines} saveId={saveId}/>}
        {view === "PAGE" && table.data && meta.published && (
          <div className="flex items-center justify-between px-3 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <button className="career-btn career-btn-ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}><ChevronLeft className="w-4 h-4" aria-hidden />Previous</button>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>{offset + 1}–{Math.min(offset + PAGE, meta.published.participantCount)} of {meta.published.participantCount}</span>
            <button className="career-btn career-btn-ghost" disabled={offset + PAGE >= meta.published.participantCount} onClick={() => setOffset(offset + PAGE)}>Next<ChevronRight className="w-4 h-4" aria-hidden /></button>
          </div>
        )}
      </CareerSection>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CareerSection title="Your ranking history" icon={<BarChart3 className="w-3.5 h-3.5" />}>
          {history.isLoading ? <CareerLoading /> : !history.data?.snapshots.length ? <CareerEmptyState title="No history yet">Your history starts with your first ranking entry on this list.</CareerEmptyState> : (
            <div className="px-4 py-3 space-y-2">
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>Season highs: {history.data.seasonHighs.map(s => `S${s.season} ${ordinal(s.best)}`).join(" · ")}</div>
              <ul className="space-y-1">{history.data.snapshots.map(s => (
                <li key={s.sequence} className="flex items-center gap-3 text-sm"><span className="w-20 text-xs" style={{ ...OSWALD, color: "rgba(255,255,255,0.62)" }}>S{s.season} W{s.week}</span>
                  <span className="w-12 font-black tabular-nums" style={{ ...OSWALD, color: "#fff" }}>{ordinal(s.position)}</span><Movement movement={s.movement} isNew={s.isNew} />
                  <span className="ml-auto tabular-nums text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>{formatPence(s.valuePence, { compact: true })}</span></li>))}</ul>
            </div>
          )}
        </CareerSection>
        <CareerSection title="Why this ranking?" icon={<HelpCircle className="w-3.5 h-3.5" />} accent="#38bdf8"
          action={<button className="career-btn career-btn-ghost" aria-expanded={showExplain} onClick={() => setShowExplain(!showExplain)}>{showExplain ? "Hide" : "Show"}</button>}>
          {!showExplain ? <p className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>Every ranking value is the sum of counting prize money from specific results ({windowLabel.toLowerCase()}).</p>
            : explain.isLoading ? <CareerLoading /> : explain.error || !explain.data ? <CareerError error={explain.error} onRetry={() => explain.refetch()} /> : explain.data.counting.length === 0 ? <CareerEmptyState title="No counting results" /> : (
              <div className="px-4 py-3 space-y-1.5">
                {explain.data.counting.map(c => (
                  <div key={c.eventId} className="flex items-center gap-2 text-sm"><span className="flex-1 truncate" style={{ color: "#fff" }}>{c.eventName}</span>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>S{c.season} W{c.week}</span>
                    <span className="w-20 text-right tabular-nums" style={{ ...OSWALD, color: "#4ade80" }}>{formatPence(c.amountPence)}</span></div>))}
                <div className="flex justify-between pt-1.5 border-t text-sm" style={{ borderColor: "rgba(255,255,255,0.08)" }}><Label>Total</Label><span className="tabular-nums font-black" style={{ ...OSWALD, color: "#fff" }}>{formatPence(explain.data.contributionTotalPence)}</span></div>
                {explain.data.expired.length > 0 && <div className="text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>{explain.data.expired.length} older result{explain.data.expired.length > 1 ? "s" : ""} no longer count.</div>}
              </div>
            )}
        </CareerSection>
      </div>
    </>
  );
}

/** Table on wide screens; the same rows read as compact two-line rows on phones. Cut lines come from A5 list metadata. */
export function RankingTable({ rows, cutLines,saveId }: { rows: RankingRow[]; cutLines: number[];saveId?:string }) {
  const p=usePresentation(saveId??"",!!saveId);
  return (
    <table className="career-table career-table-fixed" aria-label="Ranking table">
      <thead><tr><th scope="col" style={{ width: "2.9rem" }}>Pos</th><th scope="col" style={{ width: "2.9rem" }}><span aria-hidden>+/−</span><span className="sr-only">Movement</span></th><th scope="col">Player</th><th scope="col" style={{ textAlign: "right", width: "4.8rem" }}>Money</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <Fragment key={r.participantKey}>
            {i > 0 && cutLines.includes(rows[i - 1].position) && <tr className="career-cut"><td colSpan={4}><span className="career-cut-label">Top {rows[i - 1].position} cut</span></td></tr>}
            <tr data-me={r.participantKey === "HUMAN"} aria-current={r.participantKey === "HUMAN" ? "true" : undefined}>
              <td className="font-black tabular-nums" style={OSWALD}>{r.position}</td>
              <td><Movement movement={r.movement} isNew={r.isNew} /></td>
              <td><span className="flex items-center gap-1.5 min-w-0 career-ranking-shirt"><CareerShirt scale="compact" name={r.name??"Player"} identity={r.participantKey==="HUMAN"?p.data?.identity:npcShirt(r.participantKey)} sponsors={r.participantKey==="HUMAN"?p.data?.placements:[]}/><Flag code={r.nationality}/>{saveId?<Link href={`/career/${saveId}/${r.participantKey==="HUMAN"?"my-career":`world/players/${r.participantKey}`}`}>{r.participantKey==="HUMAN"?"You":r.name}</Link>:<span>{r.participantKey==="HUMAN"?"You":r.name}</span>}</span></td>
              <td className="tabular-nums" style={{ textAlign: "right", ...OSWALD }}>{formatPence(r.valuePence, { compact: true })}</td>
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
