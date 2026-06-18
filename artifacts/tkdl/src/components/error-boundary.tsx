import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
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
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-5 px-6 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.25)" }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff005c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h2
              className="font-black uppercase mb-2"
              style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.4rem", letterSpacing: "0.1em", color: "#fff" }}
            >
              Something went wrong
            </h2>
            <p className="text-sm max-w-xs mx-auto" style={{ color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
              {this.state.error.message || "An unexpected error occurred."}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all hover:opacity-90"
              style={{
                background: "rgba(255,0,92,0.15)",
                border: "1px solid rgba(255,0,92,0.4)",
                color: "#ff005c",
                fontFamily: "Oswald, sans-serif",
                letterSpacing: "0.1em",
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = "/"}
              className="px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all hover:opacity-90"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.5)",
                fontFamily: "Oswald, sans-serif",
                letterSpacing: "0.1em",
              }}
            >
              Go Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
