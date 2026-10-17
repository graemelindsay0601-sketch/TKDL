import { useState } from "react";
import { useLeaveManager, useManager, useSignManager, errorMessage } from "./api";
import { formatPence } from "./model";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Finances: your manager. Firms sign you on what you have achieved (prize money won, a Tour Card); each takes a cut of
 * your cash prizes and gets you bigger sponsor signing bonuses, better-paid appearances and, the bigger ones, more offers.
 */
export function ManagerPanel({ saveId, retired }: { saveId: string; retired: boolean }) {
  const q = useManager(saveId);
  const sign = useSignManager(saveId), leave = useLeaveManager(saveId);
  const [message, setMessage] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  if (!q.data) return q.isLoading ? <p className="manager__note">Loading…</p> : null;
  const d = q.data, busy = sign.isPending || leave.isPending;
  const fail = (e: unknown) => setMessage(errorMessage(e));

  return (
    <div className="manager">
      {d.current ? <div className="manager__current">
        <p className="manager__title"><b>{d.current.name}</b> <small>{d.current.kind} · since season {d.current.signedSeason}, week {d.current.signedWeek}</small></p>
        <dl className="manager__figures">
          <div><dt>Their cut</dt><dd>{pct(d.current.commission)} of prize money</dd></div>
          <div><dt>Taken this season</dt><dd>{formatPence(d.current.commissionThisSeasonPence)}</dd></div>
          <div><dt>Taken in all</dt><dd>{formatPence(d.current.commissionTotalPence)}</dd></div>
          <div><dt>Extra signing bonuses won</dt><dd>{formatPence(d.current.extraSigningBonusPence)}</dd></div>
        </dl>
        {!retired && (confirmLeave
          ? <div className="manager__actions"><span>Part company? You can't go back to them until next season.</span>
            <button type="button" className="career-btn career-btn-ghost" disabled={busy} onClick={() => leave.mutate(undefined, { onSuccess: () => { setConfirmLeave(false); setMessage(`You left ${d.current!.name}.`); }, onError: fail })}>Yes, leave</button>
            <button type="button" className="career-btn career-btn-ghost" onClick={() => setConfirmLeave(false)}>Keep them</button></div>
          : <div className="manager__actions"><button type="button" className="career-btn career-btn-ghost" onClick={() => setConfirmLeave(true)}>Leave your manager</button></div>)}
      </div> : <p className="manager__note">No manager. You keep every penny of your prize money, but you negotiate sponsors and appearances on your own.
        {" "}You've won {formatPence(d.careerPrizePence)} in prize money{d.tourCard ? " and hold a Tour Card" : ""}.</p>}
      <ul className="manager__firms">
        {d.firms.map(f => <li key={f.key} data-current={f.current || undefined}>
          <div className="manager__firm-head"><b>{f.name}</b><small>{f.kind}</small></div>
          <p className="manager__blurb">{f.blurb}</p>
          <p className="manager__terms">Takes {pct(f.commission)} of prize money · sponsor signing bonuses +{pct(f.signingBonusBoost)} · appearance fees +{pct(f.appearanceBoost)}
            {f.extraOffers ? ` · ${f.extraOffers} more sponsor offer each time sponsors look at you` : ""}</p>
          {f.current ? <span className="manager__state" data-tone="good">Your manager</span>
            : f.unmet.length ? <span className="manager__state">Will sign you once you {f.unmet.map(u => u[0].toLowerCase() + u.slice(1)).join(" and ")}</span>
            : f.leftThisSeason ? <span className="manager__state">You left them this season. Try again next season.</span>
            : !retired && <button type="button" className="career-btn career-btn-primary" disabled={busy}
                onClick={() => sign.mutate(f.key, { onSuccess: () => setMessage(`You signed with ${f.name}.`), onError: fail })}>{d.current ? `Switch to ${f.name}` : `Sign with ${f.name}`}</button>}
        </li>)}
      </ul>
      {message && <p className="manager__message" role="status">{message}</p>}
    </div>
  );
}
