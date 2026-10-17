import { useState } from "react";
import { Link } from "wouter";
import { useCalendar, useClearSavingsGoal, useSavingsGoal, useSetSavingsGoal, errorMessage, type SavingsGoal } from "./api";
import { formatPence } from "./model";

const STATUS_TEXT: Record<SavingsGoal["status"], string> = {
  SAVING: "Saving", READY: "You can afford it now", ENTERED: "Entered — goal met", MISSED: "Missed — the entry window has closed",
};

function Progress({ goal }: { goal: SavingsGoal }) {
  const pct = Math.round(goal.progress * 100);
  return <div className="savings-goal__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${goal.label}: ${pct}% saved`}>
    <span style={{ width: `${pct}%` }} data-done={goal.status === "READY" || goal.status === "ENTERED" ? "true" : undefined} />
  </div>;
}

function outlook(goal: SavingsGoal, week: number) {
  if (goal.status === "READY") return goal.kind === "EVENT" ? "You have the money: enter before entries close" + (goal.event ? ` in week ${goal.event.closesWeek}.` : ".") : "Goal reached.";
  if (goal.status !== "SAVING") return null;
  const left = `${formatPence(goal.remainingPence)} to go`;
  if (goal.weeksToGo === null) return `${left} · your money has not been growing lately: a few cheap local nights or a sponsor would help.`;
  const pace = `${left} · about ${goal.weeksToGo} week${goal.weeksToGo === 1 ? "" : "s"} at your recent ${formatPence(goal.averageWeeklyPence)} a week`;
  return goal.event && week + goal.weeksToGo > goal.event.closesWeek ? `${pace}, but entries close in week ${goal.event.closesWeek}: you will need to earn faster.` : `${pace}.`;
}

/** Home: one line with the goal's progress (nothing when no goal is set). */
export function SavingsGoalLine({ saveId }: { saveId: string }) {
  const q = useSavingsGoal(saveId);
  const goal = q.data?.goal;
  if (!goal) return null;
  // The moment it pays off: you can afford the event you saved for, so say so and point at the entry.
  if (goal.status === "READY" && goal.kind === "EVENT" && goal.eventId) return <div className="savings-goal-line savings-goal-line--ready" role="status">
    <span><b>Goal reached:</b> you can afford {goal.label} ({formatPence(goal.targetPence)} with travel).</span>
    <small>{goal.event ? `Entries close in week ${goal.event.closesWeek}.` : "Enter while entries are open."}</small>
    <Link href={`/career/${saveId}/events/${goal.eventId}`} className="career-btn career-btn-gold">Enter now</Link>
  </div>;
  return <Link href={`/career/${saveId}/finances#savings-goal`} className="savings-goal-line">
    <span><b>Saving for:</b> {goal.label}</span>
    <Progress goal={goal} />
    <small>{goal.availablePence >= goal.targetPence ? `It costs ${formatPence(goal.targetPence)}` : `${formatPence(Math.max(0, goal.availablePence))} of ${formatPence(goal.targetPence)}`} · {STATUS_TEXT[goal.status]}</small>
  </Link>;
}

