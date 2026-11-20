import { PageHero, Chapter, PmCard } from "@/components/premium/Premium";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useCurrentPlayer } from "@/context/auth";
import { Trophy, Lock, ChevronRight, Star, Tv2, RotateCcw, Check, ChevronDown, Zap, Crown, Target, Flame, AlertCircle, X } from "lucide-react";

const TIERS = [
  { num: 1, label: "Pub & Local",        color: "#94a3b8", bg: "rgba(148,163,184,0.07)"  },
  { num: 2, label: "County Circuit",     color: "#4ade80", bg: "rgba(74,222,128,0.07)"   },
  { num: 3, label: "Regional Circuit",   color: "#38bdf8", bg: "rgba(56,189,248,0.07)"   },
  { num: 4, label: "Q-School",           color: "#ffd24a", bg: "rgba(255,210,74,0.07)"   },
  { num: 5, label: "PDC Tour",           color: "#ff005c", bg: "rgba(255,0,92,0.07)"     },
  { num: 6, label: "PDC Majors",         color: "#c084fc", bg: "rgba(192,132,252,0.08)"  },
];

const DIFFICULTIES = [
  { key: "amateur", label: "Amateur", color: "#94a3b8" },
  { key: "club",    label: "Club",    color: "#4ade80" },
  { key: "county",  label: "County",  color: "#38bdf8" },
  { key: "pro",     label: "Pro",     color: "#ffd24a" },
  { key: "elite",   label: "Elite",   color: "#ff005c" },
];

const FORMAT_LABELS: Record<string, string> = {
  knockout:        "Knockout",
  premier_league:  "Premier League",
};

const UNLOCK_HINTS: Record<string, (v: string | null) => string> = {
  none:          () => "",
  any_tier:      (v) => `Win any Tier ${v} event`,
  tier_count:    (v) => { const [t, n] = (v ?? "").split(":"); return `Win ${n} different Tier ${t} events`; },
  specific_tour: () => "Win the Modus Super Series Finals",
  any_of:        () => "Win any Modus Super Series Leg",
  achievement:   (v) => v === "pdc_tour_card" ? "Earn the PDC Tour Card (win any Q-School event)" : "Requires achievement",
};

function DifficultyPicker({ selected, onChange }: { selected: string; onChange: (d: string) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {DIFFICULTIES.map(d => (
        <button key={d.key} onClick={() => onChange(d.key)}
          className="px-1.5 py-0.5 rounded text-xs font-black uppercase transition-all"
          style={{
            fontFamily: "Oswald, sans-serif",
            letterSpacing: "0.08em",
            fontSize: "0.58rem",
            background: selected === d.key ? d.color : "rgba(255,255,255,0.06)",
            color: selected === d.key ? "#000" : "rgba(255,255,255,0.4)",
            border: `1px solid ${selected === d.key ? d.color : "transparent"}`,
            cursor: "pointer",
          }}>
          {d.label}
        </button>
      ))}
    </div>
  );
}

function TrophyPips({ wonDifficulties }: { wonDifficulties: string[] }) {
  const won = wonDifficulties ?? [];
  return (
    <div className="flex gap-0.5 items-center shrink-0"
      title={won.length ? `Won at: ${won.join(", ")}` : "Not yet won"}>
      {DIFFICULTIES.map(d => (
        <div key={d.key} className="w-2 h-2 rounded-full transition-all"
          style={{
            background: won.includes(d.key) ? d.color : "rgba(255,255,255,0.1)",
            boxShadow: won.includes(d.key) ? `0 0 5px ${d.color}90` : "none",
          }} />
      ))}
    </div>
  );
}

