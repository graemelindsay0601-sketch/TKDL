import { useState } from "react";
import { BadgePercent, Briefcase, Clapperboard, Handshake, Shirt, UserPlus } from "lucide-react";
import { errorMessage, useAnswerAffiliate, useAnswerPlatform, useDropMerch, useSetTeam, type StreamingView } from "../api";
import { formatPence } from "../model";
import "./stream-community.css";

/** The business desk: merch drops, affiliate codes, the team you hire, and the platform's exclusivity offer. */
export function BusinessSection({ saveId, d, retired }: { saveId: string; d: StreamingView; retired: boolean }) {
  const b = d.business;
  const drop = useDropMerch(saveId), aff = useAnswerAffiliate(saveId), team = useSetTeam(saveId), platform = useAnswerPlatform(saveId);
  const [item, setItem] = useState("SHIRT"), [units, setUnits] = useState(50), [message, setMessage] = useState("");
  if (!b) return null;
  const fail = (e: unknown) => setMessage(errorMessage(e)), ok = () => setMessage("");
  const chosen = b.merch.items.find(i => i.key === item) ?? b.merch.items[0];
  const wages = b.team.filter(t => t.hired).reduce((n, t) => n + t.wagePence, 0);
  return <section className="sc-panel" id="business" aria-labelledby="business-title">
    <div className="sc-head"><div><span className="sc-eyebrow"><b>09</b> / BUSINESS · THE CHANNEL AS A LIVING</span><h2 id="business-title">Run the business</h2>
      <p>Merch your community actually wants, a code with a brand, the people who make the channel bigger, and the offers that come with being big.</p></div>
      <div className="sc-stats"><span><Briefcase aria-hidden /> <span>Team wages <b>{formatPence(wages)}</b>/week</span></span></div></div>
    {b.platform.offer !== null && <div className="sc-celebrate">
      <Handshake aria-hidden />
      <div><b>{b.platform.name} wants you exclusive: {formatPence(b.platform.offer)}</b><small>Paid now for the rest of this season on {b.platform.name}. While it lasts: no collabs and rooms about a fifth smaller. Your call.</small></div>
      <button type="button" disabled={retired || platform.isPending} onClick={() => platform.mutate(true, { onSuccess: ok, onError: fail })}>Sign</button>
      <button type="button" className="sc-ghost" disabled={retired || platform.isPending} onClick={() => platform.mutate(false, { onSuccess: ok, onError: fail })}>Turn it down</button>
    </div>}
    {b.platform.active && <p className="sc-note">You're exclusive to {b.platform.name} this season: no collabs, smaller rooms, the money's in the bank.</p>}
    <div className="sc-content-grid">
      <article className="sc-card"><h3><Shirt aria-hidden /> Merch drops</h3>
        <p className="sc-note">You pay for the stock now; it sells over four weeks to loyal regulars and followers. Named emotes on the design sell better. The stock is the most you can lose.</p>
        {b.merch.open ? <>
          <div className="sc-choice" role="radiogroup" aria-label="Item">{b.merch.items.map(i => <button type="button" key={i.key} role="radio" aria-checked={item === i.key} onClick={() => setItem(i.key)}>
            <b>{i.name}</b><small>{formatPence(i.unitCostPence)} to make · sells {formatPence(i.pricePence)}</small></button>)}</div>
          <div className="sc-choice sc-choice--row" role="radiogroup" aria-label="How many">{b.merch.batches.map(n => <button type="button" key={n} role="radio" aria-checked={units === n} onClick={() => setUnits(n)}><b>{n}</b></button>)}</div>
          <button type="button" className="sc-enter" disabled={retired || drop.isPending} onClick={() => drop.mutate({ item, units }, { onSuccess: ok, onError: fail })}>
            Order {units} × {chosen.name} · {formatPence(chosen.unitCostPence * units)}</button>
        </> : <p className="sc-note">{b.merch.why}</p>}
        {b.merch.drops.length > 0 && <ul className="sc-rows">{b.merch.drops.map(x => <li key={x.id}><span><b>{x.item}</b><small> · S{x.season} wk {x.week}{x.onSale ? " · on sale" : ""}</small></span>
          <small>{x.sold}/{x.units} sold · {formatPence(x.revenuePence - x.costPence)} {x.revenuePence >= x.costPence ? "profit" : "so far"}</small></li>)}</ul>}
      </article>
      <article className="sc-card"><h3><BadgePercent aria-hidden /> Affiliate code</h3>
        <p className="sc-note">A brand gives you a code; each month your viewers' purchases pay you a cut. One at a time.</p>
        {b.affiliate.active ? <ul className="sc-rows"><li><span><b>{b.affiliate.active.brand}</b><small> · paid {formatPence(b.affiliate.active.paidPence)} so far</small></span>
          <button type="button" disabled={aff.isPending} onClick={() => aff.mutate({ id: b.affiliate.active!.id, action: "END" }, { onSuccess: ok, onError: fail })}>End it</button></li></ul>
          : b.affiliate.offer ? <ul className="sc-rows"><li><span><b>{b.affiliate.offer.brand}</b><small> · offering you a code</small></span>
            <span className="sc-pair"><button type="button" disabled={retired || aff.isPending} onClick={() => aff.mutate({ id: b.affiliate.offer!.id, action: "ACCEPT" }, { onSuccess: ok, onError: fail })}>Take it</button>
              <button type="button" disabled={aff.isPending} onClick={() => aff.mutate({ id: b.affiliate.offer!.id, action: "DECLINE" }, { onSuccess: ok, onError: fail })}>No thanks</button></span></li></ul>
          : <p className="sc-note">{b.affiliate.why ?? "Brands come calling every couple of months."}</p>}
      </article>
      <article className="sc-card"><h3><UserPlus aria-hidden /> Your team</h3>
        <ul className="sc-rows">{b.team.map(t => <li key={t.role}><span><b>{t.name}</b><small> · {t.blurb} {formatPence(t.wagePence)}/week.</small></span>
          {t.hired ? <button type="button" disabled={team.isPending} onClick={() => team.mutate({ role: t.role, hire: false }, { onSuccess: ok, onError: fail })}>Let go</button>
            : t.available ? <button type="button" disabled={retired || team.isPending} onClick={() => team.mutate({ role: t.role, hire: true }, { onSuccess: ok, onError: fail })}>Hire</button>
            : <small>{t.why}</small>}</li>)}</ul>
      </article>
      <article className="sc-card"><h3><Clapperboard aria-hidden /> Where the money comes from</h3>
        <p className="sc-note">Subs, bits and super chats on stream; ads on live and VOD watch time; brand deals and campaigns; Shorts; merch; your affiliate code; the podcast sponsor; cup and Invitational prizes. It all lands in your Career balance.</p>
      </article>
    </div>
    {message && <p className="sc-error" role="alert">{message}</p>}
  </section>;
}
