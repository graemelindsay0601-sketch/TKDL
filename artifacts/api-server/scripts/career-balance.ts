import { balanceReport, HARNESS_SEED } from "../src/career/world/harness.ts";
import { CAREER_DIFFICULTIES, type CareerDifficulty } from "../src/career/config.ts";
const difficulty = process.argv[4] ?? "STANDARD";
if (!CAREER_DIFFICULTIES.includes(difficulty as CareerDifficulty)) throw new Error("Invalid difficulty preset");
console.log(JSON.stringify(balanceReport(Number(process.argv[2] ?? 10000), process.argv[3] ?? HARNESS_SEED, difficulty as CareerDifficulty), null, 2));
