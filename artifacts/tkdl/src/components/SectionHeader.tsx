export function SectionHeader({ title, subtitle, noMargin }: { title: string; subtitle?: string; noMargin?: boolean }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : "2rem" }}>
      <h2 style={{ margin: "0 0 5px", fontSize: "22px", fontWeight: 900, color: "#fff", letterSpacing: "0.04em", fontFamily: "'Arial Black',Impact,Arial,sans-serif" }}>{title}</h2>
      {subtitle && <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.36)" }}>{subtitle}</p>}
    </div>
  );
}
