import { build } from "vite";

// Render and CI use this command too. Reporting gzip sizes is optional and
// can exhaust small build runners after the production assets are written.
await build({
  configFile: "vite.config.ts",
  build: { reportCompressedSize: false },
});
