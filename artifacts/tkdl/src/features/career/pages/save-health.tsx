import { useState } from "react";
import { Activity, Check, CircleAlert, Clipboard, RefreshCw, ShieldCheck } from "lucide-react";
import { useFinance, useSporting } from "../api";
import { CareerSection, Label, OSWALD } from "../components";
import type { ShellContext } from "../shell";

export function SaveHealthPage({ ctx }: { ctx: ShellContext }) {
  const { save } = ctx;
  const finance = useFinance(save.id);
  const sporting = useSporting(save.id);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const isChecking = finance.isLoading || sporting.isLoading;
  const needsAttention = finance.isError || sporting.isError || finance.data?.reconciled === false;
  const supportCode = `TKDL-${save.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const updatedAt = new Date(save.updatedAt);
  const lastUpdated = Number.isNaN(updatedAt.getTime())
    ? "Unknown"
    : updatedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  const copyReport = async () => {
    const report = [
      `Support code: ${supportCode}`,
      `Career status: ${save.status}`,
      `Position: season ${save.currentSeason}, week ${save.currentWeek}`,
      `Last updated: ${lastUpdated}`,
      `Finance check: ${finance.data ? (finance.data.reconciled ? "reconciled" : "mismatch") : finance.isError ? "unavailable" : "not checked"}`,
      `Career data check: ${sporting.data ? "available" : sporting.isError ? "unavailable" : "not checked"}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(report);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  const refresh = async () => {
    setCopyState("idle");
    await Promise.all([finance.refetch(), sporting.refetch()]);
  };

  return (
    <div className="career-root space-y-4 pb-10">
      <section className="pdc-card p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Label color="#3d8bff">CAREER SUPPORT</Label>
            <h2 className="mt-1 text-2xl font-black uppercase text-white" style={OSWALD}>Save health</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/65">
              Read-only checks for this Career. Nothing here repairs, resets, or advances your save.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="career-btn career-btn-ghost" onClick={() => void refresh()} disabled={isChecking}>
              <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} aria-hidden />
              {isChecking ? "Checking…" : "Refresh checks"}
            </button>
            <button type="button" className="career-btn career-btn-primary" onClick={() => void copyReport()}>
              {copyState === "copied" ? <Check className="h-4 w-4" aria-hidden /> : <Clipboard className="h-4 w-4" aria-hidden />}
              {copyState === "copied" ? "Copied" : "Copy support report"}
            </button>
          </div>
        </div>
        {copyState === "failed" && <p role="status" className="mt-3 text-sm text-amber-200">Clipboard access was blocked. You can still share the support code below.</p>}
      </section>

      <CareerSection title="Overview" icon={<Activity className="h-4 w-4" aria-hidden />} accent="#3d8bff">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Overall status" value={isChecking ? "Checking…" : needsAttention ? "Needs attention" : "Looks healthy"}
            tone={isChecking ? "neutral" : needsAttention ? "warning" : "good"} />
          <Info label="Career" value={`${save.status === "ACTIVE" ? "Active" : "Archived"} · Slot ${save.slotNumber}`} />
          <Info label="Current position" value={`Season ${save.currentSeason} · Week ${save.currentWeek}`} />
          <Info label="Last updated" value={lastUpdated} />
        </div>
      </CareerSection>

      <CareerSection title="Checks" icon={<ShieldCheck className="h-4 w-4" aria-hidden />} accent="#31c48d">
        <div className="grid gap-3 md:grid-cols-2">
          <CheckCard
            label="Career data"
            state={sporting.isLoading ? "loading" : sporting.isError ? "warning" : "good"}
            detail={sporting.isLoading ? "Checking that the Career data can be read."
              : sporting.isError ? "The Career data check could not complete. This may be a connection issue, not save damage."
                : "The Career data endpoint responded successfully."}
          />
          <CheckCard
            label="Finance ledger"
            state={finance.isLoading ? "loading" : finance.isError || finance.data?.reconciled === false ? "warning" : "good"}
            detail={finance.isLoading ? "Checking the balance against the Career ledger."
              : finance.isError ? "The finance check could not complete. This may be a connection issue, not save damage."
                : finance.data?.reconciled === false ? "The balance does not currently reconcile with the ledger. Contact support before making further finance changes."
                  : `The balance reconciles with ${finance.data?.ledgerEntries ?? 0} ledger entries.`}
          />
        </div>
        {needsAttention && <p role="status" className="mt-3 flex items-start gap-2 text-sm text-amber-200">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          A failed check is not proof that your save is damaged. Copy the support report before retrying a failed action.
        </p>}
      </CareerSection>

      <CareerSection title="Support reference" accent="#a78bfa">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Label color="rgba(255,255,255,0.5)">SHARE THIS CODE WITH SUPPORT</Label>
            <p className="mt-1 font-mono text-lg font-bold tracking-wider text-white">{supportCode}</p>
          </div>
          <p className="max-w-xl text-sm text-white/60">
            The code identifies this save without including your player name or account details. The copied report contains only its status and check results.
          </p>
        </div>
      </CareerSection>
    </div>
  );
}

function Info({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warning" }) {
  const colors = tone === "good" ? "#31c48d" : tone === "warning" ? "#fbbf24" : "rgba(255,255,255,0.9)";
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <Label color="rgba(255,255,255,0.48)">{label}</Label>
      <p className="mt-1 text-sm font-semibold" style={{ color: colors }}>{value}</p>
    </div>
  );
}

function CheckCard({ label, detail, state }: { label: string; detail: string; state: "loading" | "good" | "warning" }) {
  const Icon = state === "warning" ? CircleAlert : ShieldCheck;
  const color = state === "warning" ? "#fbbf24" : state === "good" ? "#31c48d" : "rgba(255,255,255,0.55)";
  return (
    <div className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${state === "loading" ? "animate-pulse" : ""}`} style={{ color }} aria-hidden />
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        <p className="mt-1 text-sm text-white/60">{detail}</p>
      </div>
    </div>
  );
}
