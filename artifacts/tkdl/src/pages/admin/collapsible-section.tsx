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
    <div id={sectionId} className={`adm-sec scroll-mt-24${open ? " is-open" : ""}`} style={{ ["--acc" as string]: col, ...(borderColor ? { ["--acc-b" as string]: borderColor } : {}), ...(background ? { ["--acc-bg" as string]: background } : {}) }}>
      <div className="adm-sec-head">
        <button className="adm-sec-btn" aria-expanded={open} onClick={() => setOpen(v => !v)}>
          <span className="adm-sec-ico"><Icon className="w-4 h-4" /></span>
          <span className="adm-sec-title">{title}</span>
          {open ? <ChevronUp className="w-4 h-4 shrink-0 adm-sec-chev" /> : <ChevronDown className="w-4 h-4 shrink-0 adm-sec-chev" />}
        </button>
        {badge && <div className="flex items-center gap-1.5 pr-3 shrink-0">{badge}</div>}
      </div>
      {open && <div className="adm-sec-body">{children}</div>}
    </div>
  );
}
