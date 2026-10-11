import assert from "node:assert/strict";
import { test } from "node:test";
import { cosmeticSchema } from "../../career/content/service.ts";

test("Career cosmetics accept historical and published Kit Studio IDs but reject unknown shirt IDs", () => {
  for (const id of ["kit-50-01", "kit-50-50", "kit-pro-01", "kit-pro-10"]) {
    assert.equal(cosmeticSchema.safeParse({ kitDesignId: id }).success, true, id);
  }
  for (const id of ["kit-50-00", "kit-50-51", "kit-pro-00", "kit-pro-11", "kit-unknown-01"]) {
    assert.equal(cosmeticSchema.safeParse({ kitDesignId: id }).success, false, id);
  }
});
