import { useState } from "react";
import { Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const ADMIN_PIN_KEY = "tkdl_admin_unlocked";

export function PinScreen({ onUnlock }: { onUnlock: () => void }) {
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError]   = useState(false);
  const [shake, setShake]   = useState(false);
  const { toast } = useToast();

  const handleDigit = async (d: string) => {
    if (digits.length >= 4) return;
    const next = [...digits, d];
    setDigits(next);
    if (next.length === 4) {
      const pin = next.join("");
      try {
        const res = await fetch("/api/admin/verify-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        const data = await res.json();
        if (data.ok) {
          sessionStorage.setItem(ADMIN_PIN_KEY, "1");
          sessionStorage.setItem("tkdl_admin_pin", pin);
          onUnlock();
        } else {
          setShake(true);
          setError(true);
          setTimeout(() => { setDigits([]); setError(false); setShake(false); }, 900);
        }
      } catch {
        toast({ title: "Error", description: "Could not verify PIN", variant: "destructive" });
        setDigits([]);
      }
    }
  };

  const handleBack = () => setDigits(prev => prev.slice(0, -1));

  const keys = ["1","2","3","4","5","6","7","8","9","","0","←"];

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className={`pdc-card p-8 w-80 flex flex-col items-center gap-6 ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
        style={{ borderColor: error ? "rgba(255,0,92,0.5)" : "rgba(255,255,255,0.08)", transition: "border-color 0.3s" }}>
        <div className="relative">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(255,0,92,0.12)", border: "1px solid rgba(255,0,92,0.3)" }}>
            <Lock className="w-6 h-6" style={{ color: "#ff005c", filter: "drop-shadow(0 0 6px rgba(255,0,92,0.6))" }} />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>Admin Access</h2>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Enter PIN to continue</p>
        </div>
        <div className="flex items-center gap-4">
          {[0,1,2,3].map(i => (
            <div key={i} className={`pin-dot ${i < digits.length ? "filled" : ""} ${error ? "!border-red-500 !bg-red-500" : ""}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 w-full">
          {keys.map((key, i) => (
            <button
              key={i}
              onClick={() => key === "←" ? handleBack() : key ? handleDigit(key) : undefined}
              disabled={!key}
              className={`h-12 rounded font-bold text-lg transition-all ${key ? "hover:bg-white/10 active:scale-95" : "opacity-0 cursor-default"}`}
              style={{
                fontFamily: "Oswald, sans-serif",
                color: key === "←" ? "rgba(255,255,255,0.4)" : "#fff",
                background: key ? "rgba(255,255,255,0.06)" : "transparent",
                border: key ? "1px solid rgba(255,255,255,0.08)" : "none",
              }}
            >
              {key}
            </button>
          ))}
        </div>
        {error && (
          <p className="text-xs font-bold" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>INCORRECT PIN</p>
        )}
      </div>
    </div>
  );
}
