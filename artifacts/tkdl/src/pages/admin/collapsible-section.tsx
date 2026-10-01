import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function CollapsibleAdminSection({
  title, icon: Icon, accent, badge, children, borderColor, background, sectionId, defaultOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  borderColor?: string;
  background?: string;
  sectionId?: string;
  defaultOpen?: boolean;
}) {
  const storageKey = useMemo(
    () => `tkdl:admin-section:${sectionId ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    [sectionId, title],
  );
  const [open, setOpen] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved == null ? defaultOpen : saved === "1";
    } catch { return defaultOpen; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, open ? "1" : "0"); } catch { /* storage is optional */ }
  }, [open, storageKey]);
  useEffect(() => {
    const collapse = () => setOpen(false);
    window.addEventListener("tkdl-admin-collapse-all", collapse);
    return () => window.removeEventListener("tkdl-admin-collapse-all", collapse);
  }, []);
  const col = accent ?? "rgba(255,255,255,0.5)";
  return (
    <div id={sectionId} className="pdc-card overflow-hidden scroll-mt-24" style={{ borderColor, background }}>
      <div className="flex items-center border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <button
          className="flex-1 flex items-center gap-2 px-5 py-3 hover:bg-white/[0.02] transition-colors min-w-0"
          style={{ background: "rgba(255,255,255,0.01)" }}
          onClick={() => setOpen(v => !v)}
        >
          <Icon className="w-4 h-4 shrink-0" style={{ color: col }} />
          <span className="font-bold uppercase tracking-wider text-sm flex-1 text-left truncate" style={{ fontFamily: "Oswald, sans-serif", color: col }}>{title}</span>
          {open
            ? <ChevronUp className="w-3.5 h-3.5 ml-1 shrink-0" style={{ color: "rgba(255,255,255,0.2)" }} />
            : <ChevronDown className="w-3.5 h-3.5 ml-1 shrink-0" style={{ color: "rgba(255,255,255,0.2)" }} />}
        </button>
        {badge && <div className="flex items-center gap-1.5 pr-3 shrink-0">{badge}</div>}
      </div>
      {open && children}
    </div>
  );
}
