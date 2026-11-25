import { Tablet } from "lucide-react";
import { useClubTablet, setClubTablet } from "@/lib/club-tablet";

export function ClubTabletSettings() {
  const on = useClubTablet();
  return (
    <div className="space-y-3 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
      <p>Turn this on <b>on the work tablet itself</b>. It only changes this device.</p>
      <ul className="list-disc pl-5 space-y-1" style={{ color: "rgba(255,255,255,0.55)" }}>
        <li>Anyone can play and submit without logging in (same as now).</li>
        <li>The sidebar shows "Club tablet" instead of asking people to sign in.</li>
        <li>No notification prompts, so the tablet never gets someone's alerts.</li>
        <li>Left alone for 5 minutes, it goes back to the Hub and signs out anyone who logged in. It won't do this mid-game.</li>
      </ul>
      <button type="button" onClick={() => setClubTablet(!on)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold uppercase"
        style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em",
          background: on ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${on ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.12)"}`,
          color: on ? "#4ade80" : "rgba(255,255,255,0.75)", cursor: "pointer" }}>
        <Tablet className="w-4 h-4" />
        {on ? "This device is the club tablet — turn off" : "Make this device the club tablet"}
      </button>
    </div>
  );
}
