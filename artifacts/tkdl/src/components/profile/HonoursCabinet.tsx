import { Link } from "wouter";
import { useFetch } from "@/hooks/use-fetch";
import { Chapter } from "@/components/premium/Premium";

type Honour = { competition: "Singles" | "Doubles" | "Shift Wars"; seasonId: number; seasonName: string; position: 1 | 2 | 3; team?: string };
const PLACE = { 1: "Champion", 2: "Runner-up", 3: "Third" } as const;
const art = (h: Honour) => h.position === 1 ? (h.competition === "Singles" ? "/achievements-v2/titles-gold.webp" : "/achievements-v2/titles-platinum.webp")
  : h.position === 2 ? "/achievements-v2/top-three-silver.webp" : "/achievements-v2/top-three-bronze.webp";

/** The real silverware: podium finishes across Singles, Doubles and Shift Wars, on a lit shelf. Hidden until there's one. */
export function HonoursCabinet({ playerId }: { playerId: number }) {
  const { data } = useFetch<{ honours: Honour[] }>(`/api/players/${playerId}/honours`);
  const list = data?.honours ?? [];
  if (!list.length) return null;
  const count = (p: number) => list.filter(h => h.position === p).length;
  const rows: Honour[][] = []; for (let i = 0; i < list.length; i += 3) rows.push(list.slice(i, i + 3));
  return (
    <section id="pm-honours" style={{ scrollMarginTop: 64 }}>
      <Chapter title="Honours" accent="#ffd24a" aside={
        <span className="flex gap-1.5">
          {[1, 2, 3].map(p => count(p) > 0 && <span key={p} className={`pm-honour-count p${p}`}>{count(p)}</span>)}
        </span>} />
      <div className="pm-honours">
        {rows.map((row, i) => (
          <div key={i} className="shelf">
            {row.map(h => (
              <Link key={`${h.competition}-${h.seasonId}`} href={`/seasons/${h.seasonId}`} className="piece">
                <div className="spot" />
                <img src={art(h)} alt="" loading="lazy" />
                <div className={`place p${h.position}`}>{PLACE[h.position]}</div>
                <div className="what">{h.competition}{h.team ? ` · ${h.team}` : ""}</div>
                <div className="when">{h.seasonName}</div>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
