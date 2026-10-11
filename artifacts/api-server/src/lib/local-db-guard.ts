type DatabaseGuardInput = {
  nodeEnv: string | undefined;
  environment: string | undefined;
  databaseUrl: string | undefined;
};

/**
 * Development startup is permitted only against the dedicated loopback TKDL
 * database. Production retains its existing deployment-provided configuration.
 */
export function assertSafeDevelopmentDatabase({
  nodeEnv,
  environment,
  databaseUrl,
}: DatabaseGuardInput): void {
  if (nodeEnv === "production") return;

  if (environment !== "local-development" || !databaseUrl) {
    throw new Error(
      "Unsafe TKDL API startup blocked. Use the documented local preview command; development requires TKDL_ENVIRONMENT=local-development and the isolated local database.",
    );
  }

  let target: URL;
  try {
    target = new URL(databaseUrl);
  } catch {
    throw new Error("Unsafe TKDL API startup blocked: DATABASE_URL is not a valid PostgreSQL URL.");
  }

  const databaseName = decodeURIComponent(target.pathname.replace(/^\/+/, ""));
  if (
    target.protocol !== "postgres:" &&
    target.protocol !== "postgresql:"
  ) {
    throw new Error("Unsafe TKDL API startup blocked: only PostgreSQL is supported.");
  }
  if (
    target.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    databaseName !== "tkdl_dev" ||
    target.username !== "tkdl_dev" ||
    !target.password
  ) {
    throw new Error(
      "Unsafe TKDL API startup blocked: development must use 127.0.0.1:55432/tkdl_dev. Remote and shared databases are refused.",
    );
  }
}
