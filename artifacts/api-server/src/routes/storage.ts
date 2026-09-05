import express, { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission, getObjectAclPolicy } from "../lib/objectAcl";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Every upload entry point in the app (community photo posts, account/message
// attachments) only ever offers an `accept="image/*"` file picker — so a
// content-type outside this list can only arrive from a direct API call, not
// normal use. Without this check, an uploaded file's client-supplied content
// type was stored as-is and echoed back as the Content-Type response header
// when served — meaning an upload of `Content-Type: text/html` (or
// image/svg+xml, which can carry a <script>) would render as a live page
// under the app's own origin instead of downloading as a photo, i.e. stored
// XSS with no restriction stopping it.
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function isAllowedImageType(contentType: string | undefined | null): boolean {
  return !!contentType && ALLOWED_IMAGE_TYPES.has(contentType.toLowerCase().split(";")[0].trim());
}

/**
 * POST /storage/uploads/file — server-side proxy upload (avoids browser CORS)
 * Client sends raw file bytes; server proxies to GCS and returns objectPath.
 */
router.post(
  "/storage/uploads/file",
  express.raw({ limit: "10mb", type: () => true }),
  async (req: Request, res: Response) => {
    try {
      const contentType =
        (req.headers["x-file-type"] as string) ||
        req.headers["content-type"] ||
        "application/octet-stream";

      if (!isAllowedImageType(contentType)) {
        res.status(415).json({ error: "Only image uploads are allowed" });
        return;
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: req.body as Buffer,
      });

      if (!putRes.ok) {
        req.log.error({ status: putRes.status }, "GCS proxy upload failed");
        res.status(500).json({ error: "Storage upload failed" });
        return;
      }

      res.json({ objectPath });
    } catch (error) {
      req.log.error({ err: error }, "Proxy upload error");
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    if (!isAllowedImageType(contentType)) {
      res.status(415).json({ error: "Only image uploads are allowed" });
      return;
    }

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

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
