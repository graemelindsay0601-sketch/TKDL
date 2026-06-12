import { Router, type Request, type Response } from "express";

const router = Router();

// ── In-memory session store ───────────────────────────────────────────────────
// Designed as a room-based architecture so future multiplayer slots in cleanly.

interface ScorerEvent {
  type: string;
  payload: unknown;
  timestamp: number;
}

interface ScorerSession {
  code: string;
  roomId: string;
  createdAt: number;
  expiresAt: number;
  gameState: Record<string, unknown>;
  events: ScorerEvent[];
  clients: Set<Response>;
}

const sessions = new Map<string, ScorerSession>();

function generateCode(): string {
  let code: string;
  let attempts = 0;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
    attempts++;
  } while (sessions.has(code) && attempts < 200);
  return code;
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [code, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      for (const client of session.clients) {
        try { client.end(); } catch { /* ignore */ }
      }
      sessions.delete(code);
    }
  }
}

setInterval(cleanExpiredSessions, 5 * 60 * 1000);

function extendSession(session: ScorerSession) {
  session.expiresAt = Date.now() + 30 * 60 * 1000;
}

function fanOut(session: ScorerSession, event: ScorerEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  const dead: Response[] = [];
  for (const client of session.clients) {
    try { client.write(data); }
    catch { dead.push(client); }
  }
  dead.forEach(c => session.clients.delete(c));
}

// POST /api/scorer/sessions — create session, return 4-digit code
router.post("/scorer/sessions", (req: Request, res: Response): void => {
  cleanExpiredSessions();
  const { gameType, players } = req.body as { gameType?: string; players?: string[] };
  const code = generateCode();
  const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const session: ScorerSession = {
    code, roomId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000,
    gameState: { gameType: gameType ?? null, players: players ?? [], status: "waiting" },
    events: [],
    clients: new Set(),
  };
  sessions.set(code, session);
  req.log.info({ code, roomId }, "Scorer session created");
  res.json({ code, roomId, expiresAt: session.expiresAt });
});

// GET /api/scorer/sessions/:code — verify session exists + get state
router.get("/scorer/sessions/:code", (req: Request, res: Response): void => {
  const code = String(req.params.code);
  const session = sessions.get(code);
  if (!session) { res.status(404).json({ error: "Session not found or expired" }); return; }
  extendSession(session);
  res.json({
    code: session.code,
    roomId: session.roomId,
    gameState: session.gameState,
    recentEvents: session.events.slice(-20),
    connectedDisplays: session.clients.size,
  });
});

// POST /api/scorer/sessions/:code/events — camera device posts an event
router.post("/scorer/sessions/:code/events", (req: Request, res: Response): void => {
  const code = String(req.params.code);
  const session = sessions.get(code);
  if (!session) { res.status(404).json({ error: "Session not found or expired" }); return; }
  const { type, payload } = req.body as { type?: string; payload?: unknown };
  if (!type) { res.status(400).json({ error: "type required" }); return; }

  extendSession(session);
  const event: ScorerEvent = { type, payload: payload ?? {}, timestamp: Date.now() };
  session.events.push(event);
  if (session.events.length > 200) session.events = session.events.slice(-200);

  // Merge game_state_sync events into the session's gameState
  if (type === "game_state_sync" && payload && typeof payload === "object") {
    session.gameState = { ...session.gameState, ...(payload as Record<string, unknown>) };
  }

  fanOut(session, event);
  res.json({ ok: true, delivered: session.clients.size });
});

// GET /api/scorer/sessions/:code/stream — SSE stream for display device
router.get("/scorer/sessions/:code/stream", (req: Request, res: Response): void => {
  const code = String(req.params.code);
  const session = sessions.get(code);
  if (!session) { res.status(404).json({ error: "Session not found or expired" }); return; }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Send current state immediately on connect
  res.write(`data: ${JSON.stringify({
    type: "connected",
    payload: { code: session.code, gameState: session.gameState },
    timestamp: Date.now(),
  })}\n\n`);

  session.clients.add(res);
  extendSession(session);
  req.log.info({ code: session.code, displays: session.clients.size }, "Display device connected");

  const keepalive = setInterval(() => {
    try { res.write(": keepalive\n\n"); }
    catch { clearInterval(keepalive); }
  }, 15_000);

  req.on("close", () => {
    clearInterval(keepalive);
    session.clients.delete(res);
    req.log.info({ code: session.code, displays: session.clients.size }, "Display device disconnected");
  });
});

// DELETE /api/scorer/sessions/:code — close session
router.delete("/scorer/sessions/:code", (req: Request, res: Response): void => {
  const code = String(req.params.code);
  const session = sessions.get(code);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  fanOut(session, { type: "session_closed", payload: {}, timestamp: Date.now() });
  session.clients.forEach(c => { try { c.end(); } catch { /* ignore */ } });
  sessions.delete(code);
  req.log.info({ code }, "Scorer session closed");
  res.json({ ok: true });
});

export default router;
