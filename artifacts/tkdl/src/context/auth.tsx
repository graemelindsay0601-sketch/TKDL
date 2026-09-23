import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type AuthUser = {
  id:          number;
  username:    string;
  isAdmin:     boolean;
  playerId:    number;
  playerName:  string;
  lastLoginAt: string | null;
};

type AuthContextType = {
  user:    AuthUser | null;
  loading: boolean;
  login:   (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout:  () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

// A hard refresh remounts AuthProvider from scratch, so `user` always starts
// out null and `loading` true while /api/auth/me is in flight — a few
// hundred ms where anything rendering off `user` (the nav's account widget,
// in particular) has nothing to show and either renders blank or a "signed
// out" state, then pops into the real one once the check resolves. That's
// the visible "glitch" on refresh.
//
// sessionStorage carries a copy of the last-confirmed user across that gap:
// non-sensitive profile fields only (no token — cookies still do the actual
// auth), cleared on logout, and per-tab so it never leaks into a different
// session. Seeding `user` from it means the account widget can render its
// real content immediately, on the same optimistic-then-corrected basis any
// cached UI uses — if the session actually expired, refresh() below still
// runs exactly as before and corrects it to null a moment later.
const CACHED_USER_KEY = "tkdl_cached_user";

function readCachedUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(CACHED_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: AuthUser | null): void {
  try {
    if (user) sessionStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(CACHED_USER_KEY);
  } catch {
    // best-effort — private browsing / storage disabled shouldn't break auth
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(() => readCachedUser());
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        writeCachedUser(userData);

        // Trigger daily login bonus (fire and forget)
        if (userData.playerId) {
          fetch("/api/card-clash/login/daily", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId: userData.playerId }),
          }).catch(() => {
            // Silently fail - login bonus is non-critical
          });
        }
      } else {
        setUser(null);
        writeCachedUser(null);
      }
    } catch {
      // A network error here doesn't necessarily mean the session is gone —
      // leave any cached user in place rather than flashing to signed-out
      // and back; the next successful refresh() will correct it either way.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        writeCachedUser(data);
        return { ok: true };
      }
      return { ok: false, error: data.error ?? "Login failed" };
    } catch {
      return { ok: false, error: "Network error" };
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    writeCachedUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useCurrentPlayer() {
  const { user } = useAuth();
  return user ? { playerId: user.playerId, playerName: user.playerName } : null;
}
