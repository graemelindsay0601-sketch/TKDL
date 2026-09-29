export type StartupPhase = "starting" | "database" | "schema" | "ready" | "failed";

export type StartupStatus = {
  ready: boolean;
  phase: StartupPhase;
  message: string;
  startedAt: string;
};

const status: StartupStatus = {
  ready: false,
  phase: "starting",
  message: "Starting TKDL",
  startedAt: new Date().toISOString(),
};

export function getStartupStatus(): StartupStatus {
  return { ...status };
}

export function setStartupPhase(phase: Exclude<StartupPhase, "ready" | "failed">, message: string): void {
  status.ready = false;
  status.phase = phase;
  status.message = message;
}

export function markStartupReady(): void {
  status.ready = true;
  status.phase = "ready";
  status.message = "TKDL is ready";
}

export function markStartupFailed(message: string): void {
  status.ready = false;
  status.phase = "failed";
  status.message = message;
}
