#!/usr/bin/env bash
# A dated copy of the chain, once a night: ~/trust-data/backups/store-YYYY-MM-DD.json, the last 30 kept.
# The server rewrites store.json as people add stars, so each copy is checked (it must parse) before it is kept.
#
#   ~/trust/site/pi/backup.sh              # take a copy now
#   ~/trust/site/pi/backup.sh --install    # install the nightly timer (03:30, and on boot if a night was missed)
#   ~/trust/site/pi/backup.sh --list       # show the copies
#
# The copies sit on the same card as the chain: they guard against a bad write or a mistake, not a dead card.
# Now and then pull one to another machine:  scp <pi>:~/trust-data/backups/store-<date>.json .
# They hold people's sealed stars and voice notes: keep them private, never in the repo.
set -euo pipefail

KEEP=30
SITE="$(cd "$(dirname "$0")/.." && pwd)"
OWNER="$(stat -c %U "$SITE")"
OWNER_HOME="$(getent passwd "$OWNER" | cut -d: -f6)"
ENVF="$OWNER_HOME/.config/trust-guide/env"
DATA="$( [ -f "$ENVF" ] && sed -n 's/^DATA=//p' "$ENVF" | tail -1 || true)"; DATA="${DATA:-$OWNER_HOME/trust-data}"; DATA="${DATA%/}"
OUT="$DATA/backups"

case "${1:-}" in
  --install)
    [ "$(id -u)" -ne 0 ] || { echo "run --install as $OWNER, not root (it asks for sudo)"; exit 2; }
    printf '%s\n' "[Unit]
Description=A dated copy of the Guide to Trust chain

[Service]
Type=oneshot
User=$OWNER
ExecStart=$SITE/pi/backup.sh" | sudo tee /etc/systemd/system/trust-guide-backup.service >/dev/null
    printf '%s\n' "[Unit]
Description=Copy the Guide to Trust chain every night

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true

[Install]
WantedBy=timers.target" | sudo tee /etc/systemd/system/trust-guide-backup.timer >/dev/null
    sudo systemctl daemon-reload
    sudo systemctl enable --now trust-guide-backup.timer
    echo "Nightly backup on: $(systemctl list-timers trust-guide-backup.timer --no-legend | awk '{print "next", $1, $2, $3}')"
    exec "$0" ;;
  --list) ls -l "$OUT" 2>/dev/null || echo "No backups yet in $OUT."; exit 0 ;;
  '') ;;
  *) echo "unknown option: $1"; exit 2 ;;
esac

[ -f "$DATA/store.json" ] || { echo "No chain at $DATA/store.json yet; nothing to copy."; exit 0; }
command -v node >/dev/null || { echo "Node.js is not on the PATH; can't check the copy."; exit 1; }
mkdir -p "$OUT"; chmod 700 "$OUT"
DAY="$(date +%F)" TMP="$OUT/.store-$DAY.tmp"
ok=0
for _ in 1 2 3 4 5; do
  cp "$DATA/store.json" "$TMP"
  if node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$TMP" 2>/dev/null; then ok=1; break; fi
  sleep 2   # caught mid-write: try again
done
[ $ok = 1 ] || { rm -f "$TMP"; echo "Could not get a clean copy of store.json."; exit 1; }
chmod 600 "$TMP"; mv "$TMP" "$OUT/store-$DAY.json"
ls -1 "$OUT"/store-*.json | sort | head -n -"$KEEP" | xargs -r rm -f
echo "Backed up to $OUT/store-$DAY.json ($(du -h "$OUT/store-$DAY.json" | cut -f1)); $(ls -1 "$OUT"/store-*.json | wc -l) kept."
