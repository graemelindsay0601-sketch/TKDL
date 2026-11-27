import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { X } from "lucide-react";
import { Glow, DartboardBackdrop } from "@/components/premium/Premium";

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (result.ok) {
      navigate("/account");
    } else {
      setError(result.error ?? "Login failed");
    }
  };

  const inputStyle: React.CSSProperties = { height: 48, background: "linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.02))", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", fontFamily: "inherit", boxShadow: "inset 0 1px 0 rgba(255,255,255,.06)" };
  const focus = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = "rgba(255,210,74,.7)"; e.target.style.boxShadow = "0 0 0 3px rgba(255,210,74,.12)"; };
  const blur = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = "rgba(255,255,255,0.14)"; e.target.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.06)"; };

  return (
    <div className="tkdl-standalone-screen relative overflow-hidden flex items-center justify-center p-4"
      style={{ background: "radial-gradient(ellipse at 50% -10%, rgba(255,210,74,0.16) 0%, transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(255,0,92,0.18) 0%, transparent 55%), radial-gradient(ellipse at 100% 90%, rgba(0,102,255,0.16) 0%, transparent 55%), #05040a" }}>
      <DartboardBackdrop size={760} opacity={0.06} style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%) rotate(9deg)" }} />

      <div className="relative w-full max-w-sm" style={{ zIndex: 1 }}>
        {/* Crest */}
        <div className="text-center mb-7">
          <div className="inline-flex rounded-full p-[3px] mb-4" style={{ background: "conic-gradient(from 200deg, #ffd24a, #fff8, #ffd24a, #0000 70%, #ffd24a)", boxShadow: "0 0 34px rgba(255,210,74,.35)" }}>
            <img src="/icon-192.png" alt="TKDL" className="w-20 h-20 rounded-full object-cover" style={{ border: "3px solid #07060c" }} />
          </div>
          <div className="pm-chrome" style={{ fontFamily: "Oswald, sans-serif", fontSize: "2.6rem", fontWeight: 700, letterSpacing: "0.16em", lineHeight: 1 }}>TKDL</div>
          <div className="pm-lab justify-center mt-2" style={{ color: "#ffd24a", fontSize: 10, letterSpacing: ".28em" }}>Tesco Kilbirnie Darts League</div>
        </div>

        <div className="pm-card relative overflow-hidden p-6" style={{ ["--pm-acc" as any]: "#ffd24a", borderRadius: 24, boxShadow: "0 24px 60px rgba(0,0,0,.6), 0 0 40px rgba(255,210,74,.08)" }}>
          <Glow x="50%" y="0%" color="#ffd24a" size={320} opacity={0.18} />
          <button
            onClick={() => navigate("/")}
            className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-full transition-all hover:bg-white/10"
            style={{ zIndex: 2, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#a9a4bd" }}
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="relative" style={{ zIndex: 1 }}>
            <div className="pm-lab" style={{ color: "#ffd24a" }}>Welcome back</div>
            <div className="uppercase mt-1 mb-5" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: ".04em", color: "#f2eefc" }}>Sign in</div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="pm-lab mb-1.5" style={{ fontSize: 9 }}>Username or your name</label>
                <input type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={username} onChange={e => setUsername(e.target.value)}
                  className="w-full rounded-full px-5 text-sm outline-none transition-all" style={inputStyle} onFocus={focus} onBlur={blur}
                  placeholder="e.g. Ronald Augustine" required />
              </div>
              <div>
                <label className="pm-lab mb-1.5" style={{ fontSize: 9 }}>Password</label>
                <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-full px-5 text-sm outline-none transition-all" style={inputStyle} onFocus={focus} onBlur={blur}
                  placeholder="••••••" required />
              </div>

              {error && (
                <div className="rounded-2xl px-4 py-2.5" style={{ background: "rgba(255,0,92,0.12)", border: "1px solid rgba(255,0,92,0.45)", color: "#ff9ab8", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em", fontSize: "0.8rem" }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full rounded-full uppercase transition-all hover:-translate-y-0.5 disabled:opacity-60"
                style={{ height: 50, background: "linear-gradient(180deg, #ffe58a, #e0a800)", color: "#1a1200", border: "1px solid #ffd24a", fontFamily: "Oswald, sans-serif", letterSpacing: "0.16em", fontSize: "0.9rem", boxShadow: "0 0 26px rgba(255,210,74,.45)", cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#1a1200" }} />
                    Signing in…
                  </span>
                ) : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
