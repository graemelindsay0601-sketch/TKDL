import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Trophy, Lock, ChevronRight, Star, Tv2, RotateCcw, Check } from "lucide-react";

const TIERS = [
  { num: 1, label: "Pub & Local",        color: "#94a3b8", glow: "rgba(148,163,184,0.2)"  },
  { num: 2, label: "County Circuit",     color: "#4ade80", glow: "rgba(74,222,128,0.2)"   },
  { num: 3, label: "Regional Circuit",   color: "#38bdf8", glow: "rgba(56,189,248,0.2)"   },
  { num: 4, label: "Q-School",           color: "#ffd24a", glow: "rgba(255,210,74,0.2)"   },
  { num: 5, label: "PDC Tour",           color: "#ff005c", glow: "rgba(255,0,92,0.2)"     },
  { num: 6, label: "PDC Majors",         color: "#c084fc", glow: "rgba(192,132,252,0.25)" },
];

const DIFFICULTIES = [
  { key: "amateur", label: "Amateur", color: "#94a3b8" },
  { key: "club",    label: "Club",    color: "#4ade80" },
  { key: "county",  label: "County",  color: "#38bdf8" },
  { key: "pro",     label: "Pro",     color: "#ffd24a" },
  { key: "elite",   label: "Elite",   color: "#ff005c" },
];

const FORMAT_LABELS: Record<string, string> = {
  knockout: "Knockout",
  premier_league: "Premier League",
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
          className="px-2 py-0.5 rounded text-xs font-black uppercase transition-all"
          style={{
            fontFamily: "Oswald, sans-serif",
            letterSpacing: "0.08em",
            fontSize: "0.6rem",
            background: selected === d.key ? d.color : "rgba(255,255,255,0.06)",
            color: selected === d.key ? "#000" : "rgba(255,255,255,0.4)",
            border: `1px solid ${selected === d.key ? d.color : "transparent"}`,
          }}>
          {d.label}
        </button>
      ))}
    </div>
  );
}

function TrophyPips({ wonDifficulties }: { wonDifficulties: string[] }) {
  if (!wonDifficulties?.length) return null;
  return (
    <div className="flex gap-0.5 items-center" title={`Won at: ${wonDifficulties.join(", ")}`}>
      {DIFFICULTIES.map(d => (
        <div key={d.key} className="w-1.5 h-1.5 rounded-full"
          style={{ background: wonDifficulties.includes(d.key) ? d.color : "rgba(255,255,255,0.1)" }} />
      ))}
    </div>
  );
}

