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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        
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
      }
    } catch {
      setUser(null);
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
