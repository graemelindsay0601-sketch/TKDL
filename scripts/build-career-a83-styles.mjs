/** Production CSS-only build for reproducible browser fixtures, not an app build. */
import {build} from "../artifacts/tkdl/node_modules/vite/dist/node/index.js";
import path from "node:path";
const root=path.resolve("artifacts/tkdl");
await build({
  configFile:path.join(root,"vite.config.ts"),
  build:{
    outDir:process.argv[2]??"/tmp/tkdl-a83-styles",
    emptyOutDir:true,cssCodeSplit:true,
    rollupOptions:{input:[path.join(root,"src/index.css"),path.join(root,"src/features/career/career.css")]},
  },
});
