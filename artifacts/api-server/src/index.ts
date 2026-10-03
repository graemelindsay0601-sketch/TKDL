import app, { initApp, initRuntimeApp } from "./app";
import { logger } from "./lib/logger";
import { ensureCurrentBroadcastEdition } from "./broadcast/edition-engine";
import { deploymentBootstrapKey, ensureBootstrapLedger, isBootstrapComplete, markBootstrapComplete } from "./lib/deployment-bootstrap";
import { markStartupFailed, markStartupReady, setStartupPhase } from "./lib/startup-state";
import { getFeatureFlag, FEATURES } from "./services/feature-flags-service";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);
const BROADCAST_SCHEDULER_INTERVAL_MS = 60_000;

function startBroadcastScheduler() {
  let running = false;
  const check = async () => {
    if (running) return;
    running = true;
    try {
      // Every HTTP route in routes/broadcast.ts gates behind
      // requireBroadcastAvailable() (isFeatureAvailable(FEATURES.TKDL_LIVE)),
      // but this scheduler called ensureCurrentBroadcastEdition() directly
      // on a bare 60s timer with no flag check at all — so even with
      // tkdl_live fully switched off (not even admin preview), it was still
      // building and publishing real editions to the DB around the clock.
      // We still want it running during admin-preview (adminTestMode) so an
      // admin reviewing the feature finds fresh content waiting rather than
      // triggering a build on every visit — it's only "fully disabled"
      // (neither live for everyone nor in admin preview) that should stop
      // this entirely.
      const flag = await getFeatureFlag(FEATURES.TKDL_LIVE);
      if (!flag?.enabled && !flag?.adminTestMode) return;
      await ensureCurrentBroadcastEdition();
    } catch (err) {
      logger.error({ err }, "Scheduled broadcast edition check failed");
    } finally {
      running = false;
    }
  };
  void check();
  const timer = setInterval(() => void check(), BROADCAST_SCHEDULER_INTERVAL_MS);
  timer.unref();
}

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

let runtimeStarted = false;

async function initializeApplication() {
  try {
    setStartupPhase("database", "Waking the TKDL database");
    const versionKey = deploymentBootstrapKey();
    let needsFullBootstrap = true;
    if (versionKey) {
      await ensureBootstrapLedger();
      needsFullBootstrap = !(await isBootstrapComplete(versionKey));
    }

    if (needsFullBootstrap) {
      setStartupPhase("schema", "Checking scoring, standings and league data");
      const bootstrapClean = await initApp();
      if (versionKey && bootstrapClean) await markBootstrapComplete(versionKey);
      if (!bootstrapClean) logger.warn("Schema validation had failed steps; fast-wake marker withheld so the next start checks again");
    } else {
      logger.info({ versionKey }, "Schema bootstrap already completed for this deploy — using fast wake path");
    }

    markStartupReady();
    logger.info({ fastWake: !needsFullBootstrap }, "TKDL routes ready");

    if (!runtimeStarted) {
      runtimeStarted = true;
      startBroadcastScheduler();
      void initRuntimeApp().catch(err => logger.error({ err }, "Deferred runtime startup failed"));
    }
  } catch (err) {
    logger.error({ err }, "TKDL initialization failed; retrying in 10 seconds");
    markStartupFailed("The database is taking longer than expected. Retrying automatically.");
    setTimeout(() => void initializeApplication(), 10_000).unref();
  }
}

// Open the port immediately so Render can return the built frontend instead
// of timing out on its generic loading screen. Database-backed API routes are
// held behind app.ts's readiness middleware until initializeApplication has
// made scoring and standings safe to use.
const server = app.listen(port, () => {
  logger.info({ port }, "Server listening; phased initialization starting");
  void initializeApplication();
});
server.on("error", err => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
