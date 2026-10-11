import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const expectedRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function git(args, options = {}) {
  return execFileSync("git", args, { cwd: expectedRoot, encoding: "utf8", ...options }).trim();
}
function fail(message) {
  console.error(`TKDL workspace guard: ${message}`);
  process.exit(1);
}

let actualRoot;
try {
  actualRoot = git(["rev-parse", "--show-toplevel"]);
} catch {
  fail("this directory is not inside a Git repository. Use a real TKDL checkout, not an exported source copy.");
}
if (path.resolve(actualRoot) !== expectedRoot) {
  fail(`the Git root is ${actualRoot}, but the TKDL project root is ${expectedRoot}. Refusing to validate or release from a workspace wrapper.`);
}

const remotes = git(["remote", "-v"]);
const remoteName = remotes.split("\n").some(line => line.startsWith("github\t")) ? "github" : "origin";
let remoteUrl;
try {
  remoteUrl = git(["remote", "get-url", remoteName]);
} catch {
  fail("no github/origin remote is configured.");
}
if (!/github\.com[:/]graemelindsay0601-sketch\/TKDL(?:\.git)?$/i.test(remoteUrl)) {
  fail(`remote ${remoteName} does not point to graemelindsay0601-sketch/TKDL.`);
}

let remoteHead;
try {
  const listing = git(["ls-remote", remoteName, "refs/heads/main"]);
  remoteHead = listing.split(/\s+/)[0];
} catch {
  fail("could not fetch the authoritative main SHA from GitHub; check GitHub access and retry.");
}
if (!/^[0-9a-f]{40}$/i.test(remoteHead ?? "")) fail("GitHub main did not return a valid commit SHA.");

const expectedHead = process.env.TKDL_EXPECTED_MAIN?.trim();
if (expectedHead && expectedHead.toLowerCase() !== remoteHead.toLowerCase()) {
  fail(`GitHub main moved: expected ${expectedHead}, now ${remoteHead}. Rebase/review before continuing.`);
}
try {
  execFileSync("git", ["merge-base", "--is-ancestor", remoteHead, "HEAD"], { cwd: expectedRoot, stdio: "ignore" });
} catch {
  fail(`HEAD does not descend from current GitHub main (${remoteHead}). Do not push this workspace history.`);
}

const nestedGit = execFileSync("find", [".", "-path", "./node_modules", "-prune", "-o", "-path", "./.git", "-prune", "-o", "-name", ".git", "-print"], {
  cwd: expectedRoot,
  encoding: "utf8",
}).trim();
if (nestedGit) fail(`nested Git metadata found at ${nestedGit.split("\n").join(", ")}; remove it from the release worktree before staging.`);

const status = git(["status", "--short", "--untracked-files=normal"]);
if (process.env.TKDL_GUARD_REQUIRE_CLEAN === "1" && status) {
  fail(`working tree is not clean:\n${status}`);
}
console.log(`TKDL workspace guard passed.\nRoot: ${expectedRoot}\nRemote: ${remoteUrl}\nGitHub main: ${remoteHead}\nHEAD: ${git(["rev-parse", "HEAD"])}\nWorking tree: ${status ? "changes present; review scope before staging" : "clean"}`);
