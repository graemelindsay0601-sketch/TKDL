import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

const router = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(settingsTable);
  const out: Record<string, boolean | string> = {};
  for (const r of rows) {
    out[r.key] = r.value === "true" ? true : r.value === "false" ? false : r.value;
  }
  res.json(out);
});

router.patch("/admin/settings/:key", async (req, res): Promise<void> => {
  const { key } = req.params;
  const { value } = req.body as { value?: unknown };
  if (value === undefined) { res.status(400).json({ error: "value required" }); return; }
  const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (existing.length === 0) {
    await db.insert(settingsTable).values({ key, value: String(value) });
  } else {
    await db.update(settingsTable).set({ value: String(value), updatedAt: new Date() }).where(eq(settingsTable.key, key));
  }
  res.json({ ok: true, key, value });
});

export default router;
