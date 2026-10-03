import { Award, ChevronRight, Crown, ExternalLink, Medal, Skull, TrendingDown, TrendingUp, X } from "lucide-react";
import { Link } from "wouter";
import { ShareCardButton } from "@/components/ShareCardButton";
import { renderMatchPoster } from "@/lib/match-poster-art";

// This modal's "Share result" button and the Poster Library (see
// pages/poster-library.tsx) show the same real match result, so they share
// the one poster design (lib/match-poster-art.ts) rather than each having
// their own look. `competition` here is a free-text label set by whichever
// submit-match.tsx form built this receipt ("Singles League", "Doubles
// Event", "Shift Wars", "Team Match" / "2v1 Team Match", ...) rather than
// one of the four fixed format names, hence the pattern match below instead
// of a direct lookup.
function posterFormatFor(competition: string): string {
  if (/shift wars/i.test(competition)) return "Shift Wars";
  if (/doubles/i.test(competition)) return "Doubles Event";
  if (/team match/i.test(competition)) return "Team Match";
  return "Singles";
}
const FORMAT_ACCENT: Record<string, string> = { Singles: "#ff005c", "Doubles Event": "#0066ff", "Shift Wars": "#22c55e", "Team Match": "#ffd24a" };

export type FinalWhistleParticipant = {
  id?: number;
  name: string;
  result: "win" | "loss";
  pointsBefore: number;
  pointsAfter: number;
  eloBefore?: number | null;
  eloAfter?: number | null;
  rank?: number | null;
  rankChange?: number;
  record?: string;
  eliminated?: boolean;
};

export type FinalWhistleReceipt = {
  matchKey: string;
  competition: string;
  gameType: string;
  winnerName: string;
  loserName: string;
  stake: number;
  participants: FinalWhistleParticipant[];
};

function signed(value: number) { return `${value > 0 ? "+" : ""}${value}`; }

function RankMove({ rank, change }: { rank?: number | null; change?: number }) {
  if (!rank) return <span className="text-white/25">Rank updating</span>;
  if (!change) return <span className="text-white/40">#{rank} · Held position</span>;
  const up = change > 0;
  return <span className="inline-flex items-center gap-1" style={{ color: up ? "#22c55e" : "#ff5b87" }}>{up ? <TrendingUp size={13}/> : <TrendingDown size={13}/>}#{rank} · {Math.abs(change)} place{Math.abs(change) === 1 ? "" : "s"} {up ? "up" : "down"}</span>;
}

