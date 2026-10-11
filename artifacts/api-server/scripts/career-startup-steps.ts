/**
 * DEV-ONLY: the Career migration steps of src/app.ts initSchemaAndData(), read from the
 * source in order, so certification tools replay exactly what production startup runs
 * (including the G1 startup repairs) instead of a hand-maintained copy.
 */
import path from "node:path";
import { readFileSync } from "node:fs";

const SRC = path.resolve(import.meta.dirname, "../src");
export type CareerStartupStep = { key: string; fn: string; module: string };

export function careerStartupSteps(): CareerStartupStep[] {
  const app = readFileSync(path.join(SRC, "app.ts"), "utf8");
  const modules = new Map<string, string>();
  for (const m of app.matchAll(/import\s*\{([^}]+)\}\s*from\s*"\.\/db\/migrations\/([^"]+?)(?:\.ts)?"/g))
    for (const n of m[1].split(",").map(s => s.trim()).filter(Boolean)) modules.set(n, m[2]);
  const body = app.slice(app.indexOf("async function initSchemaAndData"));
  const steps: CareerStartupStep[] = [];
  for (const m of body.matchAll(/runMigrationStep\(\s*([A-Za-z0-9_"]+)\s*,\s*\(\)\s*=>\s*([A-Za-z0-9]+)\(db\)\s*\)/g)) {
    const mod = modules.get(m[2]);
    if (mod && /career|sponsor/i.test(mod)) steps.push({ key: m[1].replaceAll('"', ""), fn: m[2], module: mod });
  }
  if (!steps.length) throw new Error("No Career migration steps found in app.ts");
  return steps;
}

/** Run the steps (run-once per key, like runMigrationStep) against a drizzle database. */
export async function runCareerStartupSteps(db: unknown, steps: CareerStartupStep[], done = new Set<string>()) {
  for (const s of steps) {
    if (done.has(s.key)) continue;
    const mod = await import(path.join(SRC, "db/migrations", `${s.module}.ts`));
    await mod[s.fn](db);
    done.add(s.key);
  }
  return done;
}
