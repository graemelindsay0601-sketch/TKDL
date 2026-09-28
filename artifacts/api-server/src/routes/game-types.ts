import { Router } from "express";
import { eq, asc, sql } from "drizzle-orm";
import { db, gameTypesTable } from "@workspace/db";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { logAdminAction } from "../lib/adminAudit";

const router = Router();
const VALID_ENGINES=new Set(["X01","Cricket","Sequence","HalveIt","CountUp","Killer","Gotcha","NearestBull","Baseball","HighScore","NoBlack","HighLow","Custom"]);
const VALID_CATEGORIES=new Set(["competitive","practice","party"]);
const validConfig=(value:unknown)=>{if(typeof value!=="string")return false;try{const parsed=JSON.parse(value);return parsed!==null&&typeof parsed==="object"&&!Array.isArray(parsed);}catch{return false;}};

router.get("/game-types", async (_req, res): Promise<void> => {
  const rows = await db.select().from(gameTypesTable)
    .where(eq(gameTypesTable.enabled, true))
    .orderBy(asc(gameTypesTable.sortOrder));
  res.set("Cache-Control", "public, max-age=300");
  res.json(rows);
});

// Everything below manages game types for the whole app — admin only.
router.use("/admin/game-types", requireAdminSession);

router.get("/admin/game-types", async (_req, res): Promise<void> => {
  const rows = await db.select().from(gameTypesTable).orderBy(asc(gameTypesTable.sortOrder));
  res.json(rows);
});

router.post("/admin/game-types", async (req, res): Promise<void> => {
  const { key, name, engine, category, description, config, enabled, sortOrder } = (req.body??{}) as {
    key: string; name: string; engine: string; category?: string;
    description?: string; config?: string; enabled?: boolean; sortOrder?: number;
  };
  if (!key || !name || !engine) { res.status(400).json({ error: "key, name, engine required" }); return; }
  if(!/^[a-z0-9_]+$/.test(key)){res.status(400).json({error:"Key may only contain lowercase letters, numbers and underscores"});return;}
  if(!VALID_ENGINES.has(engine)){res.status(400).json({error:"Unknown game engine"});return;}
  if(category!==undefined&&!VALID_CATEGORIES.has(category)){res.status(400).json({error:"Unknown game category"});return;}
  if(config!==undefined&&!validConfig(config)){res.status(400).json({error:"Config must be a valid JSON object"});return;}
  try {
    const [row] = await db.insert(gameTypesTable).values({
      key, name, engine,
      category:    category    ?? "competitive",
      description: description ?? "",
      config:      config      ?? "{}",
      enabled:     enabled     ?? true,
      sortOrder:   sortOrder   ?? 0,
    }).returning();
    void logAdminAction(req,"game_type.created","game_type",row.id,{key:row.key,name:row.name,engine:row.engine,category:row.category,enabled:row.enabled});
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
  if(name!==undefined&&!name.trim()){res.status(400).json({error:"Name cannot be empty"});return;}
  if(engine!==undefined&&!VALID_ENGINES.has(engine)){res.status(400).json({error:"Unknown game engine"});return;}
  if(category!==undefined&&!VALID_CATEGORIES.has(category)){res.status(400).json({error:"Unknown game category"});return;}
  if(config!==undefined&&!validConfig(config)){res.status(400).json({error:"Config must be a valid JSON object"});return;}
  const [existing]=await db.select().from(gameTypesTable).where(eq(gameTypesTable.id,id));
  if(!existing){res.status(404).json({error:"Not found"});return;}
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (name        !== undefined) update.name        = name;
  if (description !== undefined) update.description = description;
  if (config      !== undefined) update.config      = config;
  if (enabled     !== undefined) update.enabled     = enabled;
  if (sortOrder   !== undefined) update.sortOrder   = sortOrder;
  if (category    !== undefined) update.category    = category;
  if (engine      !== undefined) update.engine      = engine;

  const [updated] = await db.update(gameTypesTable).set(update).where(eq(gameTypesTable.id, id)).returning();
  const onlyEnabled=Object.keys(req.body??{}).length===1&&enabled!==undefined;
  void logAdminAction(req,onlyEnabled?(enabled?"game_type.enabled":"game_type.disabled"):"game_type.updated","game_type",id,{key:existing.key,name:updated.name,before:{name:existing.name,engine:existing.engine,category:existing.category,enabled:existing.enabled},after:{name:updated.name,engine:updated.engine,category:updated.category,enabled:updated.enabled}});
  res.json(updated);
});

router.delete("/admin/game-types/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing]=await db.select().from(gameTypesTable).where(eq(gameTypesTable.id,id));
  if(!existing){res.status(404).json({error:"Not found"});return;}
  const usage=await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM matches WHERE game_type=${existing.key})+
      (SELECT COUNT(*) FROM doubles_matches WHERE game_type=${existing.key})+
      (SELECT COUNT(*) FROM doubles_combined_matches WHERE game_type=${existing.key})+
      (SELECT COUNT(*) FROM shift_wars_matches WHERE game_type=${existing.key})+
      (SELECT COUNT(*) FROM shift_wars_combined_matches WHERE game_type=${existing.key}) count
  `);
  const usedCount=Number((usage.rows[0] as any)?.count??0);
  if(usedCount>0){res.status(409).json({error:`This game type is used by ${usedCount} recorded match${usedCount===1?"":"es"}. Disable it instead so history remains intact.`});return;}
  await db.delete(gameTypesTable).where(eq(gameTypesTable.id, id));
  void logAdminAction(req,"game_type.deleted","game_type",id,{key:existing.key,name:existing.name,engine:existing.engine,category:existing.category});
  res.sendStatus(204);
});

export default router;
