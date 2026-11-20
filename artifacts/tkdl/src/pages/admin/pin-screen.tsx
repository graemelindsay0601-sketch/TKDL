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
          // The server has now set an admin session cookie — every admin
          // request from here on is authorized by that cookie automatically.
          // We only need a client-side flag to know which UI to show;
          // the raw PIN itself is never stored or resent.
          sessionStorage.setItem(ADMIN_PIN_KEY, "1");
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
      <div className={`pm-card relative overflow-hidden p-8 w-80 flex flex-col items-center gap-6 ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
        style={{ ["--pm-acc" as any]: error ? "#ff005c" : "#ffd24a", borderRadius: 24, boxShadow: "0 20px 50px rgba(0,0,0,.55), 0 0 40px rgba(255,210,74,.08)" }}>
        <div className="absolute pointer-events-none" style={{ left: "50%", top: -120, width: 320, height: 320, transform: "translateX(-50%)", borderRadius: "50%", background: `radial-gradient(circle, ${error ? "rgba(255,0,92,.3)" : "rgba(255,210,74,.22)"}, transparent 65%)` }} />
        <div className="relative">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "radial-gradient(circle at 35% 30%, rgba(255,210,74,.4), #120e1c 75%)", border: "1px solid rgba(255,210,74,.65)", boxShadow: "0 0 24px rgba(255,210,74,.35)" }}>
            <Lock className="w-7 h-7" style={{ color: "#ffd24a", filter: "drop-shadow(0 0 8px rgba(255,210,74,0.8))" }} />
          </div>
        </div>
        <div className="text-center">
          <div className="pm-lab justify-center" style={{ color: "#ffd24a" }}>Restricted</div>
          <h2 className="pm-chrome uppercase mt-1" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 30, letterSpacing: ".04em" }}>Admin Access</h2>
          <p className="text-sm mt-1" style={{ color: "#a9a4bd" }}>Enter PIN to continue</p>
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
              className={`relative h-14 rounded-2xl text-xl transition-all ${key ? "hover:-translate-y-0.5 active:scale-95" : "opacity-0 cursor-default"}`}
              style={{
                fontFamily: "Oswald, sans-serif", fontWeight: 600,
                color: key === "←" ? "#a9a4bd" : "#fff",
                background: key ? "linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.02))" : "transparent",
                border: key ? "1px solid rgba(255,255,255,0.13)" : "none",
                boxShadow: key ? "inset 0 1px 0 rgba(255,255,255,.1), 0 6px 14px rgba(0,0,0,.35)" : undefined,
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