/** Finances: set, follow and clear a savings goal. Progress is the money free to spend (balance less money set aside for entered events). */
export function SavingsGoalPanel({ saveId, season, week, retired }: { saveId: string; season: number; week: number; retired: boolean }) {
  const q = useSavingsGoal(saveId);
  const set = useSetSavingsGoal(saveId), clear = useClearSavingsGoal(saveId);
  const [choosing, setChoosing] = useState(false);
  const [label, setLabel] = useState(""), [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const calendar = useCalendar(saveId, { scope: "AVAILABLE", season, fromWeek: week, toWeek: Math.min(52, week + 20) }, choosing);
  const options = (calendar.data?.events ?? [])
    // Worth saving for: opens, county and national events and tours (not the weekly club nights).
    .filter(e => e.human?.canEnter && e.finance && e.finance.estimatedPlayerCostPence > 0 && e.status !== "COMPLETED" && e.status !== "CANCELLED"
      && e.presentation.tier !== "LOCAL" && e.circuit !== "GRASSROOTS")
    .sort((a, b) => b.finance!.estimatedPlayerCostPence - a.finance!.estimatedPlayerCostPence || a.dates.startDay - b.dates.startDay)
    .filter((e, i, all) => all.findIndex(x => x.name === e.name) === i).slice(0, 12)
    .sort((a, b) => a.dates.startDay - b.dates.startDay);
  const goal = q.data?.goal ?? null;
  const done = (r: { goal: SavingsGoal | null }) => { setChoosing(false); setMessage(r.goal ? `Now saving for ${r.goal.label}.` : "Goal cleared."); };
  const fail = (e: unknown) => setMessage(errorMessage(e));
  const pounds = Math.round(Number(amount) * 100);

  return (
    <div className="savings-goal" id="savings-goal">
      {goal ? <div className="savings-goal__current">
        <div className="savings-goal__head"><strong>{goal.label}</strong><span data-status={goal.status}>{STATUS_TEXT[goal.status]}</span></div>
        <Progress goal={goal} />
        <p className="savings-goal__figures">{goal.availablePence >= goal.targetPence
          ? <>You have {formatPence(goal.availablePence)} free · it costs {formatPence(goal.targetPence)}</>
          : <>{formatPence(Math.max(0, goal.availablePence))} of {formatPence(goal.targetPence)} saved</>}
          {goal.kind === "EVENT" && goal.event ? <> · entry, travel and stay for week {goal.event.week}</> : null}</p>
        {outlook(goal, week) && <p className="savings-goal__outlook">{outlook(goal, week)}</p>}
        {goal.eventId && <Link href={`/career/${saveId}/events/${goal.eventId}`} className="savings-goal__link">View the event</Link>}
      </div> : <p className="savings-goal__none">Pick something to save for: a bigger open, a trip away, or an amount of your own. Your free money and weekly earnings count towards it.</p>}
      {!retired && !choosing && <div className="savings-goal__actions">
        <button type="button" className="career-btn career-btn-primary" onClick={() => { setChoosing(true); setMessage(""); }}>{goal ? "Change goal" : "Set a savings goal"}</button>
        {goal && <button type="button" className="career-btn career-btn-ghost" disabled={clear.isPending} onClick={() => clear.mutate(undefined, { onSuccess: done, onError: fail })}>Clear</button>}
      </div>}
      {choosing && <div className="savings-goal__picker">
        <p className="savings-goal__picker-title">Save for an event (its full cost: entry, travel and stay)</p>
        {calendar.isLoading ? <p className="savings-goal__none">Loading events…</p> : options.length ? <ul>
          {options.map(e => <li key={e.id}><button type="button" disabled={set.isPending} onClick={() => set.mutate({ eventId: e.id }, { onSuccess: done, onError: fail })}>
            <span>{e.name}</span><small>Wk {e.dates.startWeek} · {e.venue.city} · {formatPence(e.finance!.estimatedPlayerCostPence)}</small></button></li>)}
        </ul> : <p className="savings-goal__none">No paid events you can enter in the next 20 weeks.</p>}
        <p className="savings-goal__picker-title">Or name an amount</p>
        <form className="savings-goal__custom" onSubmit={ev => { ev.preventDefault(); if (label.trim() && pounds >= 100) set.mutate({ label: label.trim(), targetPence: pounds }, { onSuccess: done, onError: fail }); }}>
          <label><span>What for</span><input value={label} maxLength={60} onChange={e => setLabel(e.target.value)} placeholder="New darts" /></label>
          <label><span>Amount (£)</span><input value={amount} inputMode="decimal" onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="150" /></label>
          <button type="submit" className="career-btn career-btn-primary" disabled={set.isPending || !label.trim() || !(pounds >= 100)}>Save for this</button>
        </form>
        <button type="button" className="career-btn career-btn-ghost" onClick={() => setChoosing(false)}>Cancel</button>
      </div>}
      {message && <p className="savings-goal__message" role="status">{message}</p>}
    </div>
  );
}
