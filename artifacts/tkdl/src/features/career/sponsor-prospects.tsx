import { Link } from "wouter";
import { CheckCircle2, Handshake, Lock } from "lucide-react";
import { useSponsors } from "./api";
import { formatPence } from "./model";
import "./sponsor-prospects.css";

type Prospect = { tier: string; name: string; sponsors: number; met: boolean; requirement: string | null; progress: string | null; signed: boolean; topSigningBonusPence: number; example: string | null };
const prospectsOf = (d: unknown) => ((d as { prospects?: Prospect[] } | undefined)?.prospects ?? []);

/** Sponsor HQ: who could sign you next, tier by tier, and what they want. */
export function SponsorProspects({ saveId }: { saveId: string }) {
  const q = useSponsors(saveId), list = prospectsOf(q.data);
  if (!list.length) return null;
  return <section className="sponsor-prospects" aria-labelledby="sponsor-prospects-title">
    <h2 id="sponsor-prospects-title"><Handshake aria-hidden /> Who could sign you next</h2>
    <p>Sponsors come to you: once you meet a tier's requirement, offers start arriving after your events (while you've room in your portfolio).</p>
    <ol>{list.map(p => <li key={p.tier} data-met={p.met || undefined} data-signed={p.signed || undefined}>
      <span className="sponsor-prospects__icon" aria-hidden>{p.met ? <CheckCircle2 /> : <Lock />}</span>
      <div><b>{p.name}</b><small>{p.sponsors} brands{p.topSigningBonusPence ? ` · signing bonuses up to ${formatPence(p.topSigningBonusPence)}` : ""}</small>
        <span>{p.signed ? "You have one of these." : p.met ? "You qualify: offers can arrive after your next events." : `To get there: ${p.requirement}.`}</span>
        {!p.met && p.progress && <em>{p.progress}</em>}</div>
    </li>)}</ol>
  </section>;
}

/** Home: one line on your next sponsor and how close you are. */
export function NextSponsorLine({ saveId }: { saveId: string }) {
  const q = useSponsors(saveId), list = prospectsOf(q.data);
  const next = list.find(p => !p.signed && !p.met), ready = list.find(p => !p.signed && p.met);
  if (!list.length || (!next && !ready)) return null;
  return <Link href={`/career/${saveId}/sponsors`} className="money-match-line sponsor-line"><Handshake aria-hidden />
    <span>{ready ? <><b>{ready.name}</b> will talk to you now: offers arrive after your events.</> : <><b>Next sponsor:</b> {next!.name.toLowerCase()} want you to {next!.requirement}{next!.progress ? ` (${next!.progress})` : ""}.</>}</span>
  </Link>;
}
