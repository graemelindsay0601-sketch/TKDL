import { useLocation } from "wouter";

/**
 * One shared "please log in" screen for every gated page, replacing four
 * near-duplicate implementations that had each drifted apart (boss-battle.tsx
 * and board-curse.tsx had no button at all; card-clash.tsx used a gold
 * button and plain Arial; account.tsx used a pink button but no icon/hero
 * treatment). Every gate now matches the hero language used on Tour /
 * Master-501 / Shadow Bot (icon, headline, subcopy, pink CTA).
 */
export function LoginGate({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  const [, navigate] = useLocation();
  return (
    <div className="flex items-center justify-center py-20 px-4">
      <div
        className="relative overflow-hidden rounded-2xl text-center px-8 py-12 max-w-md w-full"
        style={{
          background: "radial-gradient(circle at 50% 0%, rgba(255,0,92,0.20) 0%, transparent 60%), rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,0,92,0.22)",
        }}
      >
        <div
          className="text-5xl mb-4 select-none"
          style={{ filter: "drop-shadow(0 0 14px rgba(255,0,92,0.5))" }}
        >
          {icon}
        </div>
        <h2
          className="font-black uppercase text-xl mb-2"
          style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.02em", color: "rgba(255,255,255,0.95)" }}
        >
          {title}
        </h2>
        <p className="text-sm mb-7 mx-auto" style={{ color: "rgba(255,255,255,0.5)", maxWidth: "34ch" }}>
          {subtitle}
        </p>
        <button
          onClick={() => navigate("/login")}
          className="px-8 py-3 rounded-xl font-black uppercase transition-transform hover:-translate-y-0.5"
          style={{
            background: "linear-gradient(135deg, #ff005c, rgba(255,0,92,0.7))",
            color: "#fff",
            fontFamily: "Oswald, sans-serif",
            letterSpacing: "0.12em",
            fontSize: "0.8rem",
            border: "none",
          }}
        >
          Go to Login
        </button>
      </div>
    </div>
  );
}