export default function Tour() {
  const [, navigate] = useLocation();

  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [tours, setTours] = useState<any[]>([]);
  const [diffs, setDiffs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/players").then(r => r.json()).then(ps => {
      const active = ps.filter((p: any) => p.status === "ACTIVE");
      setPlayers(active);
      if (active.length > 0) setSelectedPlayerId(active[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedPlayerId) return;
    setLoading(true);
    fetch(`/api/tour/definitions?playerId=${selectedPlayerId}`)
      .then(r => r.json())
      .then(data => {
        setTours(data);
        // Initialise difficulty selections
        const initDiffs: Record<string, string> = {};
        data.forEach((t: any) => { initDiffs[t.slug] = "amateur"; });
        setDiffs(initDiffs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedPlayerId]);

  async function handleEnter(tour: any) {
    if (!selectedPlayerId) return;
    const player = players.find(p => p.id === selectedPlayerId);
    if (!player) return;

    // If there's an active run, navigate to it
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

  const toursByTier = TIERS.map(tier => ({
    ...tier,
    tours: tours.filter(t => t.tier === tier.num).sort((a, b) => a.sort_order - b.sort_order),
  }));

  const selectedPlayer = players.find(p => p.id === selectedPlayerId);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="pdc-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div style={{ background: "rgba(255,0,92,0.15)", borderRadius: "10px", padding: "8px" }}>
            <Trophy className="w-5 h-5" style={{ color: "#ff005c" }} />
          </div>
          <div>
            <h1 className="font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.4rem", color: "#fff" }}>
              Tour Mode
            </h1>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              61 tours · 6 tiers · 5 difficulty brackets · earn trophies &amp; Gamerscore
            </p>
          </div>
        </div>

        {/* Player selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.35)", fontSize: "0.6rem" }}>
            Select Player
          </label>
          <div className="flex flex-wrap gap-2">
            {players.map(p => (
              <button key={p.id} onClick={() => setSelectedPlayerId(p.id)}
                className="px-3 py-1.5 rounded-lg text-sm font-bold transition-all"
                style={{
                  fontFamily: "Oswald, sans-serif",
                  background: selectedPlayerId === p.id ? "#ff005c" : "rgba(255,255,255,0.05)",
                  color: selectedPlayerId === p.id ? "#fff" : "rgba(255,255,255,0.5)",
                  border: `1px solid ${selectedPlayerId === p.id ? "#ff005c" : "transparent"}`,
                }}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Loading tours…</div>
      )}

      {/* Tier sections */}
      {!loading && toursByTier.map(tier => {
        const tierUnlocked = tier.tours.some(t => t.unlocked);
        const allLocked = tier.tours.every(t => !t.unlocked);

        return (
          <div key={tier.num}>
            {/* Tier header */}
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-black"
                style={{ background: allLocked ? "rgba(255,255,255,0.06)" : tier.glow, color: allLocked ? "rgba(255,255,255,0.2)" : tier.color, fontFamily: "Oswald, sans-serif", border: `1px solid ${allLocked ? "rgba(255,255,255,0.08)" : tier.color + "40"}` }}>
                {tier.num}
              </div>
              <span className="font-black uppercase tracking-widest text-sm" style={{ fontFamily: "Oswald, sans-serif", color: allLocked ? "rgba(255,255,255,0.2)" : tier.color }}>
                {tier.label}
              </span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                {tier.tours.filter(t => (t.wonDifficulties?.length ?? 0) > 0).length}/{tier.tours.length} tours won
              </span>
              {allLocked && <Lock className="w-3.5 h-3.5 ml-auto" style={{ color: "rgba(255,255,255,0.15)" }} />}
            </div>

            {/* Tour cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {tier.tours.map(tour => {
                const isLocked = !tour.unlocked;
                const hasActive = !!tour.activeRunId;
                const wonAll = tour.wonDifficulties?.length === 5;
                const unlockHint = UNLOCK_HINTS[tour.unlock_type]?.(tour.unlock_value) ?? "";
                const diff = diffs[tour.slug] ?? "amateur";
                const wonThis = tour.wonDifficulties?.includes(diff);
                const isStarting = starting === tour.slug;

                return (
                  <div key={tour.slug}
                    className="pdc-card overflow-hidden transition-all"
                    style={{ opacity: isLocked ? 0.45 : 1, border: hasActive ? `1px solid ${tier.color}40` : undefined }}>

                    {/* Card header */}
                    <div className="px-4 pt-3 pb-2 flex items-start gap-2">
                      <span className="text-xl shrink-0">{tour.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-black uppercase tracking-wide leading-tight" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", color: isLocked ? "rgba(255,255,255,0.35)" : "#fff" }}>
                          {tour.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>
                            {FORMAT_LABELS[tour.format] ?? tour.format}
                          </span>
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.6rem" }}>
                            {tour.bracket_size === 10 ? "10 players" : `${tour.bracket_size}-man`} · {tour.legs_per_match} legs
                            {tour.sets_per_match ? ` · ${tour.sets_per_match} sets` : ""}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 mt-0.5">
                        <TrophyPips wonDifficulties={tour.wonDifficulties ?? []} />
                      </div>
                    </div>

                    {/* Description */}
                    <div className="px-4 pb-2">
                      <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem" }}>
                        {tour.description}
                      </p>
                    </div>

                    <div className="border-t px-4 pt-2.5 pb-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                      {isLocked ? (
                        <div className="flex items-center gap-1.5">
                          <Lock className="w-3 h-3 shrink-0" style={{ color: "rgba(255,255,255,0.2)" }} />
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.62rem" }}>{unlockHint}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {/* Difficulty picker */}
                          {!hasActive && (
                            <div className="flex-1 min-w-0">
                              <DifficultyPicker selected={diff} onChange={d => setDiffs(prev => ({ ...prev, [tour.slug]: d }))} />
                            </div>
                          )}

                          {/* Action button */}
                          <button
                            onClick={() => handleEnter(tour)}
                            disabled={isStarting}
                            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg font-black uppercase transition-all text-xs"
                            style={{
                              fontFamily: "Oswald, sans-serif",
                              letterSpacing: "0.08em",
                              fontSize: "0.65rem",
                              background: hasActive ? tier.color : wonThis ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.08)",
                              color: hasActive ? "#000" : wonThis ? "#22c55e" : "#fff",
                              border: hasActive ? "none" : wonThis ? "1px solid #22c55e40" : "1px solid rgba(255,255,255,0.1)",
                            }}>
                            {isStarting ? (
                              <RotateCcw className="w-3 h-3 animate-spin" />
                            ) : hasActive ? (
                              <><Tv2 className="w-3 h-3" /> Continue</>
                            ) : wonThis ? (
                              <><Check className="w-3 h-3" /> Play Again</>
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
          </div>
        );
      })}
    </div>
  );
}
