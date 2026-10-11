#!/usr/bin/env bash
# F2 — run the E2 + F1 combined certification against a throwaway worktree.
# Builds origin/main + origin/career-polish/e2-premium-trophies + origin/career-polish/f1-broadcast-atmosphere
# locally (NEVER pushed), links the existing node_modules, copies the contract test and fixtures in,
# and runs E2, F1 and the contract suites together. The worktree is removed afterwards.
#   artifacts/tkdl/scripts/f2/run-combined-certification.sh [worktree-dir]
set -euo pipefail
REPO=$(git rev-parse --show-toplevel)
WT=${1:-$(mktemp -d)/combined}
git -C "$REPO" fetch -q origin main career-polish/e2-premium-trophies career-polish/f1-broadcast-atmosphere
git -C "$REPO" worktree add -q --detach "$WT" origin/main
trap 'git -C "$REPO" worktree remove --force "$WT"' EXIT
git -C "$WT" -c user.email=cert@local -c user.name=cert merge -q --no-edit origin/career-polish/e2-premium-trophies
git -C "$WT" -c user.email=cert@local -c user.name=cert merge -q --no-edit origin/career-polish/f1-broadcast-atmosphere
for d in node_modules artifacts/tkdl/node_modules artifacts/api-server/node_modules; do ln -sfn "$REPO/$d" "$WT/$d"; done
for d in "$REPO"/lib/*/node_modules; do ln -sfn "$d" "$WT/${d#"$REPO"/}"; done
mkdir -p "$WT/artifacts/tkdl/scripts/f2"
cp -r "$REPO/artifacts/tkdl/scripts/f2/fixtures" "$WT/artifacts/tkdl/scripts/f2/"
cp "$REPO/artifacts/tkdl/scripts/f2/e2-f1-contract.test.ts" "$WT/artifacts/tkdl/src/lib/__tests__/career-e2-f1-contract.test.ts"
sed -i 's#path.resolve(import.meta.dirname, "../..")#path.resolve(import.meta.dirname, "../../..")#' "$WT/artifacts/tkdl/src/lib/__tests__/career-e2-f1-contract.test.ts"
cd "$WT/artifacts/tkdl"
node --test src/lib/__tests__/career-trophies-e2.test.ts src/lib/__tests__/career-atmosphere-f1.test.ts src/lib/__tests__/career-e2-f1-contract.test.ts
