#!/usr/bin/env bash
# Acceptance test #14 — no private Notion/Drive corpus, IDs or private titles in
# the branch diff, the full history reachable from HEAD, commit messages, or the
# static assets served by GitHub Pages (all tracked files at HEAD).
#
# Private patterns are NEVER committed. Pass local pattern files (one fixed
# string per line) via env:
#   PRIVATE_IDS=/local/private-ids.txt PRIVATE_TITLES=/local/private-titles.txt \
#   BASE=origin/main bash tests/refmem/scan-private.sh
# Without them only the generic checks run (and the script says so).
set -u
BASE="${BASE:-origin/main}"
fail=0
say() { printf '%s\n' "$*"; }
hit() { say "FAIL  $*"; fail=1; }

revs=$(git rev-list HEAD)
branch_revs=$(git rev-list "$BASE"..HEAD)
say "scan: $(echo "$revs" | wc -l) commits reachable from HEAD ($(echo "$branch_revs" | grep -c . ) on branch), $(git ls-files | wc -l) tracked files at HEAD"

# 1. generic private-surface URLs anywhere in history / HEAD / commit messages
URLRE='(notion\.so/|notion\.site/|docs\.google\.com/|drive\.google\.com/)'
if git grep -I -n -E "$URLRE" $revs -- . >/tmp/refmem-scan-url.txt 2>/dev/null; then hit "private-surface URL(s) in history:"; cut -c1-160 /tmp/refmem-scan-url.txt | sort -u | head; else say "PASS  no notion/google-docs/drive URLs in any commit reachable from HEAD"; fi
if git log --format=%B "$BASE"..HEAD | grep -E -q "$URLRE"; then hit "private-surface URL in branch commit messages"; else say "PASS  no private-surface URLs in branch commit messages"; fi

# 2. generic Notion-style 32-hex ids (dashed/undashed) in lines ADDED by the branch
if git diff "$BASE"...HEAD | grep -E '^\+' | grep -E -i -q '\b[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\b'; then hit "32-hex id pattern in branch diff"; else say "PASS  no 32-hex (Notion-style) ids in lines added by the branch"; fi

# 3. exact private IDs / titles from the local (uncommitted) pattern files
scan_file() { # $1=label $2=file $3=grep flags
  local label="$1" f="$2" flags="$3"
  [ -n "$f" ] && [ -s "$f" ] || { say "SKIP  $label: no local pattern file given (generic checks only)"; return; }
  local n; n=$(grep -c . "$f")
  if git grep -I $flags -F -f "$f" $revs -- . >/tmp/refmem-scan-$label.txt 2>/dev/null; then
    hit "$label: $(cut -d: -f1 /tmp/refmem-scan-$label.txt | sort -u | wc -l) commit(s) contain a private $label (matches not printed)"
  else say "PASS  $label: 0 hits for $n patterns across all commits reachable from HEAD"; fi
  if git log --format=%B "$BASE"..HEAD | grep $flags -F -q -f "$f"; then hit "$label in branch commit messages"; else say "PASS  $label: 0 hits in branch commit messages"; fi
  if git diff "$BASE"...HEAD | grep -E '^\+' | grep $flags -F -q -f "$f"; then hit "$label in branch diff"; else say "PASS  $label: 0 hits in branch diff"; fi
}
scan_file ids "${PRIVATE_IDS:-}" ""
scan_file titles "${PRIVATE_TITLES:-}" "-i"

# 4. no private bundle files tracked
if git ls-files | grep -E -q '\.private\.(jsonl|sqlite)$|velantrim-reference-private|^private-memory/'; then hit "private bundle file tracked"; else say "PASS  no *.private.jsonl / *.private.sqlite / private-memory files tracked"; fi
for p in x.private.jsonl x.private.sqlite velantrim-reference-private-x private-memory/x; do
  git check-ignore -q "$p" || hit ".gitignore does not cover $p"
done
[ $fail = 0 ] && say "PASS  .gitignore covers private bundle patterns"
[ $fail = 0 ] && say "RESULT: PASS (0 private hits)" || say "RESULT: FAIL"
exit $fail
