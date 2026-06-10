import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { Target } from "lucide-react";

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,0,92,0.15) 0%, transparent 60%), #030308" }}>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 relative"
            style={{ background: "rgba(255,0,92,0.12)", border: "1px solid rgba(255,0,92,0.3)" }}>
            <div className="absolute inset-0 rounded-2xl" style={{ background: "rgba(255,0,92,0.2)", filter: "blur(12px)" }} />
            <Target className="w-8 h-8 relative z-10" style={{ color: "#ff005c", filter: "drop-shadow(0 0 8px rgba(255,0,92,0.9))" }} />
          </div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.6rem", fontWeight: 900, letterSpacing: "0.15em", color: "#fff" }}>
            TKDL
          </div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", color: "rgba(255,255,255,0.25)", letterSpacing: "0.2em", textTransform: "uppercase", marginTop: "0.15rem" }}>
            Tesco Kilbirnie Darts League
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6"
          style={{ background: "rgba(10,8,20,0.95)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 48px rgba(0,0,0,0.5)" }}>

          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", letterSpacing: "0.2em", color: "rgba(255,0,92,0.7)", textTransform: "uppercase", marginBottom: "1.2rem" }}>
            Sign In
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-1.5" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "inherit" }}
                onFocus={e => (e.target.style.borderColor = "rgba(255,0,92,0.5)")}
                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                placeholder="e.g. graeme"
                required
              />
            </div>

            <div>
              <label className="block mb-1.5" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "inherit" }}
                onFocus={e => (e.target.style.borderColor = "rgba(255,0,92,0.5)")}
                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                placeholder="••••••"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg px-3 py-2.5 text-sm" style={{ background: "rgba(255,0,92,0.08)", border: "1px solid rgba(255,0,92,0.2)", color: "#ff005c", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em", fontSize: "0.78rem" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 font-bold uppercase tracking-wider transition-opacity disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #ff005c, rgba(255,0,92,0.7))", color: "#fff", fontFamily: "Oswald, sans-serif", letterSpacing: "0.15em", fontSize: "0.85rem", border: "none", cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#fff" }} />
                  Signing in…
                </span>
              ) : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
