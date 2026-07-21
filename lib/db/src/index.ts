import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * PERFORMANCE OPTIMIZATION: Connection Pool Configuration
 * 
 * Prevents connection pool exhaustion during high concurrency
 * (e.g., when multiple players finish matches simultaneously)
 * 
 * Config explains:
 * - max: 20 concurrent connections (default is unlimited!)
 * - min: 0 — let the pool fully drain to zero idle connections when
 *   there's no traffic. This used to be 2 ("reduces latency"), a
 *   reasonable tuning for a traditional always-on Postgres server, but
 *   directly counterproductive for a serverless/compute-time-billed
 *   database (e.g. Neon) — permanently keeping 2 connections open means
 *   the database can never fully idle down, even overnight with zero
 *   real traffic, continuously consuming compute-time budget for no
 *   benefit. The cost is a small cold-start delay on the first request
 *   after a genuinely idle period, which is a much better trade for a
 *   small app on a free tier than the database never sleeping at all.
 * - idleTimeoutMillis: Close unused connections after 30 seconds
 * - connectionTimeoutMillis: Fail fast if no connection available after 2 seconds
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                      // Max concurrent connections
  min: 0,                       // Let idle connections fully close — see comment above
  idleTimeoutMillis: 30000,     // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Timeout after 2s if no connection
});

// Log pool events for monitoring
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
  // Log connection events if needed (can be verbose)
});

export const db = drizzle(pool, { schema });

export * from "./schema";
