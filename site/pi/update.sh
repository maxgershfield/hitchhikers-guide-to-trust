#!/usr/bin/env bash
# Bring this Pi's Guide to Trust up to the repo's main branch, safely:
#   1. stop if the clone has local edits (the Pi should only ever pull)
#   2. fetch; stop if nothing is new
#   3. show what's coming, fast-forward to it
#   4. check the server scripts parse; restart; check it answers
#   5. if it doesn't answer, go back to the commit it was on and restart that
#
#   ~/trust/site/pi/update.sh            # by hand, as the clone's owner (asks for sudo to restart)
#   ~/trust/site/pi/update.sh --check    # only say whether there is something new
# The auto-update timer (install.sh --auto-update) runs it as root with --quiet; git then runs as the clone's owner.
# The chain lives outside the clone (~/trust-data), so nothing here touches anyone's stars.
set -euo pipefail

QUIET=0 CHECK=0
for a in "$@"; do case "$a" in --quiet) QUIET=1 ;; --check) CHECK=1 ;; *) echo "unknown option: $a"; exit 2 ;; esac; done
say() { [ "$QUIET" = 1 ] || echo "$*"; }

SITE="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$SITE/.." && pwd)"
OWNER="$(stat -c %U "$REPO")"
OWNER_HOME="$(getent passwd "$OWNER" | cut -d: -f6)"
if [ "$(id -u)" -eq 0 ]; then G() { runuser -u "$OWNER" -- git -C "$REPO" "$@"; }; SUDO=''
else G() { git -C "$REPO" "$@"; }; SUDO=sudo; fi

ENVF="$OWNER_HOME/.config/trust-guide/env"
setting() { [ -f "$ENVF" ] && sed -n "s/^$1=//p" "$ENVF" | tail -1 || true; }
PORT="$(setting PORT)"; PORT="${PORT:-8788}"
HOSTA="$(setting HOST)"; HOSTA="${HOSTA:-127.0.0.1}"
HEALTH="http://$HOSTA:$PORT/api/gate"

command -v node >/dev/null || { echo "Node.js is not on the PATH; not updating."; exit 1; }
if [ -n "$(G status --porcelain --untracked-files=no)" ]; then
  echo "This clone has local edits; not updating. See them with: git -C $REPO status"
  exit 1
fi

BRANCH="$(G rev-parse --abbrev-ref HEAD)"
G fetch --quiet origin "$BRANCH"
OLD="$(G rev-parse HEAD)" NEW="$(G rev-parse "origin/$BRANCH")"
if [ "$OLD" = "$NEW" ]; then say "Up to date ($(G log -1 --format='%h %s'))."; exit 0; fi
if ! G merge-base --is-ancestor "$OLD" "$NEW"; then
  echo "origin/$BRANCH is not ahead of this clone (history was rewritten?). Not updating; sort it out by hand."
  exit 1
fi

echo "New on $BRANCH:"; G log --format='  %h %s' "$OLD..$NEW"
[ "$CHECK" = 0 ] || exit 0

G merge --ff-only --quiet "$NEW"
back() {
  echo "Going back to $(G log -1 --format='%h' "$OLD")."
  G reset --quiet --hard "$OLD"; $SUDO systemctl restart trust-guide
}

for f in serve.mjs src/worker.js; do
  if ! node --check "$SITE/$f" 2>/dev/null; then echo "$f does not parse."; back; exit 1; fi
done

$SUDO systemctl restart trust-guide
for _ in $(seq 1 15); do
  if curl -fsS "$HEALTH" >/dev/null 2>&1; then echo "Updated to $(G log -1 --format='%h %s'); answering on $HEALTH."; exit 0; fi
  sleep 1
done
echo "The new version did not answer on $HEALTH within 15 s (journalctl -u trust-guide -n 30)."
back
exit 1
