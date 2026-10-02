import "./tkdl-loader.css";

/**
 * Shared "TKDL is loading" mark — your real app icon with a glow halo, two
 * counter-rotating accent rings, and a dart that flies in and sticks on
 * impact with a small spark burst. Used as the route/page transition
 * Suspense fallback (App.tsx's PageLoader) in its compact form.
 *
 * The pre-mount splash (index.html) and the server-wake screen
 * (main.tsx's renderWakeScreen) show the same mark/ring/dart/spark
 * treatment at the large size, but they're necessarily hand-duplicated as
 * plain HTML/CSS there — neither runs React yet when it needs to appear.
 * Keep this file and those two in sync if you tune colors or timing.
 */
export function TkdlLoader({ size = "sm", label = true }: { size?: "sm" | "lg"; label?: boolean }) {
  return (
    <div className={`tkdl-loader ${size === "lg" ? "tkdl-loader--lg" : ""}`}>
      <div className="tkdl-mark-wrap">
        <div className="tkdl-mark-glow" />
        <div className="tkdl-mark-ring" />
        <div className="tkdl-mark-ring-inner" />
        <img className="tkdl-mark-img" src="/icon-192.png" alt="TKDL" />
        <div className="tkdl-dart">
          <span className="tkdl-dart-flight" />
          <span className="tkdl-dart-shaft" />
          <span className="tkdl-dart-tip" />
        </div>
        <div className="tkdl-impact" />
        <span className="tkdl-spark" />
        <span className="tkdl-spark" />
        <span className="tkdl-spark" />
        <span className="tkdl-spark" />
        <span className="tkdl-spark" />
        <span className="tkdl-spark" />
      </div>
      {label && (
        <div className="tkdl-word">
          <b>TKDL</b>
          <small>Tesco Kilbirnie Darts League</small>
        </div>
      )}
    </div>
  );
}
