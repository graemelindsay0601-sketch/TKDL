import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * A failed dynamic import (a lazy-loaded route chunk that came back missing
 * or as the wrong content — see lazy-with-retry.ts for the full story) is
 * permanently cached as a rejected promise by React.lazy(). Re-rendering
 * after catching one of these — which is all "Try Again" used to do — just
 * re-throws the identical cached error forever, so this class of error
 * needs an actual reload to recover, not a state reset.
 */
function isChunkLoadError(error: Error): boolean {
  const msg = error.message || "";
  return (
    /dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Failed to fetch/i.test(msg) ||
    /Loading chunk/i.test(msg)
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  handleReset = () => {
    if (this.state.error && isChunkLoadError(this.state.error)) {
      // Resetting state here would just re-throw the same cached rejected
      // import — force a real reload so the chunk is fetched fresh.
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      const chunkError = isChunkLoadError(this.state.error);
      return (
        <div className="flex items-center justify-center min-h-[50vh] px-4 py-8">
          <div className="relative overflow-hidden w-full max-w-md text-center" style={{ borderRadius: 24, border: "1px solid rgba(255,92,147,.35)", background: "linear-gradient(160deg, rgba(255,0,92,.18) 0%, #14102a 45%, #06060b 100%)", boxShadow: "0 20px 50px rgba(0,0,0,.55), 0 0 40px rgba(255,0,92,.1)", padding: "28px 22px" }}>
            <div className="absolute pointer-events-none" style={{ right: -80, top: -80, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,210,74,.25), transparent 65%)" }} />
            <div className="absolute pointer-events-none" style={{ left: -60, bottom: -80, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,.28), transparent 65%)" }} />
            <div className="relative">
              <span className="pm-chip" style={{ color: "#ff8fb3", borderColor: "rgba(255,92,147,.5)", background: "rgba(255,0,92,.12)" }}>
                {chunkError ? "New version" : "Bounce out"}
              </span>
              <h2 className="pm-chrome uppercase mt-3" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "2rem", lineHeight: 1, letterSpacing: ".03em" }}>
                {chunkError ? "Update in progress" : "Something went wrong"}
              </h2>
              <p className="text-sm max-w-xs mx-auto mt-3" style={{ color: "#b9b3cc", lineHeight: 1.6 }}>
                {chunkError
                  ? "The app was mid-update when this loaded. Reload to grab the latest version."
                  : "This page hit a problem. Try again, or head back to the Hub."}
              </p>
              {!chunkError && this.state.error.message && (
                <p className="text-xs mt-2 mx-auto max-w-xs" style={{ color: "rgba(255,255,255,.3)", fontFamily: "monospace", overflowWrap: "anywhere" }}>{this.state.error.message}</p>
              )}
              <div className="flex gap-3 justify-center mt-5">
                <button onClick={this.handleReset} className="px-5 py-2.5 rounded-full uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: 13, letterSpacing: ".14em", color: "#1a1200", background: "linear-gradient(180deg,#ffe58a,#e0a800)", boxShadow: "0 0 22px rgba(255,210,74,.35)" }}>
                  {chunkError ? "Reload" : "Try again"}
                </button>
                <button onClick={() => window.location.href = "/"} className="px-5 py-2.5 rounded-full uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: 13, letterSpacing: ".14em", color: "#e4e0f0", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.14)" }}>
                  Back to the Hub
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
