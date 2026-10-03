import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, Images, RotateCcw, Radio, Sparkles, Trophy } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { ShareCardButton } from "@/components/ShareCardButton";
import type { ShareCardSpec } from "@/lib/share-card";
import { renderMatchPoster, type MatchPosterSpec } from "@/lib/match-poster-art";

type Poster = {
  id: number; format: string; sideA: string; sideB: string; kicker: string; reason: string | null;
  level: string; sideAPoints: number | null; sideBPoints: number | null; status: string;
  winnerName: string | null; matchKey: string | null; stake: number | null; gameType: string | null;
  seasonName: string | null; createdAt: string; withdrawn: boolean;
};

const ACCENT: Record<string, string> = { Singles: "#ff005c", "Doubles Event": "#0066ff", "Shift Wars": "#22c55e", "Team Match": "#ffd24a" };
const FORMATS = ["Singles", "Doubles Event", "Shift Wars", "Team Match"];

// The redesigned on-page preview — an asymmetric winner/defeated hierarchy
// with a stake medallion, mirroring the composition of the real downloadable
// graphic (see lib/match-poster-art.ts) so the gallery card and the PNG a
// visitor shares actually look like the same poster.
function PosterArtwork({ poster }: { poster: Poster }) {
  const accent = ACCENT[poster.format] ?? "#ff005c";
  return <div className="relative aspect-[1200/630] overflow-hidden rounded-xl border border-white/10 bg-[#05070c] p-4 shadow-2xl">
    <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 18% 20%,${accent}22,transparent 42%),linear-gradient(160deg,#0a0d14,#03040a)` }} />
    <div className="pointer-events-none absolute inset-3 rounded-lg" style={{ border: `1px solid ${accent}55` }} />
    {/* corner brackets, echoing the PNG's broadcast-frame cue */}
    {["top-1.5 left-1.5 border-t-2 border-l-2", "top-1.5 right-1.5 border-t-2 border-r-2", "bottom-1.5 left-1.5 border-b-2 border-l-2", "bottom-1.5 right-1.5 border-b-2 border-r-2"].map(cls => (
      <div key={cls} className={`absolute h-3 w-3 ${cls}`} style={{ borderColor: accent }} />
    ))}
    <div className="relative flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <strong className="font-black uppercase tracking-wider text-white" style={{ fontFamily: "Oswald,sans-serif" }}>TKDL<span style={{ color: accent }}>LIVE</span></strong>
          <small className="block text-[7px] font-black uppercase tracking-[.18em] text-white/35">{poster.format}{poster.gameType ? ` · ${poster.gameType.replaceAll("_", " ")}` : ""}</small>
        </div>
        <span className="rounded-full border px-2 py-1 text-[7px] font-black uppercase tracking-wider" style={{ color: "#ffd24a", borderColor: "rgba(255,210,74,.5)", background: "rgba(255,210,74,.12)" }}>{poster.kicker}</span>
      </div>

      <div className="my-auto flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <small className="font-black uppercase tracking-[.18em]" style={{ color: accent, fontFamily: "Oswald,sans-serif" }}>Winner</small>
          <strong className="mt-0.5 block truncate text-lg font-black uppercase sm:text-xl" style={{ fontFamily: "Oswald,sans-serif" }}>{poster.sideA}</strong>
          <div className="mt-1 h-[3px] w-10 rounded-full" style={{ background: accent }} />
          <small className="mt-2 block font-black uppercase tracking-wider text-[#ff5b87]/75">Defeated</small>
          <span className="block truncate text-xs font-bold uppercase text-white/45">{poster.sideB}</span>
        </div>
        {poster.stake != null && (
          <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full" style={{ border: "2px solid rgba(255,210,74,.55)", background: "rgba(255,255,255,.04)" }}>
            <div className="text-center">
              <strong className="block text-base font-black leading-none text-[#ffd24a]" style={{ fontFamily: "Oswald,sans-serif" }}>{poster.stake}</strong>
              <small className="block text-[5px] font-black uppercase tracking-wider text-white/45">Stake</small>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[7px] font-black uppercase tracking-widest text-white/35">
        <span>{poster.seasonName ?? "TKDL"}</span>
        <span>{new Date(poster.createdAt).toLocaleDateString("en-GB")}</span>
      </div>
    </div>
  </div>;
}

// Metadata used for the ShareCardButton dialog's title/alt text and Web
// Share payload — independent of which canvas renderer actually drew the
// pixels (see the `render` prop below).
function posterSpec(p: Poster): ShareCardSpec {
  return { eyebrow: p.kicker, title: `${p.sideA} vs ${p.sideB}`, subtitle: p.status === "finished" && p.winnerName ? `${p.winnerName} won · ${p.reason ?? "Result confirmed"}` : p.reason ?? "Next on the oche", accent: ACCENT[p.format] ?? "#ff005c" };
}

function matchPosterArtSpec(p: Poster): MatchPosterSpec {
  return {
    format: p.format,
    kicker: p.kicker,
    winnerName: p.sideA,
    loserName: p.sideB,
    stake: p.stake ?? p.sideAPoints ?? 0,
    gameType: p.gameType ?? "501",
    seasonName: p.seasonName,
    playedAt: p.createdAt,
    accent: ACCENT[p.format] ?? "#ff005c",
  };
}

export default function PosterLibrary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = Boolean(user?.isAdmin);
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const feedUrl = isAdmin && showWithdrawn ? "/api/match-posters?includeWithdrawn=1" : "/api/match-posters";
  const { data, loading } = useFetch<Poster[]>(feedUrl);
  const [season, setSeason] = useState("all"), [format, setFormat] = useState("all");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const seasons = useMemo(() => [...new Set((data ?? []).map(x => x.seasonName).filter((x): x is string => Boolean(x)))], [data]);
  const items = (data ?? []).filter(x => (season === "all" || x.seasonName === season) && (format === "all" || x.format === format));
  const finals = (data ?? []).filter(x => x.status === "finished").length;

  async function setWithdrawn(poster: Poster, withdrawn: boolean) {
    setPendingId(poster.id);
    try {
      const r = await fetch(`/api/match-posters/${poster.id}/${withdrawn ? "withdraw" : "restore"}`, { method: "POST", credentials: "include" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        toast({ title: withdrawn ? "Could not withdraw poster" : "Could not restore poster", description: body.error ?? `HTTP ${r.status}`, variant: "destructive" });
        return;
      }
      toast({ title: withdrawn ? "Poster withdrawn" : "Poster restored", description: withdrawn ? "It's off the public library — restore it any time from Show withdrawn." : "It's back in the public library." });
      await queryClient.invalidateQueries({ queryKey: ["raw-fetch", feedUrl] });
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "destructive" });
    } finally {
      setPendingId(null);
    }
  }

  function handleWithdraw(poster: Poster) {
    if (!window.confirm(`Withdraw the "${poster.sideA} vs ${poster.sideB}" poster from the public library? You can restore it later from "Show withdrawn".`)) return;
    void setWithdrawn(poster, true);
  }

  return <div className="space-y-5">
    <header className="relative overflow-hidden rounded-2xl p-6 sm:p-8" style={{ border: "1px solid rgba(255,210,74,.22)", background: "radial-gradient(circle at 85% 10%,rgba(0,102,255,.2),transparent 35%),linear-gradient(135deg,rgba(255,0,92,.13),rgba(8,5,18,.96))" }}>
      <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/5 shadow-[0_0_0_32px_rgba(255,255,255,.02),0_0_0_68px_rgba(255,255,255,.012)]" />
      <div className="relative">
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#ffd24a]" style={{ fontFamily: "Oswald,sans-serif" }}><Images className="h-4 w-4" />TKDL Media Archive</span>
        <h1 className="mb-2 mt-3 font-black uppercase" style={{ fontFamily: "Oswald,sans-serif", fontSize: "clamp(2.4rem,7vw,5rem)", lineHeight: .9 }}>Match Poster<br /><em className="not-italic text-[#ff005c]">Library</em></h1>
        <p className="m-0 max-w-2xl text-white/45">Every Matchday graphic, presented as a media wall and ready to preview, share or download again.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white/45">{data?.length ?? 0} posters</span>
          <span className="rounded-full border border-[#ffd24a]/20 bg-[#ffd24a]/5 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#ffd24a]">{finals} final results</span>
        </div>
      </div>
    </header>

    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-white/[.02] p-3">
      <Sparkles className="h-4 w-4 text-[#ffd24a]" />
      <select value={season} onChange={e => setSeason(e.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"><option value="all">All seasons</option>{seasons.map(x => <option key={x}>{x}</option>)}</select>
      <select value={format} onChange={e => setFormat(e.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"><option value="all">All competitions</option>{FORMATS.map(x => <option key={x}>{x}</option>)}</select>
      {isAdmin && (
        <button type="button" onClick={() => setShowWithdrawn(v => !v)} className="ml-1 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black uppercase tracking-wider" style={{ color: showWithdrawn ? "#ffd24a" : "rgba(255,255,255,.55)", borderColor: showWithdrawn ? "rgba(255,210,74,.4)" : "rgba(255,255,255,.1)", background: showWithdrawn ? "rgba(255,210,74,.08)" : "rgba(255,255,255,.03)" }}>
          <Archive className="h-3.5 w-3.5" />{showWithdrawn ? "Showing withdrawn" : "Show withdrawn"}
        </button>
      )}
      <span className="ml-auto text-xs text-white/30">Showing {items.length}</span>
    </div>

    {loading ? <div className="p-10 text-center text-white/40">Loading poster archive…</div> : items.length === 0 ? <div className="pdc-card p-10 text-center text-white/35">No posters have been created for this selection yet.</div> : <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map(p => <article key={p.id} className="group rounded-2xl border border-white/10 bg-white/[.025] p-3 transition-transform hover:-translate-y-1" style={{ boxShadow: `0 22px 55px ${ACCENT[p.format] ?? "#ff005c"}0c`, opacity: p.withdrawn ? .55 : 1 }}>
        <PosterArtwork poster={p} />
        <div className="px-1 pb-1 pt-3">
          <div className="flex justify-between gap-3">
            <span className="text-xs font-black uppercase" style={{ color: ACCENT[p.format] ?? "#ff005c", fontFamily: "Oswald,sans-serif" }}>{p.kicker}</span>
            <small className="text-white/30">{new Date(p.createdAt).toLocaleDateString("en-GB")}</small>
          </div>
          <p className="min-h-8 text-xs text-white/35">{p.status === "finished" && p.winnerName ? `${p.winnerName} won. ` : ""}{p.reason}</p>
          {p.withdrawn && <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white/40"><Archive className="h-3 w-3" />Withdrawn</span>}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[10px] font-black uppercase text-white/30"><Radio className="h-3 w-3" />{p.format}</span>
            <div className="flex items-center gap-1.5">
              <ShareCardButton spec={posterSpec(p)} render={() => renderMatchPoster(matchPosterArtSpec(p))} filename={`${p.sideA}-vs-${p.sideB}-${p.id}`} label="Open poster" />
              {isAdmin && (p.withdrawn
                ? <button type="button" disabled={pendingId === p.id} onClick={() => void setWithdrawn(p, false)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider disabled:opacity-50" style={{ color: "#22c55e", background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.28)" }}><RotateCcw className="h-3.5 w-3.5" />Restore</button>
                : <button type="button" disabled={pendingId === p.id} onClick={() => handleWithdraw(p)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider disabled:opacity-50" style={{ color: "#ff5b87", background: "rgba(255,0,92,.06)", border: "1px solid rgba(255,0,92,.22)" }}><Archive className="h-3.5 w-3.5" />Withdraw</button>
              )}
            </div>
          </div>
          {p.matchKey && <a href={`/match-centre/${p.matchKey}`} className="mt-3 flex items-center gap-1 text-xs font-black uppercase text-[#ffd24a]"><Trophy className="h-3 w-3" />Open result</a>}
        </div>
      </article>)}
    </div>}
  </div>;
}
