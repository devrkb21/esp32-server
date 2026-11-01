#!/usr/bin/env bash
# How far dev is behind upstream (xinnan-tech/xiaozhi-esp32-server) and which files a merge would
# conflict on. A dry run: nothing in the working tree or any branch changes. See UPSTREAM.md.
#   scripts/upstream-check.sh            # dev vs upstream/main
#   scripts/upstream-check.sh my-branch  # another branch
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

branch="${1:-dev}"
if ! git remote get-url upstream >/dev/null 2>&1; then
  git remote add upstream https://github.com/xinnan-tech/xiaozhi-esp32-server.git
  git remote set-url --push upstream DISABLED
fi
git fetch -q upstream main

behind=$(git rev-list --count "$branch..upstream/main")
ahead=$(git rev-list --count "upstream/main..$branch")
echo "$branch: $ahead commits of ours, $behind upstream commits not merged yet"
[ "$behind" -eq 0 ] && { echo "Up to date with upstream."; exit 0; }

echo
echo "Newest upstream commits:"
git log --oneline -10 "$branch..upstream/main"

out=$(git merge-tree --write-tree --name-only --no-messages "$branch" upstream/main || true)
conflicts=$(printf '%s\n' "$out" | tail -n +2 | sed '/^$/d')
echo
if [ -z "$conflicts" ]; then
  echo "A merge would apply cleanly."
else
  echo "A merge would conflict in $(printf '%s\n' "$conflicts" | wc -l) files:"
  printf '%s\n' "$conflicts" | cut -d/ -f1-3 | sort | uniq -c | sort -rn
  echo
  printf '%s\n' "$conflicts"
fi
