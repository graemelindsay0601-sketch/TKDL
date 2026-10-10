#!/usr/bin/env bash
set -euo pipefail

fail() { printf 'TKDL workspace check failed: %s\n' "$*" >&2; exit 1; }
root="$(git rev-parse --show-toplevel 2>/dev/null)" || fail "run inside the TKDL Git checkout, not an exported source folder."
here="$(pwd -P)"
[[ "$here" == "$root" ]] || fail "run from repository root ($root); current directory is $here."
url="$(git remote get-url github 2>/dev/null)" || fail "configure remote 'github' for graemelindsay0601-sketch/TKDL."
[[ "$url" == *"graemelindsay0601-sketch/TKDL"* ]] || fail "remote 'github' points to '$url', not graemelindsay0601-sketch/TKDL."
branch="$(git branch --show-current)"
[[ -n "$branch" ]] || fail "detached HEAD; check out a development branch based on github/main."
[[ "$branch" != main ]] || fail "use a development branch based on github/main; do not work directly on main."
base="$(git rev-parse --verify refs/remotes/github/main 2>/dev/null)" || fail "fetch github main first: git fetch github main."
git merge-base --is-ancestor "$base" HEAD || fail "current branch does not descend from github/main ($base); rebase or recreate it safely."
bad="$(git diff --cached --name-only | grep -E '(^|/)(TKDL-SPG-clean|TKDL-SPG-release|TKDL-SPG-verified|TKDL-github-main)/' || true)"
[[ -z "$bad" ]] || fail "nested checkout paths are staged; unstage and move changes into repository-relative paths: $bad"
printf 'TKDL workspace OK\nroot: %s\nbranch: %s\nbase: %s\n' "$root" "$branch" "$base"
