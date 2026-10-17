import { useState } from "react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { useBookHosting, useHosting, useHostingPreview, errorMessage } from "./api";
import { dayLabel, formatPence } from "./model";

const STATUS: Record<string, string> = { SCHEDULED: "Booked", REGISTRATION_OPEN: "Entries open", REGISTRATION_CLOSED: "Entries closed", FIELD_LOCKED: "Draw made",
  IN_PROGRESS: "Under way", COMPLETED: "Played", CANCELLED: "Called off" };

/**
 * Club page: run your own tournament. Book the back room for a night you're free, set the fee, your prize money and the field;
 * a preview shows how many will come, the pot and your share. It goes into the calendar like any other local event.
 */
export function HostTournament({ saveId, retired }: { saveId: string; retired: boolean }) {
  const q = useHosting(saveId);
  const book = useBookHosting(saveId);
  const [form, setForm] = useState({ name: "", week: 0, dayOfWeek: 6, fieldSize: 16, fee: "10", topUp: "50" });
  const [message, setMessage] = useState("");
  const feePence = Math.round(Number(form.fee || 0) * 100), topUpPence = Math.round(Number(form.topUp || 0) * 100);
  const d = q.data;
  const valid = !!d && Number.isInteger(Number(form.fee || 0)) && Number.isInteger(Number(form.topUp || 0)) && feePence <= (d?.rules.maxFeePence ?? 0) && topUpPence <= (d?.rules.maxTopUpPence ?? 0);
  const preview = useHostingPreview(saveId, { feePence, topUpPence, fieldSize: form.fieldSize, fans: d?.fans ?? 0 }, valid);
  if (!d) return q.isLoading ? <p className="host__note">Loading…</p> : null;
  const firstWeek = d.week + d.rules.leadWeeks;
  const weeks = Array.from({ length: Math.max(0, d.rules.lastWeek - firstWeek + 1) }, (_, i) => firstWeek + i);
  const week = form.week || weeks[0];
  const pending = d.events.find(e => e.status !== "COMPLETED" && e.status !== "CANCELLED");
  const canBook = !retired && !pending && d.hostedThisSeason < d.maxPerSeason && weeks.length > 0;
  const p = preview.data;
  const set = (k: keyof typeof form, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="host">
      <p className="host__note">Book the back room at {d.club ?? "your club"} and run your own night. The room and any prize money you add are paid up front. Players pay your entry fee:
        {" "}you keep {Math.round(d.rules.organiserShare * 100)}% and the rest goes in the pot with your prize money (winner half, runner-up a quarter, semi-finalists an eighth each).
        It's a local special in the calendar, so only players free that night can come, and you can enter it yourself. Up to {d.maxPerSeason} a season.</p>
      {canBook ? <form className="host__form" onSubmit={e => { e.preventDefault(); setMessage("");
        book.mutate({ ...(form.name.trim().length >= 3 ? { name: form.name.trim() } : {}), week, dayOfWeek: form.dayOfWeek, fieldSize: form.fieldSize, feePence, topUpPence },
          { onSuccess: r => setMessage(`Booked. Entries are open: expect around ${Math.round(r.turnout * form.fieldSize)} players.`), onError: err => setMessage(errorMessage(err)) }); }}>
        <label><span>Name (optional)</span><input value={form.name} maxLength={40} placeholder={`${d.club ?? "Club"} Open`} onChange={e => set("name", e.target.value)} /></label>
        <label><span>Week</span><select value={week} onChange={e => set("week", Number(e.target.value))}>{weeks.map(w => <option key={w} value={w}>Week {w}</option>)}</select></label>
        <label><span>Night</span><select value={form.dayOfWeek} onChange={e => set("dayOfWeek", Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map(x => <option key={x} value={x}>{dayLabel(x)}</option>)}</select></label>
        <label><span>Field</span><select value={form.fieldSize} onChange={e => set("fieldSize", Number(e.target.value))}>{d.rules.fieldSizes.map(n => <option key={n} value={n}>{n} players (room £{d.rules.roomHirePence[n] / 100})</option>)}</select></label>
        <label><span>Entry fee (£)</span><input inputMode="numeric" value={form.fee} onChange={e => set("fee", e.target.value.replace(/[^0-9]/g, ""))} /></label>
        <label><span>Your prize money (£)</span><input inputMode="numeric" value={form.topUp} onChange={e => set("topUp", e.target.value.replace(/[^0-9]/g, ""))} /></label>
        {p && valid && <p className="host__preview">Expect about <b>{p.entrants}</b> players. Pot about <b>{formatPence(p.prize.bands[0].amountPence + p.prize.bands[1].amountPence + p.prize.bands[2].amountPence * 2)}</b>
          {" "}(winner {formatPence(p.prize.bands[0].amountPence)}). You pay <b>{formatPence(p.costPence)}</b> now and keep about <b>{formatPence(p.takePence)}</b> of the fees.
          {p.costPence > d.availablePence ? <strong className="host__warn"> You have {formatPence(d.availablePence)} free.</strong> : null}</p>}
        {!valid && <p className="host__warn">Whole pounds only: entry up to £{d.rules.maxFeePence / 100}, prize money up to £{d.rules.maxTopUpPence / 100}.</p>}
        <button type="submit" className="career-btn career-btn-gold" disabled={!valid || book.isPending || (p ? p.costPence > d.availablePence : false)}>
          {book.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null} Book it</button>
      </form> : <p className="host__note">{retired ? "Retired Careers can't book." : pending ? `You've booked ${pending.name}: run that one first.` : d.hostedThisSeason >= d.maxPerSeason ? `You've run ${d.maxPerSeason} this season.` : "Too late in the season to book a night."}</p>}
      {message && <p className="host__message" role="status">{message}</p>}
      {d.events.length > 0 && <ul className="host__events">{d.events.map(e => <li key={e.eventId}>
        <Link href={`/career/${saveId}/events/${e.eventId}`}><b>{e.name}</b></Link>
        <small>Wk {e.week} · {dayLabel(e.dayOfWeek)} · {STATUS[e.status] ?? e.status}{e.entrants !== null ? ` · ${e.entrants} players` : ""} · £{e.feePence / 100} entry
          {e.takePence !== null ? ` · you kept ${formatPence(e.takePence)}` : ""}{e.yourPosition === 1 ? " · you won it" : e.yourPosition ? ` · you finished ${e.yourPosition === 2 ? "runner-up" : `in the last ${e.yourPosition}`}` : ""}</small></li>)}</ul>}
    </div>
  );
}
