import { worldReport, HARNESS_SEED } from "../src/career/world/harness.ts";
console.log(JSON.stringify(worldReport(process.argv[2] ?? HARNESS_SEED), null, 2));
