/**
 * Tests for isValidUploadedObjectPath — the guard that stops `photoPath`
 * (POST /messages, POST /community/posts) from being stored as an
 * arbitrary attacker-supplied string. A legitimate upload can only ever
 * produce a path shaped like `/objects/uploads/<uuid>` (see
 * ObjectStorageService.normalizeObjectEntityPath); anything else — an
 * external URL, a `javascript:`/`data:` URI, path traversal, junk — must
 * be rejected before it reaches the DB and gets rendered back as an
 * <img src>.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isValidUploadedObjectPath } from "../uploadPath.ts";

const REAL_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("isValidUploadedObjectPath", () => {
  test("accepts a real upload path", () => {
    assert.equal(isValidUploadedObjectPath(`/objects/uploads/${REAL_UUID}`), true);
  });

  test("accepts an uppercase-hex uuid too (case-insensitive)", () => {
    assert.equal(isValidUploadedObjectPath(`/objects/uploads/${REAL_UUID.toUpperCase()}`), true);
  });

  test("rejects an external URL", () => {
    assert.equal(isValidUploadedObjectPath("https://evil.example/tracker.png"), false);
  });

  test("rejects a javascript: URI", () => {
    assert.equal(isValidUploadedObjectPath("javascript:alert(1)"), false);
  });

  test("rejects a data: URI", () => {
    assert.equal(isValidUploadedObjectPath("data:text/html,<script>alert(1)</script>"), false);
  });

  test("rejects protocol-relative path traversal tricks", () => {
    assert.equal(isValidUploadedObjectPath("//evil.example/x"), false);
    assert.equal(isValidUploadedObjectPath(`/objects/uploads/../../etc/passwd`), false);
  });

  test("rejects a plain filename with no real upload id", () => {
    assert.equal(isValidUploadedObjectPath("/objects/uploads/not-a-uuid"), false);
  });

  test("rejects non-string and empty values", () => {
    assert.equal(isValidUploadedObjectPath(undefined), false);
    assert.equal(isValidUploadedObjectPath(null), false);
    assert.equal(isValidUploadedObjectPath(""), false);
    assert.equal(isValidUploadedObjectPath(123), false);
    assert.equal(isValidUploadedObjectPath({ path: `/objects/uploads/${REAL_UUID}` }), false);
  });
});
