import { useState } from "react";
import { Link } from "wouter";
import { useLeaveManager, useManager, useSignManager, errorMessage } from "./api";
import { formatPence } from "./model";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Finances: your manager. Firms sign you on what you have achieved (prize money won, a Tour Card). They earn only from what
 * they bring: their cut of the sponsor deals they set up and of the prize money from invitations they get you. Events you
 * enter yourself and deals you find yourself are all yours.
 */
export function ManagerPanel({ saveId, retired }: { saveId: string; retired: boolean }) {
  const q = useManager(saveId);
  const sign = useSignManager(saveId), leave = useLeaveManager(saveId);
  const [message, setMessage] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  if (!q.data) return q.isLoading ? <p className="manager__note">Loading…</p> : null;
  const d = q.data, e = d.earned, busy = sign.isPending || leave.isPending;
  const fail = (err: unknown) => setMessage(errorMessage(err));
  const doors = (list: string[]) => list.length ? `Gets you into ${list.join(" and ")} when your ranking is close enough` : "Sponsor deals only";

  return (
    <div className="manager">
      <p className="manager__note">A manager only earns from what they bring you: their cut of the sponsor deals they set up, and of the prize money from invitations
        you'd never have got on your own. Events you enter yourself and deals you find yourself are all yours.</p>
      {d.current ? <div className="manager__current">
        <p className="manager__title"><b>{d.current.name}</b> <small>{d.current.kind} · since season {d.current.signedSeason}, week {d.current.signedWeek} · takes {pct(d.current.commission)}</small></p>
        <p className="manager__terms">{doors(d.current.doors)}.</p>
        {!retired && (confirmLeave
          ? <div className="manager__actions"><span>Part company? They keep their cut of the deals and invitations they've already arranged, and won't take you back until next season.</span>
            <button type="button" className="career-btn career-btn-ghost" disabled={busy} onClick={() => leave.mutate(undefined, { onSuccess: () => { setConfirmLeave(false); setMessage(`You left ${d.current!.name}.`); }, onError: fail })}>Yes, leave</button>
            <button type="button" className="career-btn career-btn-ghost" onClick={() => setConfirmLeave(false)}>Keep them</button></div>
          : <div className="manager__actions"><button type="button" className="career-btn career-btn-ghost" onClick={() => setConfirmLeave(true)}>Leave your manager</button></div>)}
      </div> : <p className="manager__note">No manager. You've won {formatPence(d.careerPrizePence)} in prize money{d.tourCard ? " and hold a Tour Card" : ""}.</p>}
      {(e.totalPence > 0 || e.deals.length > 0 || e.invitations.length > 0) && <div className="manager__earned">
        <dl className="manager__figures">
          <div><dt>Cut of sponsor deals</dt><dd>{formatPence(e.fromDealsPence)}</dd></div>
          <div><dt>Cut of invitation prize money</dt><dd>{formatPence(e.fromInvitationsPence)}</dd></div>
          <div><dt>Taken this season</dt><dd>{formatPence(e.thisSeasonPence)}</dd></div>
          <div><dt>Extra signing bonuses they won you</dt><dd>{formatPence(e.extraSigningBonusPence)}</dd></div>
        </dl>
        {e.deals.length > 0 && <p className="manager__list"><b>Deals they set up:</b> {e.deals.map(x => `${x.sponsor}${x.active ? "" : " (ended)"} · ${x.managerName}`).join("; ")}</p>}
        {e.invitations.length > 0 && <ul className="manager__invites">{e.invitations.map(x => <li key={x.eventId}>
          <Link href={`/career/${saveId}/events/${x.eventId}`}>{x.name}</Link> <small>S{x.season} · {x.managerName}{x.prizePence ? ` · won ${formatPence(x.prizePence)}, their cut ${formatPence(x.cutPence)}` : ""}</small></li>)}</ul>}
      </div>}
      <ul className="manager__firms">
        {d.firms.map(f => <li key={f.key} data-current={f.current || undefined}>
          <div className="manager__firm-head"><b>{f.name}</b><small>{f.kind}</small></div>
          <p className="manager__blurb">{f.blurb}</p>
          <p className="manager__terms">Takes {pct(f.commission)} of what they bring in · sponsor signing bonuses +{pct(f.signingBonusBoost)}
            {f.extraOffers ? ` · ${f.extraOffers} more sponsor offer each time sponsors look at you` : ""} · {f.doors.length ? `invitations: ${f.doors.join(" and ")}` : "sponsor deals only"}</p>
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
