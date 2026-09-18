import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPreviewPath,
  PREVIEW_MODES,
  PREVIEW_OVERLAYS,
  PREVIEW_SCENES,
  PREVIEW_VIEWPORTS,
} from "../../features/broadcast/preview-matrix.ts";

describe("TKDL LIVE development preview matrix", () => {
  test("covers every scene and programme mode at desktop and phone sizes", () => {
    const paths = Object.keys(PREVIEW_VIEWPORTS).flatMap(() =>
      PREVIEW_SCENES.flatMap((scene) =>
        PREVIEW_MODES.map((mode) => buildPreviewPath({ scene, mode, turn: 1 })),
      ),
    );

    assert.equal(paths.length, 64);
    for (const scene of PREVIEW_SCENES) {
      for (const mode of PREVIEW_MODES) {
        assert.equal(paths.filter((path) => path.includes(`scene=${scene}`) && path.includes(`mode=${mode}`)).length, 2);
      }
    }
  });

  test("exposes both live insert classes as deterministic preview states", () => {
    assert.deepEqual(PREVIEW_OVERLAYS, ["none", "just_in", "breaking"]);
    assert.match(
      buildPreviewPath({ scene: "result", mode: "NEWS", turn: 4, overlay: "breaking" }),
      /scene=result&mode=NEWS&turn=4&overlay=breaking$/,
    );
  });
});