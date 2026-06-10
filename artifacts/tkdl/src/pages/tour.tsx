import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Trophy, Lock, ChevronRight, Star, Tv2, RotateCcw, Check, ChevronDown, Zap, Crown, Target, Flame } from "lucide-react";

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

  const [players, setPlayers]               = useState<any[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [tours, setTours]                   = useState<any[]>([]);
  const [diffs, setDiffs]                   = useState<Record<string, string>>({});
  const [loading, setLoading]               = useState(false);
  const [starting, setStarting]             = useState<string | null>(null);
  const [openTiers, setOpenTiers]           = useState<Set<number>>(new Set([1]));
  const [tourLb, setTourLb]                 = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/players").then(r => r.json()).then(ps => {
      const active = ps.filter((p: any) => p.status === "ACTIVE");
      setPlayers(active);
      if (active.length > 0) setSelectedPlayerId(active[0].id);
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
        alert(err.error ?? "Failed to start tour");
        return;
      }
      const { runId } = await res.json();
      navigate(`/tour/${runId}`);
    } catch {
      alert("Failed to start tour");
    } finally {
      setStarting(null);
    }
  }

  return (
    <div className="space-y-4 pb-10">

      {/* ── HERO / SALES PITCH ── */}
      <div className="relative overflow-hidden rounded-2xl"
        style={{ background: "linear-gradient(135deg, rgba(255,0,92,0.12) 0%, rgba(192,132,252,0.08) 50%, rgba(255,210,74,0.04) 100%)", border: "1px solid rgba(255,0,92,0.28)" }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div style={{ position: "absolute", top: -80, right: -60, width: 300, height: 300, background: "radial-gradient(circle, rgba(255,0,92,0.22) 0%, transparent 65%)" }} />
          <div style={{ position: "absolute", bottom: -50, left: -50, width: 220, height: 220, background: "radial-gradient(circle, rgba(192,132,252,0.15) 0%, transparent 65%)" }} />
          <div style={{ position: "absolute", top: "40%", left: "40%", width: 160, height: 160, background: "radial-gradient(circle, rgba(255,210,74,0.06) 0%, transparent 65%)" }} />
        </div>
        <div className="relative p-5 md:p-7">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-3.5 h-3.5 fill-current" style={{ color: "#ff005c" }} />
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif", letterSpacing: "0.22em" }}>
              TKDL TOUR MODE
            </span>
          </div>
          <h1 className="font-black uppercase leading-none mb-1"
            style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(2rem, 5.5vw, 3.4rem)", letterSpacing: "0.06em", color: "#fff" }}>
            FROM THE PUB OCHE<br /><span style={{ color: "#ff005c" }}>TO ALLY PALLY.</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed mb-5 max-w-xl" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Oswald, sans-serif" }}>
            Every darts career starts on a dodgy oche with a warm pint nearby. Yours starts here.
            Grind through 61 events across 6 tiers — from back-street pub nights to PDC Major glory.
            Unlock higher tiers. Collect trophies. Earn your <span style={{ color: "#ffd24a", fontWeight: 900 }}>PDC Tour Card</span>.
            Then beat the best in the world.
          </p>

          {/* Feature grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
            {[
              { icon: <Trophy className="w-3.5 h-3.5" />,  color: "#ffd24a", title: "305 Trophies",    desc: "5 difficulties per event" },
              { icon: <Zap className="w-3.5 h-3.5" />,     color: "#ff005c", title: "61 Events",       desc: "Knockout + Premier League" },
              { icon: <Crown className="w-3.5 h-3.5" />,   color: "#c084fc", title: "PDC Majors",      desc: "Tier 6 — invite-only glory" },
              { icon: <Target className="w-3.5 h-3.5" />,  color: "#38bdf8", title: "Tour Card",       desc: "Win any Q-School event" },
              { icon: <Flame className="w-3.5 h-3.5" />,   color: "#4ade80", title: "5 Difficulties",  desc: "Amateur to Elite bots" },
              { icon: <Star className="w-3.5 h-3.5 fill-current" />, color: "#ffd24a", title: "Gamerscore",     desc: "Every trophy counts" },
            ].map(f => (
              <div key={f.title} className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: `${f.color}0d`, border: `1px solid ${f.color}25` }}>
                <div className="shrink-0 mt-0.5" style={{ color: f.color }}>{f.icon}</div>
                <div>
                  <div className="font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: f.color, fontSize: "0.62rem", letterSpacing: "0.08em" }}>{f.title}</div>
                  <div style={{ color: "rgba(255,255,255,0.32)", fontSize: "0.6rem" }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Tier roadmap */}
          <div className="flex items-center gap-1.5 flex-wrap mb-5">
            {TIERS.map((t, i) => (
              <div key={t.num} className="flex items-center gap-1.5">
                <div className="px-2 py-1 rounded-lg text-xs font-black uppercase"
                  style={{ background: `${t.color}15`, border: `1px solid ${t.color}35`, color: t.color, fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", letterSpacing: "0.07em" }}>
                  T{t.num} {t.label}
                </div>
                {i < TIERS.length - 1 && <ChevronRight className="w-3 h-3 shrink-0" style={{ color: "rgba(255,255,255,0.15)" }} />}
              </div>
            ))}
          </div>

          {/* Progress bar + player selector */}
          {selectedPlayer && totalPossible > 0 && totalTrophies > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5" style={{ fontFamily: "Oswald, sans-serif" }}>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>{selectedPlayer.name}'s career progress</span>
                <span style={{ color: "#ffd24a" }}>{totalTrophies} / {totalPossible} trophies</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.round((totalTrophies / totalPossible) * 100)}%`, background: "linear-gradient(90deg, #ff005c, #c084fc, #ffd24a)" }} />
              </div>
            </div>
          )}
          <div>
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.28)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.18em" }}>
              Select Player
            </div>
            <div className="flex flex-wrap gap-2">
              {players.map(p => (
                <button key={p.id} onClick={() => setSelectedPlayerId(p.id)}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold transition-all"
                  style={{
                    fontFamily: "Oswald, sans-serif",
                    background: selectedPlayerId === p.id ? "#ff005c" : "rgba(255,255,255,0.07)",
                    color: selectedPlayerId === p.id ? "#fff" : "rgba(255,255,255,0.5)",
                    border: `1px solid ${selectedPlayerId === p.id ? "#ff005c" : "rgba(255,255,255,0.1)"}`,
                    cursor: "pointer",
                  }}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── TOUR LEADERBOARD ── */}
      <div className="pdc-card overflow-hidden">
        <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5" style={{ color: "#ffd24a" }} />
            <span className="font-black uppercase tracking-widest text-xs" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.5)", fontSize: "0.6rem", letterSpacing: "0.15em" }}>
              TROPHY LEADERBOARD
            </span>
          </div>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", fontSize: "0.58rem" }}>Most trophies won</span>
        </div>
        {tourLb.filter(r => r.totalTrophies > 0).length === 0 ? (
          <div className="px-4 py-8 text-center space-y-2">
            <div className="text-3xl">🏆</div>
            <div className="font-black uppercase text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)" }}>No trophies yet</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Complete your first tour event to get on the board</div>
          </div>
        ) : (
          <div>
            {tourLb.filter(r => r.totalTrophies > 0).slice(0, 6).map((row: any, idx: number) => {
              const POS_COLORS = ["#ffd24a", "#94a3b8", "#cd7f32"];
              const posColor   = POS_COLORS[idx] ?? "rgba(255,255,255,0.2)";
              const highestTierMeta = row.highestTier > 0 ? TIERS[(row.highestTier - 1) as number] : null;
              return (
                <div key={row.playerId} className="px-4 py-2.5 border-b flex items-center gap-3"
                  style={{ borderColor: "rgba(255,255,255,0.04)", background: idx === 0 ? "rgba(255,0,92,0.04)" : undefined }}>
                  <span className="font-black text-sm w-5 shrink-0 text-center"
                    style={{ fontFamily: "Oswald, sans-serif", color: posColor, fontSize: idx < 3 ? "0.85rem" : "0.7rem" }}>
                    {idx < 3 ? ["🥇","🥈","🥉"][idx] : idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-black uppercase text-sm" style={{ fontFamily: "Oswald, sans-serif", color: idx === 0 ? "#fff" : "rgba(255,255,255,0.8)" }}>
                      {row.playerName}
                    </span>
                    {highestTierMeta && (
                      <div className="mt-0.5">
                        <span className="text-xs px-1.5 py-0.5 rounded font-black uppercase"
                          style={{ background: `${highestTierMeta.color}18`, color: highestTierMeta.color, border: `1px solid ${highestTierMeta.color}30`, fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.08em" }}>
                          T{row.highestTier} {highestTierMeta.label}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-center">
                      <div className="font-black text-base tabular-nums" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", lineHeight: 1 }}>{row.totalTrophies}</div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.18)", fontFamily: "Oswald, sans-serif", fontSize: "0.5rem" }}>TROPHIES</div>
                    </div>
                    {row.eliteWins > 0 && (
                      <div className="text-center">
                        <div className="font-black text-base tabular-nums" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", lineHeight: 1 }}>{row.eliteWins}</div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.18)", fontFamily: "Oswald, sans-serif", fontSize: "0.5rem" }}>ELITE</div>
                      </div>
                    )}
                    <div className="text-center hidden sm:block">
                      <div className="font-black text-base tabular-nums" style={{ fontFamily: "Oswald, sans-serif", color: "#c084fc", lineHeight: 1 }}>{row.uniqueTours}</div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.18)", fontFamily: "Oswald, sans-serif", fontSize: "0.5rem" }}>EVENTS</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-1"
              style={{
                background: isOpen ? tier.bg : "rgba(255,255,255,0.02)",
                border: `1px solid ${isOpen ? tier.color + "28" : "rgba(255,255,255,0.06)"}`,
                cursor: "pointer",
              }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black shrink-0"
                style={{
                  background: allLocked ? "rgba(255,255,255,0.06)" : `${tier.color}1a`,
                  color: allLocked ? "rgba(255,255,255,0.2)" : tier.color,
                  fontFamily: "Oswald, sans-serif",
                  border: `1px solid ${allLocked ? "rgba(255,255,255,0.1)" : tier.color + "35"}`,
                }}>
                {tier.num}
              </div>
              <div className="flex-1 text-left">
                <span className="font-black uppercase tracking-widest text-sm"
                  style={{ fontFamily: "Oswald, sans-serif", color: allLocked ? "rgba(255,255,255,0.2)" : tier.color }}>
                  {tier.label}
                </span>
                <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {wonCount}/{tier.tours.length} events won
                </span>
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
                      className="pdc-card overflow-hidden transition-all relative"
                      style={{
                        opacity: isLocked ? 0.42 : 1,
                        borderColor: hasActiveTour ? `${tier.color}55` : isLocked ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
                      }}>
                      {/* Left tier accent */}
                      <div className="absolute left-0 top-0 bottom-0 w-0.5"
                        style={{ background: isLocked ? "rgba(255,255,255,0.08)" : tier.color }} />

                      <div className="pl-4 pr-3 pt-3 pb-3">
                        {/* Header row */}
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-lg shrink-0 leading-none">{tour.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-black uppercase leading-tight"
                              style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.82rem", color: isLocked ? "rgba(255,255,255,0.35)" : "#fff" }}>
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
                          style={{ color: "rgba(255,255,255,0.28)", fontSize: "0.63rem" }}>
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
                              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-black uppercase transition-all"
                              style={{
                                fontFamily: "Oswald, sans-serif",
                                letterSpacing: "0.08em",
                                fontSize: "0.62rem",
                                cursor: isStarting ? "wait" : "pointer",
                                background: hasActiveTour ? tier.color : wonThis ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.07)",
                                color: hasActiveTour ? "#000" : wonThis ? "#22c55e" : "rgba(255,255,255,0.85)",
                                border: hasActiveTour ? "none" : wonThis ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.12)",
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
