import { NearlyThere } from "@/components/achievements-v2/NearlyThere";
import { Award, ChevronRight, Crown, ExternalLink, Medal, Skull, TrendingDown, TrendingUp, X } from "lucide-react";
import { Link } from "wouter";
import { ShareCardButton } from "@/components/ShareCardButton";
import { renderMatchPoster } from "@/lib/match-poster-art";
import { DartboardBackdrop, Glow } from "@/components/premium/Premium";

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

const OSW = "Oswald, sans-serif";

function InitialRing({ name, color, size }: { name: string; color: string; size: number }) {
  return (
    <div className="relative shrink-0 mx-auto" style={{ width: size, height: size }}>
      <div className="absolute pointer-events-none" style={{ inset: -6, borderRadius: "50%", background: `conic-gradient(from 0deg, transparent, ${color}99, transparent 30%, #c4b5fd99, transparent 65%)`, filter: "blur(6px)" }} />
      <div className="relative w-full h-full rounded-full" style={{ padding: 3, background: `conic-gradient(from 200deg, ${color}, #c4b5fd, ${color}, #ffffff, ${color})` }}>
        <div className="w-full h-full rounded-full flex items-center justify-center" style={{ background: "radial-gradient(circle at 35% 30%, #2f2850, #0f0d18)" }}>
          <span className="pm-chrome" style={{ fontFamily: OSW, fontWeight: 700, fontSize: size * 0.44 }}>{(name.trim()[0] ?? "?").toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, color, bg }: { label: string; value: React.ReactNode; color: string; bg: string }) {
  return (
    <div style={{ padding: 1, borderRadius: 14, background: `linear-gradient(140deg, ${color}, ${color}26 50%, ${color})` }}>
      <div style={{ borderRadius: 13, padding: "8px 11px", background: bg }}>
        <span className="pm-lab" style={{ fontSize: 9 }}>{label}</span>
        <div className="pm-num tabular-nums" style={{ fontSize: 22, color, textShadow: `0 0 14px ${color}80`, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

export function FinalWhistle({ receipt, onClose }: { receipt: FinalWhistleReceipt; onClose: () => void }) {
  const winners = receipt.participants.filter(row => row.result === "win");
  const losers = receipt.participants.filter(row => row.result === "loss");
  const accent = FORMAT_ACCENT[posterFormatFor(receipt.competition)] ?? "#ffd24a";
  return <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-5" style={{ background:"rgba(1,2,8,.88)", backdropFilter:"blur(12px)" }} onClick={event => event.target === event.currentTarget && onClose()}>
    <section className="fw-in relative w-full sm:max-w-2xl max-h-[94dvh] overflow-y-auto overflow-x-hidden rounded-t-[26px] sm:rounded-[26px]" style={{ border:"1px solid rgba(255,210,74,.4)", background:"linear-gradient(160deg, rgba(255,210,74,.18) 0%, #14102a 40%, #06060b 100%)", boxShadow:"0 30px 100px rgba(0,0,0,.75), 0 0 60px rgba(255,210,74,.12)" }}>
      <Glow x="88%" y="4%" color="#ffd24a" size={420} opacity={0.3} />
      <Glow x="6%" y="40%" color="#a855f7" size={380} opacity={0.26} />
      <Glow x="85%" y="70%" color={accent} size={340} opacity={0.14} />
      <DartboardBackdrop size={460} opacity={0.07} style={{ right: -170, top: -120, transform: "rotate(8deg)" }} />
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, background: "repeating-linear-gradient(115deg,#fff 0 1px,transparent 1px 12px)" }} />

      <div className="relative px-5 sm:px-8 pt-6 pb-5 text-center" style={{ zIndex: 1 }}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 p-2 rounded-full text-white/50 hover:text-white" style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.12)" }} aria-label="Close result"><X size={18}/></button>
        <span className="pm-chip" style={{ color:"#ffd24a", borderColor:"rgba(255,210,74,.5)", background:"rgba(255,210,74,.1)" }}><Medal size={13}/> Final Whistle</span>
        <div className="pm-lab mt-3" style={{ justifyContent:"center" }}>{receipt.competition} · {receipt.gameType || "501"}</div>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="min-w-0 fw-pop">
            <InitialRing name={receipt.winnerName} color="#4ade80" size={64} />
            <div className="mt-2 flex items-center justify-center gap-1.5"><Crown size={14} className="text-[#ffd24a]" /><span className="pm-lab" style={{ color:"#4ade80" }}>Winner</span></div>
            <strong className="pm-chrome block uppercase leading-none mt-1" style={{ fontFamily:OSW, fontWeight:700, fontSize:"clamp(1.3rem, 6vw, 2rem)", overflowWrap:"anywhere" }}>{receipt.winnerName}</strong>
          </div>
          <div className="px-1">
            <span className="pm-lab" style={{ justifyContent:"center" }}>def.</span>
            <div className="pm-metal mt-1" style={{ fontFamily:OSW, fontWeight:700, fontSize:"clamp(2rem, 9vw, 2.8rem)", lineHeight:1 }}>{receipt.stake}</div>
            <span className="pm-lab" style={{ justifyContent:"center", color:"#ffd24a" }}>pts</span>
          </div>
          <div className="min-w-0" style={{ opacity:.85 }}>
            <InitialRing name={receipt.loserName} color="#ff6b6b" size={54} />
            <div className="mt-2 flex items-center justify-center gap-1.5"><Skull size={13} className="text-[#ff6b6b]" /><span className="pm-lab" style={{ color:"#ff6b6b" }}>Defeated</span></div>
            <strong className="pm-chrome block uppercase leading-none mt-1" style={{ fontFamily:OSW, fontWeight:700, fontSize:"clamp(1.1rem, 5vw, 1.6rem)", overflowWrap:"anywhere" }}>{receipt.loserName}</strong>
          </div>
        </div>
      </div>

      <div className="relative p-4 sm:p-6 space-y-3" style={{ zIndex: 1 }}>
        <div className="grid sm:grid-cols-2 gap-3">
          {[...winners,...losers].map((row,index) => {
            const won=row.result === "win", delta=row.pointsAfter-row.pointsBefore;
            const c = won ? "#4ade80" : "#ff6b6b";
            return <article key={`${row.id ?? row.name}-${index}`} className="rounded-[18px] p-3.5" style={{ border:`1px solid ${c}55`, background:`linear-gradient(180deg, ${c}14, rgba(12,10,18,.92) 70%)`, boxShadow:`0 0 24px ${c}12` }}>
              <div className="flex items-center justify-between gap-3 mb-2.5"><div className="min-w-0"><span className="pm-lab" style={{ color:c }}>{won?"Winner":"Defeated"}</span><strong className="pm-chrome block truncate uppercase" style={{ fontFamily:OSW, fontWeight:700, fontSize:18 }}>{row.name}</strong></div><span className="pm-chip" style={{ color:c, borderColor:`${c}88`, background:`${c}1a`, fontSize:13 }}>{signed(delta)} pts</span></div>
              <div className="grid grid-cols-2 gap-2">
                <Tile label="Points" value={<><span style={{ fontSize:13, opacity:.45, textDecoration:"line-through", marginRight:6 }}>{row.pointsBefore}</span>{row.pointsAfter}</>} color="#ff5c93" bg="linear-gradient(180deg,#2a0f1d,#12080f)" />
                {row.eloBefore != null && row.eloAfter != null
                  ? <Tile label="Elo" value={<>{row.eloAfter}<span style={{ fontSize:13, marginLeft:6, color:c }}>{signed(row.eloAfter-row.eloBefore)}</span></>} color="#7fb4ff" bg="linear-gradient(180deg,#0e1830,#080b14)" />
                  : <Tile label="Record" value={row.record ?? "—"} color="#e4e0f0" bg="linear-gradient(180deg,#1b1828,#0c0a12)" />}
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2 text-xs"><RankMove rank={row.rank} change={row.rankChange}/>{row.record && row.eloBefore != null && <span className="text-white/40">{row.record}</span>}{row.eliminated && <span className="font-black uppercase text-[#ff6b6b]">Eliminated</span>}</div>
            </article>;
          })}
        </div>

        <div className="rounded-[16px] px-4 py-3 flex items-start gap-3" style={{ background:"linear-gradient(180deg, rgba(168,85,247,.12), rgba(12,10,18,.9))", border:"1px solid rgba(168,85,247,.3)" }}><Award className="shrink-0 mt-0.5 text-purple-300" size={18}/><div><span className="pm-lab" style={{ color:"#d8b4fe" }}>Checking for new awards</span><p className="mt-0.5 text-xs leading-relaxed text-white/50">Any achievement this result unlocks will show on the player's profile and in their notifications.</p></div></div>
        {/* singles and team-match receipts carry player ids (doubles and Shift Wars carry team ids, so no nudges there) */}
        {(receipt.competition === "Singles League" || receipt.competition.endsWith("Team Match")) && <NearlyThere players={receipt.participants.filter(p => typeof p.id === "number").map(p => ({ id: p.id!, name: p.name }))} areas={["LEAGUE"]} />}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Link href={`/match-centre/${receipt.matchKey}`} onClick={onClose} className="pm-chip justify-center" style={{ minHeight:44, color:"#fff" }}><ExternalLink size={14}/>Match record</Link>
          <Link href="/leaderboard" onClick={onClose} className="pm-chip justify-center" style={{ minHeight:44, color:"#fff" }}>Standings</Link>
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
        <button type="button" onClick={onClose} className="w-full rounded-full py-3 uppercase" style={{ fontFamily:OSW, fontSize:13, letterSpacing:".14em", color:"#1a1200", background:"linear-gradient(180deg,#ffe58a,#e0a800)", boxShadow:"0 0 22px rgba(255,210,74,.35)" }}>Record another result</button>
      </div>
    </section>
  </div>;
}