export function FinalWhistle({ receipt, onClose }: { receipt: FinalWhistleReceipt; onClose: () => void }) {
  const winners = receipt.participants.filter(row => row.result === "win");
  const losers = receipt.participants.filter(row => row.result === "loss");
  return <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-5" style={{ background:"rgba(1,2,8,.88)", backdropFilter:"blur(12px)" }} onClick={event => event.target === event.currentTarget && onClose()}>
    <section className="w-full sm:max-w-2xl max-h-[94dvh] overflow-y-auto rounded-t-[26px] sm:rounded-[26px]" style={{ background:"radial-gradient(circle at 50% -10%,rgba(255,210,74,.16),transparent 38%),linear-gradient(155deg,#111226,#070811 68%)", border:"1px solid rgba(255,210,74,.28)", boxShadow:"0 30px 100px rgba(0,0,0,.75)" }}>
      <div className="relative overflow-hidden px-5 sm:px-8 pt-7 pb-6 text-center" style={{ borderBottom:"1px solid rgba(255,255,255,.07)" }}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 p-2 rounded-full text-white/40 hover:text-white" style={{ background:"rgba(255,255,255,.05)" }} aria-label="Close result"><X size={18}/></button>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[.18em]" style={{ color:"#ffd24a", border:"1px solid rgba(255,210,74,.28)", background:"rgba(255,210,74,.07)", fontFamily:"Oswald, sans-serif" }}><Medal size={13}/> Final Whistle</div>
        <div className="mt-3 text-[11px] font-bold uppercase tracking-[.18em] text-white/35" style={{ fontFamily:"Oswald, sans-serif" }}>{receipt.competition} · {receipt.gameType || "501"}</div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="min-w-0"><Crown className="mx-auto mb-1 text-emerald-400" size={18}/><strong className="block truncate uppercase text-lg sm:text-2xl text-emerald-400" style={{ fontFamily:"Oswald, sans-serif" }}>{receipt.winnerName}</strong><small className="font-black uppercase tracking-widest text-emerald-400/50">Winners</small></div>
          <div><div className="font-black text-2xl text-white/15" style={{ fontFamily:"Oswald, sans-serif" }}>BEAT</div><div className="mt-1 font-black text-[#ffd24a]">{receipt.stake} pts</div></div>
          <div className="min-w-0"><Skull className="mx-auto mb-1 text-[#ff5b87]" size={18}/><strong className="block truncate uppercase text-lg sm:text-2xl text-[#ff5b87]" style={{ fontFamily:"Oswald, sans-serif" }}>{receipt.loserName}</strong><small className="font-black uppercase tracking-widest text-[#ff5b87]/50">Defeated</small></div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          {[...winners,...losers].map((row,index) => {
            const won=row.result === "win", delta=row.pointsAfter-row.pointsBefore;
            return <article key={`${row.id ?? row.name}-${index}`} className="rounded-xl p-4" style={{ background:won?"rgba(34,197,94,.055)":"rgba(255,0,92,.05)", border:`1px solid ${won?"rgba(34,197,94,.2)":"rgba(255,0,92,.18)"}` }}>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><small className="font-black uppercase tracking-widest" style={{ color:won?"#22c55e":"#ff5b87", fontFamily:"Oswald, sans-serif" }}>{won?"Winner":"Defeated"}</small><strong className="block truncate uppercase text-base text-white" style={{ fontFamily:"Oswald, sans-serif" }}>{row.name}</strong></div><span className="font-black text-lg" style={{ color:won?"#22c55e":"#ff5b87", fontFamily:"Oswald, sans-serif" }}>{signed(delta)}</span></div>
              <div className="mt-3 flex items-end justify-between"><div><small className="block text-[10px] uppercase tracking-wider text-white/25">Points</small><span className="text-sm text-white/40 line-through">{row.pointsBefore}</span><ChevronRight className="inline mx-1 text-white/20" size={13}/><strong className="text-lg text-white">{row.pointsAfter}</strong></div>{row.eloBefore != null && row.eloAfter != null && <div className="text-right"><small className="block text-[10px] uppercase tracking-wider text-white/25">Elo</small><span className="text-sm text-white/55">{row.eloAfter} <b style={{ color:won?"#22c55e":"#ff5b87" }}>{signed(row.eloAfter-row.eloBefore)}</b></span></div>}</div>
              <div className="mt-3 pt-3 flex items-center justify-between gap-2 text-xs" style={{ borderTop:"1px solid rgba(255,255,255,.06)" }}><RankMove rank={row.rank} change={row.rankChange}/>{row.record && <span className="text-white/35">{row.record}</span>}{row.eliminated && <span className="font-black uppercase text-[#ff5b87]">Eliminated</span>}</div>
            </article>;
          })}
        </div>

        <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background:"rgba(168,85,247,.055)", border:"1px solid rgba(168,85,247,.18)" }}><Award className="shrink-0 mt-0.5 text-purple-400" size={18}/><div><strong className="block text-xs uppercase tracking-wider text-purple-300" style={{ fontFamily:"Oswald, sans-serif" }}>Awards check running</strong><p className="mt-0.5 text-xs leading-relaxed text-white/40">Achievements and notifications finish safely in the background. Any new award will appear in the player’s profile and notification centre.</p></div></div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Link href={`/match-centre/${receipt.matchKey}`} onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-xs font-black uppercase tracking-wider text-white" style={{ background:"rgba(0,102,255,.15)", border:"1px solid rgba(0,102,255,.3)", fontFamily:"Oswald, sans-serif" }}><ExternalLink size={14}/>Match record</Link>
          <Link href="/leaderboard" onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-xs font-black uppercase tracking-wider text-white" style={{ background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.1)", fontFamily:"Oswald, sans-serif" }}>Standings</Link>
          <ShareCardButton className="col-span-2 sm:col-span-1" filename={`tkdl-result-${receipt.matchKey}`} label="Share result"
            spec={{ eyebrow:`${receipt.competition} · Final Whistle`, title:`${receipt.winnerName} beat ${receipt.loserName}`, subtitle:`${receipt.gameType || "501"} · ${receipt.stake} points at stake`, accent: FORMAT_ACCENT[posterFormatFor(receipt.competition)] }}
            render={() => renderMatchPoster({
              format: posterFormatFor(receipt.competition),
              kicker: receipt.stake >= 20 ? "Big Result" : receipt.stake >= 10 ? "Match Result" : "Final Whistle",
              winnerName: receipt.winnerName, loserName: receipt.loserName, stake: receipt.stake,
              gameType: receipt.gameType || "501",
              accent: FORMAT_ACCENT[posterFormatFor(receipt.competition)],
            })}
          />
        </div>
        <button type="button" onClick={onClose} className="w-full py-3 text-xs font-black uppercase tracking-[.16em] text-white/45 hover:text-white" style={{ fontFamily:"Oswald, sans-serif" }}>Record another result</button>
      </div>
    </section>
  </div>;
}
