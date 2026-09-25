import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission, getObjectAclPolicy } from "../lib/objectAcl";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// POST /storage/uploads/file and POST /storage/uploads/request-url were
// removed 2026-09-25 — a GCS presigned-upload flow that grepping the whole
// frontend found zero callers of. community.tsx's own header comment
// confirms why: photo uploads moved to base64-in-JSON because "the
// object-storage endpoint this used to hit doesn't work on this app's
// Render hosting." Every real upload path (community posts, DMs, avatars)
// writes straight to Postgres bytea columns instead. The GET routes below
// are kept as-is — they still serve any objects that predate that
// migration, and ObjectStorageService/objectAcl.ts stay in place to back
// them (getObjectEntityFile, downloadObject, the ACL check).

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    // --- Access control ----------------------------------------------------
    // This used to be entirely commented out (a leftover from the
    // boilerplate's replit-auth example, which assumes req.isAuthenticated()
    // / req.user.id — neither of which exist in this app's session model),
    // so this route served ANY object to ANY request, logged in or not, as
    // long as the caller knew or guessed its path.
    //
    // This app also never actually attaches an ObjectAclPolicy to uploaded
    // objects — trySetObjectEntityAclPolicy (objectStorage.ts) is defined but
    // not called anywhere upload happens (community photo posts, message/DM
    // attachments). So every object today has no aclPolicy, and
    // canAccessObjectEntity()/canAccessObject() would unconditionally return
    // false for all of them (see objectAcl.ts: "if (!aclPolicy) return
    // false"). Enforcing that literally, as the commented-out example did,
    // would 403 every existing photo for everyone, including its legitimate
    // viewers — a broken "fix" that trades an open hole for a fully broken
    // feature.
    //
    // What IS available and matches how every other authenticated route in
    // this app checks the caller (see /auth/me, requireAdminSession) is the
    // session: require a logged-in player to read any object here, which
    // closes the actual reported hole (anonymous internet access with no
    // login at all). If an object DOES carry a real ACL policy, still
    // enforce it via canAccessObjectEntity so that mechanism isn't dead code.
    //
    // Remaining limitation: because no ACL policy is ever written at upload
    // time, this grants any logged-in league member read access to any
    // object path (matching today's de facto behavior for community photos,
    // which are already shared app-wide) rather than true per-owner/
    // per-recipient privacy for things like DM attachments. Closing that
    // fully would mean calling trySetObjectEntityAclPolicy with a real owner
    // + aclRules when messages/community photos are uploaded — that's a
    // separate, larger change to the upload flow and is out of scope here.
    const sessionUserId = (req.session as any)?.userId;
    if (!sessionUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const aclPolicy = await getObjectAclPolicy(objectFile);
    if (aclPolicy) {
      const canAccess = await objectStorageService.canAccessObjectEntity({
        userId: String(sessionUserId),
        objectFile,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
