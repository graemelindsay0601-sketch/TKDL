#!/usr/bin/env bash
# Combined E1 + E2 + F1/F2 release-candidate check. This intentionally runs
# against the checked-out integration candidate: no stale branch reconstruction,
# copying source into a second tree, or mutation of Git refs.
set -euo pipefail
REPO=$(git rev-parse --show-toplevel)
(cd "$REPO/artifacts/tkdl" && node --test \
  src/lib/__tests__/career-apparel.test.ts \
  src/lib/__tests__/career-kit-library.test.ts \
  src/lib/__tests__/career-trophies-e2.test.ts \
  src/lib/__tests__/career-atmosphere-f1.test.ts \
  scripts/f2/e2-f1-contract.test.ts)
(cd "$REPO/artifacts/api-server" && node --test \
  src/lib/__tests__/career-startup-schema-f2.test.ts \
  src/lib/__tests__/career-startup-ledger-f2.test.ts)
