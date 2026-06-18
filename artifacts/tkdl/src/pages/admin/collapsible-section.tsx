import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function CollapsibleAdminSection({
  title, icon: Icon, accent, badge, children, borderColor, background,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  borderColor?: string;
  background?: string;
}) {
  const [open, setOpen] = useState(false);
  const col = accent ?? "rgba(255,255,255,0.5)";
  return (
    <div className="pdc-card overflow-hidden" style={{ borderColor, background }}>
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
