import { useState } from "react";
import { useLocation } from "wouter";
import { Camera, X } from "lucide-react";

export default function ScorerJoin() {
  const [, navigate] = useLocation();
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const keys = ["1","2","3","4","5","6","7","8","9","","0","←"];

  const handleDigit = async (d: string) => {
    if (loading) return;
    if (d === "←") { setDigits(p => p.slice(0, -1)); return; }
    if (digits.length >= 4) return;
    const next = [...digits, d];
    setDigits(next);
    if (next.length < 4) return;

    // Verify code
    const code = next.join("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scorer/sessions/${code}`);
      if (res.ok) {
        navigate(`/scorer/display/${code}`);
      } else {
        setShake(true);
        setError("Code not found — check the camera device");
        setTimeout(() => { setDigits([]); setShake(false); setLoading(false); }, 900);
      }
    } catch {
      setShake(true);
      setError("Connection error");
      setTimeout(() => { setDigits([]); setShake(false); setLoading(false); }, 900);
    } finally {
      if (!shake) setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at 30% 20%, rgba(0,212,255,0.08) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(255,0,92,0.07) 0%, transparent 55%), #06040e',
        fontFamily: 'Oswald, sans-serif',
      }}>

      {/* Close button */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-4 right-4 p-2 rounded-full transition-all hover:bg-white/10"
        style={{ color: 'rgba(255,255,255,0.35)' }}>
        <X className="w-5 h-5" />
      </button>

      <div
        className={`w-80 flex flex-col items-center gap-6 p-8 rounded-2xl ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${error ? 'rgba(255,0,92,0.4)' : 'rgba(0,212,255,0.15)'}`,
          transition: 'border-color 0.3s',
        }}>

        {/* Icon */}
        <div className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)' }}>
          <Camera className="w-6 h-6" style={{ color: '#00d4ff', filter: 'drop-shadow(0 0 6px rgba(0,212,255,0.6))' }} />
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase tracking-wider" style={{ color: '#fff' }}>Display Mode</h2>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Enter the 4-digit code from the camera device</p>
        </div>

        {/* Digit dots */}
        <div className="flex items-center gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i}
              className={`w-3 h-3 rounded-full border-2 transition-all ${i < digits.length ? 'scale-110' : ''}`}
              style={{
                borderColor: error ? '#ff005c' : i < digits.length ? '#00d4ff' : 'rgba(255,255,255,0.2)',
                background: error ? '#ff005c' : i < digits.length ? '#00d4ff' : 'transparent',
              }}
            />
          ))}
        </div>

        {/* Shown code */}
        {digits.length > 0 && (
          <div className="text-3xl font-bold tracking-[0.3em]" style={{ color: '#00d4ff', letterSpacing: '0.35em' }}>
            {digits.join('')}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-xs text-center" style={{ color: '#ff005c', fontFamily: 'Oswald, sans-serif' }}>
            {error}
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 w-full">
          {keys.map((key, i) => (
            <button
              key={i}
              onClick={() => key ? handleDigit(key) : undefined}
              disabled={!key || loading}
              className={`h-12 rounded-lg font-bold text-lg transition-all ${key ? 'hover:bg-white/10 active:scale-95' : 'opacity-0 cursor-default'}`}
              style={{ color: key === '←' ? 'rgba(255,255,255,0.4)' : '#fff', background: key ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
              {key}
            </button>
          ))}
        </div>

        <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Start a scorer session on the camera device first, then enter the code shown there.
        </p>
      </div>
    </div>
  );
}
