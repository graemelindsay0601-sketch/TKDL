import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db, gameTypesTable } from "@workspace/db";

const router = Router();

router.get("/game-types", async (_req, res): Promise<void> => {
  const rows = await db.select().from(gameTypesTable)
    .where(eq(gameTypesTable.enabled, true))
    .orderBy(asc(gameTypesTable.sortOrder));
  res.json(rows);
});

router.get("/admin/game-types", async (_req, res): Promise<void> => {
  const rows = await db.select().from(gameTypesTable).orderBy(asc(gameTypesTable.sortOrder));
  res.json(rows);
});

router.post("/admin/game-types", async (req, res): Promise<void> => {
  const { key, name, engine, category, description, config, enabled, sortOrder } = req.body as {
    key: string; name: string; engine: string; category?: string;
    description?: string; config?: string; enabled?: boolean; sortOrder?: number;
  };
  if (!key || !name || !engine) { res.status(400).json({ error: "key, name, engine required" }); return; }
  try {
    const [row] = await db.insert(gameTypesTable).values({
      key, name, engine,
      category:    category    ?? "competitive",
      description: description ?? "",
      config:      config      ?? "{}",
      enabled:     enabled     ?? true,
      sortOrder:   sortOrder   ?? 0,
    }).returning();
    res.status(201).json(row);
  } catch (e: any) {
    if (e?.code === "23505") { res.status(409).json({ error: "Game type key already exists" }); return; }
    throw e;
  }
});

router.patch("/admin/game-types/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, description, config, enabled, sortOrder, category, engine } = req.body as {
    name?: string; description?: string; config?: string;
    enabled?: boolean; sortOrder?: number; category?: string; engine?: string;
  };
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (name        !== undefined) update.name        = name;
  if (description !== undefined) update.description = description;
  if (config      !== undefined) update.config      = config;
  if (enabled     !== undefined) update.enabled     = enabled;
  if (sortOrder   !== undefined) update.sortOrder   = sortOrder;
  if (category    !== undefined) update.category    = category;
  if (engine      !== undefined) update.engine      = engine;

  const [updated] = await db.update(gameTypesTable).set(update).where(eq(gameTypesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/admin/game-types/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(gameTypesTable).where(eq(gameTypesTable.id, id));
  res.sendStatus(204);
});

export default router;
