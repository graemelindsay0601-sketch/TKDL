import { useState, useEffect } from "react";
import { useListPlayers } from "@workspace/api-client-react";
import { Crosshair, CheckCircle, ChevronDown } from "lucide-react";

function useFetch<T>(url: string) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(url).then(r => r.json()).then(d => { if (!cancelled) { setData(d); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);
  return { data, loading };
}

type Cat = "all" | "league" | "practice" | "m501" | "tour" | "career";

interface Challenge {
  key: string; name: string; description: string;
  category: string; icon: string; gamerscore: number;
  difficulty: "bronze" | "silver" | "gold" | "platinum";
  current: number; target: number; completed: boolean; pct: number;
}

const DIFF_COLORS: Record<string, string> = {
  bronze:   "#cd7f32",
  silver:   "#c0c8d8",
  gold:     "#ffd24a",
  platinum: "#e879f9",
};

const CAT_LABELS: Record<Cat, string> = {
  all:      "All",
  league:   "League",
  practice: "Practice",
  m501:     "Master 501",
  tour:     "Tour",
  career:   "Career",
};

function ChallengeCard({ c }: { c: Challenge }) {
  const dc    = DIFF_COLORS[c.difficulty] ?? "#9ca3af";
  const isDone = c.completed;

  return (
    <div className="relative rounded-xl overflow-hidden transition-all duration-200"
      style={{
        background: isDone ? `${dc}0d` : "rgba(255,255,255,0.025)",
        border: `1px solid ${isDone ? dc + "44" : "rgba(255,255,255,0.07)"}`,
        padding: "0.875rem",
      }}>
      <div className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: isDone ? dc : "transparent" }} />

      <div className="flex items-start gap-3">
        <div className="text-2xl leading-none shrink-0 mt-0.5">{c.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="font-black uppercase leading-tight text-sm"
              style={{ fontFamily: "Oswald, sans-serif", color: isDone ? dc : "rgba(255,255,255,0.8)", letterSpacing: "0.04em" }}>
              {c.name}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-bold uppercase px-1.5 py-0.5 rounded-full"
                style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.52rem", letterSpacing: "0.12em", background: `${dc}18`, color: dc, border: `1px solid ${dc}40` }}>
                {c.difficulty}
              </span>
              {isDone && <CheckCircle className="w-4 h-4 shrink-0" style={{ color: dc }} />}
            </div>
          </div>
          <p className="text-xs mb-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.65rem" }}>{c.description}</p>

          {!isDone ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Share Tech Mono, monospace", fontSize: "0.6rem" }}>
                  {c.current.toLocaleString()} / {c.target.toLocaleString()}
                </span>
                <span className="text-xs font-bold" style={{ fontFamily: "Oswald, sans-serif", color: dc, fontSize: "0.6rem" }}>{c.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${c.pct}%`, background: c.pct >= 60 ? dc : "rgba(255,255,255,0.2)" }} />
              </div>
            </div>
          ) : (
            <div className="text-xs font-bold uppercase" style={{ color: dc, fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.1em" }}>
              COMPLETED · +{c.gamerscore}G
            </div>
          )}
        </div>

        <div className="shrink-0 text-right ml-1">
          <div className="font-black tabular-nums"
            style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", color: isDone ? dc : "rgba(255,255,255,0.2)", lineHeight: 1 }}>
            {c.gamerscore}
          </div>
          <div className="text-xs font-bold" style={{ color: isDone ? dc + "88" : "rgba(255,255,255,0.12)", fontFamily: "Oswald, sans-serif", fontSize: "0.52rem" }}>G</div>
        </div>
      </div>
    </div>
  );
}

export default function Challenges() {
  const { data: players }           = useListPlayers();
  const [playerId, setPlayerId]     = useState<number | null>(null);
  const [activeTab, setActiveTab]   = useState<Cat>("all");
  const [showSelect, setShowSelect] = useState(false);

  const apiUrl = playerId ? `/api/challenges?playerId=${playerId}` : "/api/challenges";
  const { data: challenges, loading } = useFetch<Challenge[]>(apiUrl);

  const filtered = activeTab === "all" ? (challenges ?? []) : (challenges ?? []).filter(c => c.category === activeTab);
  const completedCount = filtered.filter(c => c.completed).length;
  const totalGs        = filtered.filter(c => c.completed).reduce((s, c) => s + c.gamerscore, 0);
  const selectedPlayer = players?.find(p => p.id === playerId);

  const cats: Cat[] = ["all", "league", "practice", "m501", "tour", "career"];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl px-6 py-7"
        style={{ background: "linear-gradient(135deg, rgba(255,0,92,0.1) 0%, rgba(255,0,92,0.03) 50%, rgba(0,0,0,0) 100%)", border: "1px solid rgba(255,0,92,0.2)" }}>
        <div className="absolute inset-0 pointer-events-none opacity-30" style={{ background: "repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,0,92,0.02) 40px, rgba(255,0,92,0.02) 80px)" }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,0,92,0.15)", border: "1px solid rgba(255,0,92,0.35)" }}>
              <Crosshair className="w-4.5 h-4.5" style={{ color: "#ff005c", filter: "drop-shadow(0 0 5px rgba(255,0,92,0.7))" }} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,0,92,0.5)", fontSize: "0.55rem", letterSpacing: "0.2em" }}>TKDL</div>
              <h1 className="font-black uppercase leading-none" style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.6rem)", color: "#fff", letterSpacing: "0.06em" }}>
                CHALLENGES
              </h1>
            </div>
          </div>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
            36 challenges across every mode. Earn Gamerscore. Build your legacy.
          </p>
        </div>
      </div>

      {/* Player selector */}
      <div className="pdc-card overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.3)", fontSize: "0.58rem", letterSpacing: "0.16em" }}>
            VIEWING AS
          </span>
          <div className="relative">
            <button
              onClick={() => setShowSelect(s => !s)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-white/5"
              style={{ background: "rgba(255,0,92,0.08)", border: "1px solid rgba(255,0,92,0.2)" }}>
              <span className="font-black text-sm uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", letterSpacing: "0.06em" }}>
                {selectedPlayer?.name ?? "Select Player"}
              </span>
              <ChevronDown className="w-3.5 h-3.5" style={{ color: "rgba(255,0,92,0.6)", transform: showSelect ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
            {showSelect && (
              <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl overflow-hidden shadow-xl"
                style={{ background: "rgba(10,8,20,0.98)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
                <button
                  onClick={() => { setPlayerId(null); setShowSelect(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                  style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em" }}>
                  — No player —
                </button>
                {players?.filter(p => p.isActive).map(p => (
                  <button key={p.id}
                    onClick={() => { setPlayerId(p.id); setShowSelect(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                    style={{ fontFamily: "Oswald, sans-serif", color: playerId === p.id ? "#ff005c" : "rgba(255,255,255,0.75)", letterSpacing: "0.04em" }}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Progress summary */}
        {playerId && challenges && (
          <div className="border-t px-4 py-3 flex items-center gap-6" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
            <div>
              <div className="font-black text-xl leading-none" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c" }}>
                {(challenges ?? []).filter(c => c.completed).length}<span className="text-sm font-normal text-white/30">/{challenges?.length ?? 36}</span>
              </div>
              <div className="text-xs uppercase tracking-widest mt-0.5" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)", fontSize: "0.52rem" }}>Completed</div>
            </div>
            <div>
              <div className="font-black text-xl leading-none" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a" }}>
                {(challenges ?? []).filter(c => c.completed).reduce((s, c) => s + c.gamerscore, 0).toLocaleString()}G
              </div>
              <div className="text-xs uppercase tracking-widest mt-0.5" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)", fontSize: "0.52rem" }}>Gamerscore</div>
            </div>
            <div className="flex-1">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.round(((challenges ?? []).filter(c => c.completed).length / (challenges?.length || 36)) * 100)}%`, background: "linear-gradient(90deg, #ff005c, #ffd24a)" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {cats.map(cat => {
          const catCount      = challenges?.filter(c => cat === "all" || c.category === cat);
          const catCompleted  = catCount?.filter(c => c.completed).length ?? 0;
          const isActive      = activeTab === cat;
          return (
            <button key={cat}
              onClick={() => setActiveTab(cat)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              style={{
                fontFamily: "Oswald, sans-serif",
                fontSize: "0.62rem",
                letterSpacing: "0.1em",
                background: isActive ? "rgba(255,0,92,0.15)" : "rgba(255,255,255,0.04)",
                border: isActive ? "1px solid rgba(255,0,92,0.4)" : "1px solid rgba(255,255,255,0.07)",
                color: isActive ? "#ff005c" : "rgba(255,255,255,0.45)",
              }}>
              {CAT_LABELS[cat]}
              {playerId && catCount && <span className="ml-1 opacity-60">({catCompleted}/{catCount.length})</span>}
            </button>
          );
        })}
      </div>

      {/* Summary for current tab */}
      {playerId && filtered.length > 0 && (
        <div className="flex items-center gap-4 px-1">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", letterSpacing: "0.08em" }}>
            {completedCount}/{filtered.length} COMPLETED · {totalGs.toLocaleString()}G EARNED
          </span>
        </div>
      )}

      {/* Challenge grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Completed last */}
          {[...filtered].sort((a, b) => Number(a.completed) - Number(b.completed) || b.pct - a.pct).map(c => (
            <ChallengeCard key={c.key} c={c} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-2 py-12 text-center">
              <div className="text-3xl mb-3">🎯</div>
              <div className="text-sm font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)" }}>No challenges in this category</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
