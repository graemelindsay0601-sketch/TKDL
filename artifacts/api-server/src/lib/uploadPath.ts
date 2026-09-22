// Every legitimate upload (POST /storage/uploads/file or /request-url, then
// ObjectStorageService.normalizeObjectEntityPath) can only ever produce a
// path shaped like `/objects/uploads/<uuid>`. But every place a photo path
// is later attached to something (POST /messages, POST /community/posts)
// accepted `photoPath` straight from the request body with no check at
// all — so an authenticated player could set it to an arbitrary string: an
// external image URL (silent hotlinking/tracking pixel to another player
// opening a DM or the community feed), a `javascript:`/`data:` URI, or just
// junk — and it would be stored and rendered back as-is. This is the one
// shape a real upload can produce; anything else is rejected before it
// reaches the DB.
//
// Deliberately dependency-free (no import of objectStorage.ts, which pulls
// in @google-cloud/storage) so it stays trivially unit-testable and so
// routes that only need this one check don't drag in the storage client.
const UPLOADED_OBJECT_PATH = /^\/objects\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUploadedObjectPath(value: unknown): value is string {
  return typeof value === "string" && UPLOADED_OBJECT_PATH.test(value);
}
