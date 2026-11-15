import { useState } from "react";
import { Award, BadgePercent, Gift, Megaphone, Package, Trophy, Repeat, Crown, MapPin, Briefcase, Clapperboard, Handshake, Lock, Shirt, Store, UserPlus } from "lucide-react";
import { errorMessage, useAnswerAffiliate, useAnswerPartner, useAnswerPlatform, useAnswerSponsor, useDropMerch, useSetTeam, type StreamingView } from "../api";
import { formatPence } from "../model";
import "./stream-community.css";

/** The business desk: merch drops, affiliate codes, the team you hire, and the platform's exclusivity offer. */
export function BusinessSection({ saveId, d, retired }: { saveId: string; d: StreamingView; retired: boolean }) {
  const b = d.business;
  const drop = useDropMerch(saveId), aff = useAnswerAffiliate(saveId), team = useSetTeam(saveId), platform = useAnswerPlatform(saveId), sponsor = useAnswerSponsor(saveId), partner = useAnswerPartner(saveId);
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
    {b.dartsSponsors && <p className="sc-note">{b.dartsSponsors.premiumPercent > 0
      ? <>Darts sponsors have noticed the channel: <b>+{b.dartsSponsors.premiumPercent}%</b> on the signing bonus of your darts-career sponsor offers.</>
      : "Darts sponsors notice a big channel: from Partner, your darts-career sponsor offers come with a bigger signing bonus."}
      {b.dartsSponsors.next ? ` ${TIER_NAME[b.dartsSponsors.next.tier]}: +${b.dartsSponsors.next.premiumPercent}%.` : ""}</p>}
    {b.platform.active && <p className="sc-note">You're exclusive to {b.platform.name} this season: no collabs, smaller rooms, the money's in the bank.</p>}
    {b.sponsor && <SponsorLadder s={b.sponsor} retired={retired} busy={sponsor.isPending}
      answer={(id, action) => sponsor.mutate({ id, action }, { onSuccess: ok, onError: fail })} />}
    {b.partners && <BrandPartners p={b.partners} retired={retired} busy={partner.isPending}
      answer={(id, action) => partner.mutate({ id, action }, { onSuccess: ok, onError: fail })} />}
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

const TIER_NAME: Record<string, string> = { NEWCOMER: "Newcomer", AFFILIATE: "Affiliate", PARTNER: "Partner", STAR: "Star", ICON: "Icon", LEGEND: "Legend" };
const RUNG_ICON = [Store, Briefcase, BadgePercent, Award];

/** The sponsor ladder: one headline sponsor at a time, local backer to signature range. */
function SponsorLadder({ s, retired, busy, answer }: { s: StreamingView["business"]["sponsor"]; retired: boolean; busy: boolean;
  answer: (id: string, action: "ACCEPT" | "DECLINE" | "END") => void }) {
  return <div className="sc-ladder">
    <h3>Sponsor ladder <small>one headline sponsor at a time · paid for every week you go live</small></h3>
    <ol className="sc-cup-season sc-ladder-rungs">{s.rungs.map(r => { const Icon = r.status === "LOCKED" ? Lock : RUNG_ICON[r.rung - 1];
      return <li key={r.rung} data-status={r.status}>
        <Icon aria-hidden /><small>Rung {r.rung} · {TIER_NAME[r.minTier]}</small><b>{r.name}</b>
        <em>{r.status === "BANKED" ? `Banked${r.brand ? ` · ${r.brand}` : ""}` : r.status === "CURRENT" ? `Live · ${r.brand}` : r.status === "NEXT" ? "Next up" : "Locked"}</em>
        <span className="sc-rung-blurb">{r.blurb} {r.weeks} live weeks · +{r.fans} fans</span>
      </li>; })}</ol>
    {s.active ? <div className="sc-ladder-live">
      <div><b>{s.active.brand}</b><small> · {s.active.what} · {formatPence(s.active.weeklyPence)} a live week · {formatPence(s.active.paidPence)} so far</small></div>
      <span className="sc-loyalty" role="meter" aria-label="Sponsorship run" aria-valuemin={0} aria-valuemax={s.active.weeksTotal} aria-valuenow={s.active.weeksPaid}>
        <span style={{ width: `${Math.round(s.active.weeksPaid / s.active.weeksTotal * 100)}%` }} /></span>
      <small>{s.active.weeksPaid} of {s.active.weeksTotal} live weeks. See it through to bank the rung; walk away any time without a penalty.</small>
      <button type="button" disabled={busy} onClick={() => answer(s.active!.id, "END")}>Walk away</button>
    </div> : s.offer ? <div className="sc-celebrate">
      <Handshake aria-hidden />
      <div><b>{s.offer.brand} want to sponsor the channel: {formatPence(s.offer.weeklyPence)} a live week</b>
        <small>{s.offer.what[0].toUpperCase() + s.offer.what.slice(1)} · {s.offer.weeks} live weeks · offer open until week {s.offer.expiresWeek}</small></div>
      <button type="button" disabled={retired || busy} onClick={() => answer(s.offer!.id, "ACCEPT")}>Sign</button>
      <button type="button" className="sc-ghost" disabled={busy} onClick={() => answer(s.offer!.id, "DECLINE")}>Not now</button>
    </div> : s.why ? <p className="sc-note">{s.why}</p> : null}
  </div>;
}

const KIND_ICON = { RETAINER: Repeat, GIVEAWAY: Gift, SEEDING: Package, AMBASSADOR: Crown, CUP_TITLE: Trophy, APPEARANCE: MapPin } as const;

/** Brand partners: category sponsors alongside the headline one, each offer a different kind of deal. */
function BrandPartners({ p, retired, busy, answer }: { p: StreamingView["business"]["partners"]; retired: boolean; busy: boolean;
  answer: (id: string, action: "ACCEPT" | "DECLINE" | "END") => void }) {
  const terms = (o: { kind: string; feePence: number; weeks: number; followers: number }) =>
    o.kind === "RETAINER" || o.kind === "AMBASSADOR" ? `${formatPence(o.feePence)} a live week · ${o.weeks} weeks`
    : o.kind === "SEEDING" ? `Free kit · ${o.weeks} weeks · brand trust`
    : o.kind === "GIVEAWAY" ? `${formatPence(o.feePence)} · +${o.followers} followers · next live week`
    : o.kind === "APPEARANCE" ? `${formatPence(o.feePence)} now · +${o.followers} followers` : `${formatPence(o.feePence)} when you play it`;
  return <div className="sc-ladder sc-partners">
    <h3>Brand partners <small>{p.used}/{p.slots} slots · one brand per category · alongside your headline sponsor</small></h3>
    {p.offers.length > 0 && <ul className="sc-partner-list">{p.offers.map(o => { const Icon = KIND_ICON[o.kind] ?? Megaphone;
      return <li key={o.id} className="sc-partner" data-offer>
        <Icon aria-hidden />
        <div><span className="sc-partner-name"><b>{o.brand}</b><i className="sc-kind">{o.kindName}</i></span><small>{o.what} · {o.category}{o.cup ? ` · the ${o.cup}` : ""}</small>
          <small>{o.blurb}</small><span className="sc-terms">{terms(o)} · offer open until week {o.expiresWeek}</span>
          {o.clash && <small className="sc-clash">{o.clash}</small>}</div>
        <span className="sc-pair"><button type="button" disabled={retired || busy || !!o.clash} onClick={() => answer(o.id, "ACCEPT")}>{o.kind === "APPEARANCE" ? "Go" : "Sign"}</button>
          <button type="button" disabled={busy} onClick={() => answer(o.id, "DECLINE")}>No thanks</button></span>
      </li>; })}</ul>}
    {p.active.length > 0 && <ul className="sc-partner-list">{p.active.map(a => { const Icon = KIND_ICON[a.kind] ?? Megaphone;
      return <li key={a.id} className="sc-partner">
        <Icon aria-hidden />
        <div><span className="sc-partner-name"><b>{a.brand}</b><i className="sc-kind">{a.kindName}</i></span><small>{a.what} · {a.category}{a.cup ? ` · the ${a.cup}` : ""}</small>
          {(a.kind === "RETAINER" || a.kind === "AMBASSADOR" || a.kind === "SEEDING") ? <>
            <span className="sc-loyalty" role="meter" aria-label={`${a.brand} run`} aria-valuemin={0} aria-valuemax={a.weeksTotal} aria-valuenow={a.weeksPaid}>
              <span style={{ width: `${Math.round(a.weeksPaid / a.weeksTotal * 100)}%` }} /></span>
            <small>{a.weeksPaid} of {a.weeksTotal} {a.kind === "SEEDING" ? "weeks" : "live weeks"}{a.paidPence ? ` · ${formatPence(a.paidPence)} so far` : ""}</small></>
            : <small>{a.kind === "GIVEAWAY" ? "Runs on your next live stream" : "Paid when you play the cup"}</small>}</div>
        <button type="button" disabled={busy} onClick={() => answer(a.id, "END")}>End</button>
      </li>; })}</ul>}
    {p.why && <p className="sc-note">{p.why}</p>}
    {p.brands.length > 0 && <p className="sc-note">Brands that know you: {p.brands.map(x => `${x.brand} (+${x.bonusPercent}%${x.ambassador ? ", ambassador" : ""})`).join(" · ")}. Every finished deal makes a brand pay more; two and they'll offer an ambassadorship.</p>}
  </div>;
}
