import { Link } from "wouter";
import { Trophy } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";

type Rec = { id: number; title: string; unit: string; matchId: number; playerName: string; value: number; previous: number; previousHolder: string | null; at: string };

/** Hub banner for a league record broken in the last week (newest first). */
export function RecordBanner() {
  const { data } = useFetch<Rec[]>("/api/league-records/recent");
  const r = data?.[0];
  if (!r) return null;
  return (
    <Link href={`/match-centre/league-${r.matchId}`} className="pm-record" data-testid="record-banner">
      <span className="pm-record-shine" aria-hidden />
      <span className="pm-record-icon"><Trophy className="w-5 h-5" /></span>
      <span className="min-w-0">
        <span className="pm-record-kick">League record broken{data!.length > 1 ? ` · ${data!.length} this week` : ""}</span>
        <span className="pm-record-main"><b>{r.playerName}</b> · {r.title}</span>
        <span className="pm-record-sub">{r.value} {r.unit} · was {r.previous}{r.previousHolder ? ` (${r.previousHolder})` : ""}</span>
      </span>
    </Link>
  );
}
