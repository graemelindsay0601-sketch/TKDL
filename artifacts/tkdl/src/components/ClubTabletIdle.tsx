import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { useClubTablet, TABLET_BUSY_PATHS, TABLET_IDLE_MS } from "@/lib/club-tablet";

/**
 * On the club tablet only: after 5 minutes with nobody touching it, sign out
 * any player who logged in and go back to the Hub. Skipped on pages where a
 * game could be mid-way through.
 */
export function ClubTabletIdle() {
  const on = useClubTablet();
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const last = useRef(Date.now());

  useEffect(() => {
    if (!on) return;
    const touch = () => { last.current = Date.now(); };
    const evts = ["pointerdown", "keydown", "scroll", "touchstart"];
    evts.forEach(e => window.addEventListener(e, touch, { passive: true }));
    const t = window.setInterval(() => {
      if (Date.now() - last.current < TABLET_IDLE_MS) return;
      const busy = TABLET_BUSY_PATHS.some(p => location === p || location.startsWith(p + "/"));
      if (busy) return;
      last.current = Date.now();
      if (user) void logout();
      if (location !== "/") navigate("/");
    }, 15_000);
    return () => { evts.forEach(e => window.removeEventListener(e, touch)); window.clearInterval(t); };
  }, [on, location, user, logout, navigate]);

  return null;
}
