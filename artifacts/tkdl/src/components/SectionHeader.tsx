export function SectionHeader({ title, subtitle, noMargin }: { title: string; subtitle?: string; noMargin?: boolean }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : "2rem" }}>
      <h2 className="pm-metal" style={{ margin: "0 0 6px", fontSize: "26px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "Oswald, sans-serif", lineHeight: 1.05 }}>{title}</h2>
      <div className="pm-hair" style={{ maxWidth: 220, margin: "0 0 8px" }} />
      {subtitle && <p style={{ margin: 0, fontSize: "13px", color: "#a9a4bd" }}>{subtitle}</p>}
    </div>
  );
}