export default function Tour() {
  const [, navigate] = useLocation();
  const currentPlayer = useCurrentPlayer();

  const [players, setPlayers]               = useState<any[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [tours, setTours]                   = useState<any[]>([]);
  const [diffs, setDiffs]                   = useState<Record<string, string>>({});
  const [loading, setLoading]               = useState(false);
  const [starting, setStarting]             = useState<string | null>(null);
  const [startError, setStartError]         = useState<string | null>(null);
  const [openTiers, setOpenTiers]           = useState<Set<number>>(new Set([1]));
  const [tourLb, setTourLb]                 = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/players").then(r => r.json()).then(ps => {
      const active = ps.filter((p: any) => p.isActive !== false);
      setPlayers(active);
      if (active.length > 0) {
        const defaultId = currentPlayer ? active.find((p: any) => p.id === currentPlayer.playerId)?.id : null;
        setSelectedPlayerId(defaultId ?? active[0].id);
      }
    }).catch(() => {});
    fetch("/api/leaderboard/tour").then(r => r.json()).then(setTourLb).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedPlayerId) return;
    setLoading(true);
    fetch(`/api/tour/definitions?playerId=${selectedPlayerId}`)
      .then(r => r.json())
      .then(data => {
        setTours(data);
        const initDiffs: Record<string, string> = {};
        data.forEach((t: any) => { initDiffs[t.slug] = "amateur"; });
        setDiffs(initDiffs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedPlayerId]);

  // Auto-open tiers with active runs
  useEffect(() => {
    const tiersWithActive = new Set<number>(
      tours.filter((t: any) => t.activeRunId).map((t: any) => t.tier as number)
    );
    if (tiersWithActive.size > 0) {
      setOpenTiers(prev => new Set([...prev, ...tiersWithActive]));
    }
  }, [tours]);

  const toggleTier = (num: number) => {
    setOpenTiers(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const totalTrophies  = tours.reduce((sum: number, t: any) => sum + (t.wonDifficulties?.length ?? 0), 0);
  const totalPossible  = tours.length * 5;
  const selectedPlayer = players.find(p => p.id === selectedPlayerId);

  const toursByTier = TIERS.map(tier => ({
    ...tier,
    tours: tours.filter(t => t.tier === tier.num).sort((a, b) => a.sort_order - b.sort_order),
  }));

  async function handleEnter(tour: any) {
    if (!selectedPlayerId) return;
    const player = players.find(p => p.id === selectedPlayerId);
    if (!player) return;

    if (tour.activeRunId) {
      navigate(`/tour/${tour.activeRunId}`);
      return;
    }

    const difficulty = diffs[tour.slug] ?? "amateur";
    setStarting(tour.slug);
    try {
      const res = await fetch("/api/tour/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: selectedPlayerId, tourSlug: tour.slug, difficulty, playerName: player.name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStartError(err.error ?? "Failed to start tour");
        return;
      }
      const { runId } = await res.json();
      navigate(`/tour/${runId}`);
    } catch {
      setStartError("Failed to start tour");
    } finally {
      setStarting(null);
    }
  }

  return (
    <div className="space-y-4 pb-10">

      {/* ── ERROR BANNER ── */}
      {startError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.3)" }}>
          <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "#ff005c" }} />
          <span className="flex-1 text-sm font-bold" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
            {startError}
          </span>
          <button onClick={() => setStartError(null)} className="shrink-0 hover:opacity-60 transition-opacity">
            <X className="w-4 h-4" style={{ color: "#ff005c" }} />
          </button>
        </div>
      )}

      {/* ── HERO ── */}
      <PageHero kicker="TKDL Tour Mode" icon={<Crown className="w-3.5 h-3.5" />} accent="#ff005c" accent2="#ffd24a"
        title={<>From the pub oche <span style={{ WebkitTextFillColor: "#ff2f72", textShadow: "0 0 24px rgba(255,0,92,.55)" }}>to Ally Pally.</span></>}
        sub={<>61 events across 6 tiers — back-street pub nights to PDC Major glory. Collect trophies, earn your <b style={{ color: "#ffd24a" }}>PDC Tour Card</b>, then beat the best in the world.</>}>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { v: "305", l: "Trophies", c: "#ffd24a" },
            { v: "61", l: "Events", c: "#ff7aa6" },
            { v: "5", l: "Difficulties", c: "#4ade80" },
          ].map(t => (
            <div key={t.l} className="rounded-2xl px-1 py-2.5 text-center" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.015))", border: "1px solid rgba(255,255,255,.12)" }}>
              <div className="tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 24, color: t.c, textShadow: `0 0 14px ${t.c}77` }}>{t.v}</div>
              <div className="pm-lab justify-center mt-1" style={{ fontSize: 8.5, letterSpacing: ".12em" }}>{t.l}</div>
            </div>
          ))}
        </div>

        {/* Tier roadmap */}
        <div className="mt-4 rounded-2xl p-3" style={{ background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.08)" }}>
          <div className="pm-lab mb-2.5" style={{ fontSize: 9 }}>The road to the Majors</div>
          <div className="grid grid-cols-6 gap-1.5">
            {TIERS.map((t, i) => (
              <div key={t.num} className="flex flex-col items-center min-w-0 text-center">
                <div className="rounded-md w-full" style={{ height: 6 + i * 4, marginTop: 20 - i * 4, background: `linear-gradient(180deg, ${t.color}, ${t.color}33)`, boxShadow: `0 0 8px ${t.color}66` }} />
                <span className="mt-1.5 tabular-nums" style={{ fontFamily: "Oswald, sans-serif", fontSize: 11, color: t.color }}>T{t.num}</span>
                <span className="leading-tight" style={{ fontFamily: "Oswald, sans-serif", fontSize: 8, letterSpacing: ".02em", textTransform: "uppercase", color: "#a9a4bd" }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Player selector + progress */}
        <div className="mt-4">
          <div className="pm-lab mb-2" style={{ fontSize: 9 }}>Select player</div>
          <div className="flex flex-wrap gap-1.5">
            {players.map(p => (
              <button key={p.id} onClick={() => setSelectedPlayerId(p.id)}
                className="px-3 py-1.5 rounded-full text-xs uppercase transition-all"
                style={{
                  fontFamily: "Oswald, sans-serif", letterSpacing: ".06em",
                  background: selectedPlayerId === p.id ? "linear-gradient(180deg, #ffe58a, #e0a800)" : "rgba(255,255,255,0.06)",
                  color: selectedPlayerId === p.id ? "#1a1200" : "#cfcade",
                  border: `1px solid ${selectedPlayerId === p.id ? "#ffd24a" : "rgba(255,255,255,0.12)"}`,
                  boxShadow: selectedPlayerId === p.id ? "0 0 12px rgba(255,210,74,.4)" : undefined,
                  cursor: "pointer",
                }}>
                {p.name}
              </button>
            ))}
          </div>
          {selectedPlayer && totalPossible > 0 && totalTrophies > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1.5" style={{ fontFamily: "Oswald, sans-serif" }}>
                <span style={{ color: "#a9a4bd" }}>{selectedPlayer.name}'s career</span>
                <span style={{ color: "#ffd24a" }}>{totalTrophies} / {totalPossible} trophies</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((totalTrophies / totalPossible) * 100)}%`, background: "linear-gradient(90deg, #ff005c, #c084fc, #ffd24a)", boxShadow: "0 0 10px rgba(255,210,74,.5)" }} />
              </div>
            </div>
          )}
        </div>
      </PageHero>

      {/* ── TOUR LEADERBOARD ── */}
      <Chapter title="Trophy leaderboard" accent="#ffd24a" aside={<span className="pm-chip">Most trophies</span>} />
      {tourLb.filter(r => r.totalTrophies > 0).length === 0 ? (
        <PmCard accent="#ffd24a">
          <div className="px-4 py-8 text-center">
            <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center" style={{ background: "radial-gradient(circle at 35% 30%, rgba(255,210,74,.4), #0d0b14 75%)", border: "1px solid rgba(255,210,74,.6)", boxShadow: "0 0 18px rgba(255,210,74,.35)" }}><Trophy className="w-6 h-6" style={{ color: "#ffd24a" }} /></div>
            <div className="pm-chrome uppercase mt-3" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 20 }}>No trophies yet</div>
            <div className="text-sm" style={{ color: "#a9a4bd" }}>Complete your first tour event to get on the board</div>
          </div>
        </PmCard>
      ) : (
        <div className="space-y-2">
          {tourLb.filter(r => r.totalTrophies > 0).slice(0, 6).map((row: any, idx: number) => {
            const highestTierMeta = row.highestTier > 0 ? TIERS[(row.highestTier - 1) as number] : null;
            const medal = ["linear-gradient(180deg,#ffe58a,#d99a00)", "linear-gradient(180deg,#ffffff,#9aa6bd)", "linear-gradient(180deg,#f0b27a,#9c5a2a)"][idx];
            const pc = ["#ffd24a", "#c0c8d8", "#cd7f32"][idx];
            return (
              <div key={row.playerId} className="pm-lbrow flex items-center gap-3 rounded-2xl px-3 py-3"
                style={{ background: idx < 3 ? `linear-gradient(90deg, ${pc}26, rgba(23,20,31,.95) 50%, rgba(12,10,18,.97))` : undefined, borderColor: idx < 3 ? `${pc}66` : undefined }}>
                <div className="shrink-0 flex items-center justify-center rounded-full" style={{ width: 38, height: 38, background: medal ?? "linear-gradient(180deg,#3a3550,#1d1a2b)", color: medal ? "#141018" : "#e4e0f0", fontFamily: "Oswald, sans-serif", fontSize: 15, boxShadow: medal ? `0 0 14px ${pc}66` : "inset 0 1px 0 rgba(255,255,255,.1)" }}>{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="uppercase truncate" style={{ fontFamily: "Oswald, sans-serif", fontSize: 16, letterSpacing: ".03em", color: "#fff" }}>{row.playerName}</div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {highestTierMeta && <span className="pm-chip" style={{ fontSize: 9, padding: "2px 7px", color: highestTierMeta.color, borderColor: `${highestTierMeta.color}66`, background: `${highestTierMeta.color}14` }}>T{row.highestTier} {highestTierMeta.label}</span>}
                    <span className="text-[11px]" style={{ color: "#a9a4bd", fontFamily: "Oswald, sans-serif" }}>{row.uniqueTours} events{row.eliteWins > 0 ? <> · <span style={{ color: "#ff7aa6" }}>{row.eliteWins}</span> elite</> : null}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 26, color: "#ffd24a", textShadow: "0 0 14px rgba(255,210,74,.55)" }}>{row.totalTrophies}</div>
                  <div className="pm-lab justify-end" style={{ fontSize: 8.5 }}>trophies</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && <Chapter title="Events" accent="#ff005c" />}

      {loading && (
        <div className="text-center py-12 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Loading tours…</div>
      )}

      {/* ── TIER SECTIONS ── */}
      {!loading && toursByTier.map(tier => {
        const allLocked  = tier.tours.every(t => !t.unlocked);
        const wonCount   = tier.tours.filter(t => (t.wonDifficulties?.length ?? 0) > 0).length;
        const hasActive  = tier.tours.some(t => t.activeRunId);
        const isOpen     = openTiers.has(tier.num);

        return (
          <div key={tier.num}>
            {/* Collapsible tier header */}
            <button onClick={() => toggleTier(tier.num)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all mb-2"
              style={{
                background: allLocked ? "linear-gradient(90deg, rgba(255,255,255,.04), rgba(18,16,26,.95))" : `linear-gradient(90deg, ${tier.color}${isOpen ? "33" : "1c"}, rgba(18,16,26,.95) 60%)`,
                border: `1px solid ${allLocked ? "rgba(255,255,255,0.08)" : tier.color + (isOpen ? "99" : "44")}`,
                boxShadow: isOpen && !allLocked ? `0 0 18px ${tier.color}22, inset 0 1px 0 rgba(255,255,255,.07)` : "inset 0 1px 0 rgba(255,255,255,.05)",
                cursor: "pointer",
              }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0"
                style={{
                  background: allLocked ? "rgba(255,255,255,0.06)" : `linear-gradient(180deg, ${tier.color}, ${tier.color}88)`,
                  color: allLocked ? "#6b6680" : "#141018",
                  fontFamily: "Oswald, sans-serif",
                  boxShadow: allLocked ? undefined : `0 0 12px ${tier.color}77`,
                }}>
                {tier.num}
              </div>
              <div className="flex-1 text-left">
                <div className="uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: 16, letterSpacing: ".05em", color: allLocked ? "#6b6680" : "#f2eefc" }}>
                  {tier.label}
                </div>
                <div className="text-xs" style={{ color: allLocked ? "#5d5873" : tier.color, fontFamily: "Oswald, sans-serif", letterSpacing: ".04em" }}>
                  {wonCount}/{tier.tours.length} events won
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasActive && <span className="live-dot" style={{ width: 6, height: 6 }} />}
                {allLocked && <Lock className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.15)" }} />}
                <ChevronDown className="w-4 h-4 transition-transform duration-200"
                  style={{ color: "rgba(255,255,255,0.3)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
              </div>
            </button>

            {/* Tour cards */}
            {isOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-2">
                {tier.tours.map(tour => {
                  const isLocked   = !tour.unlocked;
                  const hasActiveTour = !!tour.activeRunId;
                  const unlockHint = UNLOCK_HINTS[tour.unlock_type]?.(tour.unlock_value) ?? "";
                  const diff       = diffs[tour.slug] ?? "amateur";
                  const wonThis    = tour.wonDifficulties?.includes(diff);
                  const isStarting = starting === tour.slug;

                  return (
                    <div key={tour.slug}
                      className="pm-card overflow-hidden transition-all relative"
                      style={{ ["--pm-acc" as any]: isLocked ? "#5d5873" : tier.color, opacity: isLocked ? 0.5 : 1 }}>
                      <div className="absolute pointer-events-none" style={{ right: -50, top: -50, width: 150, height: 150, borderRadius: "50%", background: `radial-gradient(circle, ${isLocked ? "#5d5873" : tier.color}26, transparent 70%)` }} />

                      <div className="relative px-4 pt-3.5 pb-3.5">
                        {/* Header row */}
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-lg shrink-0 leading-none">{tour.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="uppercase leading-tight"
                              style={{ fontFamily: "Oswald, sans-serif", fontWeight: 600, fontSize: "1rem", letterSpacing: ".03em", color: isLocked ? "#8f8aa3" : "#fff" }}>
                              {tour.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="px-1.5 rounded font-bold"
                                style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.52rem", background: `${tier.color}18`, color: tier.color, border: `1px solid ${tier.color}30` }}>
                                {FORMAT_LABELS[tour.format] ?? tour.format}
                              </span>
                              <span style={{ color: "rgba(255,255,255,0.22)", fontSize: "0.58rem" }}>
                                {tour.bracket_size === 10 ? "10-player" : `${tour.bracket_size}-man`} · {tour.legs_per_match}L
                              </span>
                            </div>
                          </div>
                          <TrophyPips wonDifficulties={tour.wonDifficulties ?? []} />
                        </div>

                        {/* Description */}
                        <p className="text-xs leading-snug mb-2.5"
                          style={{ color: "#a9a4bd", fontSize: "0.72rem" }}>
                          {tour.description}
                        </p>

                        {/* Footer */}
                        {isLocked ? (
                          <div className="flex items-center gap-1.5">
                            <Lock className="w-3 h-3 shrink-0" style={{ color: "rgba(255,255,255,0.18)" }} />
                            <span style={{ color: "rgba(255,255,255,0.22)", fontSize: "0.6rem" }}>{unlockHint}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {!hasActiveTour && (
                              <div className="flex-1 min-w-0">
                                <DifficultyPicker selected={diff} onChange={d => setDiffs(prev => ({ ...prev, [tour.slug]: d }))} />
                              </div>
                            )}
                            <button
                              onClick={() => handleEnter(tour)}
                              disabled={isStarting}
                              className="shrink-0 flex items-center gap-1 px-3.5 py-2 rounded-full uppercase transition-all"
                              style={{
                                fontFamily: "Oswald, sans-serif",
                                letterSpacing: "0.1em",
                                fontSize: "0.68rem",
                                cursor: isStarting ? "wait" : "pointer",
                                background: hasActiveTour ? `linear-gradient(180deg, ${tier.color}, ${tier.color}aa)` : wonThis ? "rgba(34,197,94,0.14)" : "linear-gradient(180deg, #ffe58a, #e0a800)",
                                color: hasActiveTour ? "#000" : wonThis ? "#4ade80" : "#1a1200",
                                border: hasActiveTour ? "none" : wonThis ? "1px solid rgba(34,197,94,0.45)" : "1px solid #ffd24a",
                                boxShadow: wonThis ? undefined : "0 0 12px rgba(255,210,74,.35)",
                              }}>
                              {isStarting ? (
                                <RotateCcw className="w-3 h-3 animate-spin" />
                              ) : hasActiveTour ? (
                                <><Tv2 className="w-3 h-3" /> Continue</>
                              ) : wonThis ? (
                                <><Check className="w-3 h-3" /> Again</>
                              ) : (
                                <><ChevronRight className="w-3 h-3" /> Enter</>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
