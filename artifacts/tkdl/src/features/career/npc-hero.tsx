import { Link } from "wouter";
import { useWorldPlayers } from "./api";
import { CareerShirt } from "./identity";
import { country, titleCase } from "./model";
import { CareerPageHero } from "./page-hero";
import type { ShellContext } from "./shell";

/** Shared header for another player's pages (history, public presentation, recognition): their shirt, standing and the links between those pages. */
export function NpcHero({ ctx, npcId, current, kicker }: { ctx: ShellContext; npcId: string; current: "history" | "life" | "recognition"; kicker: string }) {
  const q = useWorldPlayers(ctx.save.id, 0, "", "ALL", npcId);
  const p = q.data?.players.find(x => x.id === npcId);
  const base = `/career/${ctx.save.id}`;
  const links: [string, string, string][] = [["profile", `${base}/world/players/${npcId}/profile`, "Full profile"], ["history", `${base}/history/npcs/${npcId}`, "Career history"],
    ["life", `${base}/life/npcs/${npcId}`, "Public presentation"], ["recognition", `${base}/recognition/npcs/${npcId}`, "Recognition"], ["h2h", `${base}/world/rivalries/${npcId}`, "Head-to-head"]];
  return <CareerPageHero kicker={kicker} title={p?.name ?? "Player"} accent="#69b8ec" stage={{ venue: { venueType: "professional-floor" }, eventClass: "PROFESSIONAL_TOUR" }}
    subtitle={p ? <p>{[country(String(p.country))?.name ?? String(p.country), p.ranking ? `World #${p.ranking}` : "Unranked", titleCase(String(p.status))].filter(Boolean).join(" · ")}</p> : undefined}
    portrait={<CareerShirt playerId={npcId} name={p?.name ?? "Player"} identity={p?.shirt} sponsors={p?.commercial.portfolio} scale="featured" />}>
    <nav className="career-npc-nav" aria-label="Player pages">{links.map(([k, href, label]) => <Link key={k} href={href} aria-current={k === current ? "page" : undefined}>{label}</Link>)}</nav>
  </CareerPageHero>;
}
