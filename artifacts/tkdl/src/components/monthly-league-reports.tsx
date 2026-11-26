import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { Crown, Zap, Target, TrendingUp, Trophy } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { ShareCardButton } from "@/components/ShareCardButton";
import { Chapter, PmCard } from "@/components/premium/Premium";

type Competition = { leagueType: string; seasonId: number | null; seasonName: string | null; championId: number | null; championName: string | null; isActive: boolean; matchCount: number };
type Report = {
  monthKey: string; label: string; isCurrent: boolean; totalMatches: number; competitions: Competition[];
  playerOfMonth: { playerId: number; playerName: string; wins: number } | null;
  biggestUpset?: { winnerId: number; winnerName: string; loserName: string; elo: number } | null;
  most180s?: { playerId: number; playerName: string; count: number } | null;
  sharpest?: { playerId: number; playerName: string; wins: number; played: number; rate: number } | null;
};

type Award = { key: string; kicker: string; name: string; stat: string; href?: string; color: string; icon: React.ReactNode };
function awardsOf(r: Report): Award[] {
  const out: Award[] = [];
  const champ = r.competitions.find(c => c.leagueType === "singles" && !c.isActive && c.championName);
  if (champ) out.push({ key: "champ", kicker: "Champion", name: champ.championName!, stat: champ.seasonName ?? "Singles", href: champ.championId ? `/players/${champ.championId}` : undefined, color: "#ffd24a", icon: <Crown className="w-5 h-5" /> });
  if (r.playerOfMonth) out.push({ key: "potm", kicker: "Player of the month", name: r.playerOfMonth.playerName, stat: `${r.playerOfMonth.wins} wins`, href: `/players/${r.playerOfMonth.playerId}`, color: "#ffb020", icon: <Trophy className="w-5 h-5" /> });
  if (r.biggestUpset) out.push({ key: "upset", kicker: "Biggest upset", name: r.biggestUpset.winnerName, stat: `beat ${r.biggestUpset.loserName} · +${r.biggestUpset.elo} ELO`, href: `/players/${r.biggestUpset.winnerId}`, color: "#ff5c93", icon: <Zap className="w-5 h-5" /> });
  if (r.most180s) out.push({ key: "180", kicker: "Most 180s", name: r.most180s.playerName, stat: `${r.most180s.count} maximum${r.most180s.count === 1 ? "" : "s"}`, href: `/players/${r.most180s.playerId}`, color: "#4fa8ff", icon: <Target className="w-5 h-5" /> });
  if (r.sharpest) out.push({ key: "sharp", kicker: "Sharpest", name: r.sharpest.playerName, stat: `${Math.round(r.sharpest.rate * 100)}% from ${r.sharpest.played} matches`, href: `/players/${r.sharpest.playerId}`, color: "#3ee0b4", icon: <TrendingUp className="w-5 h-5" /> });
  return out;
}

function AwardTile({ a }: { a: Award }) {
  const body = (
    <div className="pm-award" style={{ ["--ac" as string]: a.color }}>
      <div className="medal">{a.icon}</div>
      <div className="min-w-0">
        <div className="k">{a.kicker}</div>
        <div className="n">{a.name}</div>
        <div className="s">{a.stat}</div>
      </div>
    </div>
  );
  return a.href ? <Link href={a.href}>{body}</Link> : body;
}

/** Monthly awards. `compact` (the Hub) shows the latest month; the full view (Hall of Fame) lets you pick a month. */
export function MonthlyLeagueReports({ compact = false }: { compact?: boolean }) {
  const { data, loading } = useFetch<{ reports: Report[] }>("/api/insights/monthly-reports");
  const [selected, setSelected] = useState("");
  const reports = (data?.reports ?? []).filter(r => awardsOf(r).length > 0);
  useEffect(() => { if (!selected && reports[0]) setSelected(reports[0].monthKey); }, [reports, selected]);
  if (loading) return <div className="pm-card h-40 animate-pulse" />;
  const report = reports.find(r => r.monthKey === selected) ?? reports[0];
  if (!report) return null;
  const awards = awardsOf(report);
  return (
    <section data-testid="monthly-league-reports">
      <Chapter title="Monthly awards" accent="#ffb020"
        aside={compact ? <Link href="/hall-of-fame" className="pm-chip" style={{ color: "#ffd24a", borderColor: "rgba(255,210,74,.45)" }}>All months →</Link> : undefined} />
      <PmCard accent="#ffb020" className="p-4">
        <div className="flex items-center gap-2 flex-wrap mb-3" style={{ position: "relative", zIndex: 1 }}>
          <div className="pm-metal" style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, textTransform: "uppercase", letterSpacing: ".04em" }}>{report.label}</div>
          {report.isCurrent && <span className="pm-chip" style={{ color: "#ffc2d6", borderColor: "rgba(255,92,147,.45)" }}><span className="live-dot" /> So far</span>}
          <span className="ml-auto text-xs" style={{ color: "#a9a4bd" }}>{report.totalMatches} matches</span>
        </div>
        {!compact && reports.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2" style={{ position: "relative", zIndex: 1 }}>
            {reports.slice(0, 12).map(r => (
              <button key={r.monthKey} onClick={() => setSelected(r.monthKey)} className="pm-chip shrink-0"
                style={r.monthKey === report.monthKey ? { color: "#1a1200", background: "linear-gradient(180deg,#ffe58a,#e0a800)", borderColor: "#ffd24a" } : { color: "#c9c4da" }}>
                {r.label}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" style={{ position: "relative", zIndex: 1 }}>{awards.map(a => <AwardTile key={a.key} a={a} />)}</div>
        <div className="flex justify-end mt-3" style={{ position: "relative", zIndex: 1 }}>
          <ShareCardButton filename={`tkdl-awards-${report.monthKey}`} label="Share"
            spec={{ eyebrow: `TKDL · ${report.label}`, title: "Monthly awards", subtitle: `${report.totalMatches} matches`, badge: report.isCurrent ? "So far" : "Final", accent: "#ffd24a", secondaryAccent: "#ff5c93",
              stats: awards.slice(0, 3).map(a => ({ label: a.kicker, value: a.name })) }} />
        </div>
      </PmCard>
    </section>
  );
}
