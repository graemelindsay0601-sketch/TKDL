import type { SQL } from "drizzle-orm";

/** Shared by the production PostgreSQL adapter and isolated PostgreSQL tests. */
export interface CareerExecutor {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface CareerDatabase extends CareerExecutor {
  transaction<T>(work: (tx: CareerExecutor) => Promise<T>): Promise<T>;
}
