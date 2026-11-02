#!/usr/bin/env bash
# Set up the Guide to Trust on a Pi, from a clone of this repo. Run it on the Pi, as the user who owns the clone:
#
#   git clone https://github.com/mitchuski/hitchhikers-guide-to-trust.git ~/trust
#   ~/trust/site/pi/install.sh --domain trust.mages.city --via tunnel          # Mitch's Pi 4 (Cloudflare tunnel)
#   ~/trust/site/pi/install.sh --domain trust.hitchhikers.earth --via caddy    # the Hitchhikers' Pi 5 (their Caddy)
#
# Options:
#   --domain <name>    the public name (required)
#   --via tunnel|caddy tunnel: make a Cloudflare tunnel for the name (needs cloudflared, logged in once)
#                      caddy:  print the Caddy block for whoever runs the proxy; this script never edits Caddy
#   --port <n>         where the server listens (default 8788)
#   --bind <addr>      the address it listens on (default 127.0.0.1; a tailnet address if the proxy is elsewhere)
#   --name <text>      this node's name, shown by /api/gate (default: the domain)
#   --auto-update      also install a timer that runs update.sh every 10 minutes (off by default)
#   --dry-run          print what it would do, change nothing
#
# Safe to run again: it never overwrites the settings file or the chain, and only touches its own units and files:
#   ~/.config/trust-guide/env      the settings (EVENTS, keys...), made once, yours to edit
#   ~/trust-data/                  the chain and keeper key (outside the clone, so a re-clone keeps them)
#   trust-guide.service            the server
#   trust-guide-tunnel.service     the tunnel (--via tunnel), config in ~/.cloudflared/trust-guide.yml
#   trust-guide-update.timer       the auto-update (--auto-update)
set -euo pipefail

DOMAIN='' VIA='' PORT=8788 BIND=127.0.0.1 NAME='' AUTO=0 DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --via) VIA="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --bind) BIND="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --auto-update) AUTO=1; shift ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) echo "unknown option: $1 (see --help)"; exit 2 ;;
  esac
done
[ -n "$DOMAIN" ] || { echo "--domain is required (see --help)"; exit 2; }
case "$VIA" in tunnel|caddy) ;; *) echo "--via must be tunnel or caddy"; exit 2 ;; esac
[ -n "$NAME" ] || NAME="$DOMAIN"
[ "$(id -u)" -ne 0 ] || { echo "run this as the user who owns the clone, not root (it asks for sudo when it needs it)"; exit 2; }

SITE="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$SITE/.." && pwd)"
ME="$(id -un)"
CONF="$HOME/.config/trust-guide"
DATA="$HOME/trust-data"
UNITS=/etc/systemd/system

say() { printf '\n== %s\n' "$*"; }
run() { if [ "$DRY" = 1 ]; then echo "  would run: $*"; else "$@"; fi; }
# write_root <path> <content>: a file only root may write (the unit files)
write_root() {
  if [ "$DRY" = 1 ]; then echo "  would write $1:"; printf '%s\n' "$2" | sed 's/^/    | /'; else printf '%s\n' "$2" | sudo tee "$1" >/dev/null; fi
}

say "Checking"
command -v git >/dev/null || { echo "git is missing"; exit 1; }
command -v node >/dev/null || { echo "Node.js is missing: install Node 20+ (arm64 build) from nodejs.org"; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || { echo "Node $NODE_MAJOR is too old: needs 20+"; exit 1; }
command -v systemctl >/dev/null || { echo "systemd is missing"; exit 1; }
git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1 || { echo "$REPO is not a git clone: clone the repo, then run this from it"; exit 1; }
NODE_BIN="$(command -v node)"
echo "  repo $REPO · node $(node --version) at $NODE_BIN · user $ME"

# the port must be free, unless it is already ours
if command -v ss >/dev/null && ss -ltnH "( sport = :$PORT )" 2>/dev/null | grep -q .; then
  if systemctl is-active --quiet trust-guide 2>/dev/null; then echo "  port $PORT: in use by trust-guide (ours), fine"
  else echo "  port $PORT is taken by something else on this Pi. Pick another: --port <n>"; exit 1; fi
else echo "  port $PORT: free"; fi

say "Settings and data"
run mkdir -p "$CONF" "$DATA"
if [ -f "$CONF/env" ]; then
  echo "  $CONF/env exists: kept as it is (edit it yourself); using its PORT and HOST"
  P="$(sed -n 's/^PORT=//p' "$CONF/env" | tail -1)"; [ -z "$P" ] || PORT="$P"
  B="$(sed -n 's/^HOST=//p' "$CONF/env" | tail -1)"; [ -z "$B" ] || BIND="$B"
else
  ENVTXT="# The Guide to Trust on $DOMAIN. Read by trust-guide.service; edit, then: sudo systemctl restart trust-guide
PORT=$PORT
HOST=$BIND
DATA=$DATA
NODE_NAME=$NAME

# Each night's name, date and place (JSON, in single quotes). SET BEFORE THE FIRST VISITOR: a night's first link is
# fixed once written. Leave commented to use the built-in nights (newspeak, iiw43, archive).
#EVENTS='{\"newspeak\":{\"name\":\"The Guide to Newspeak House\",\"date\":\"2026-11-05\",\"place\":\"Newspeak House, London\"}}'
#DEFAULT_EVENT=newspeak

# The VTC the chain page's Join tab connects to (default: Mages City)
#CITY_API=
#CITY_JOIN=

# On the aggregate Pi: the rooms allowed to feed it
#ROOM_KEYS='{\"Mitch Pi 4\":\"<long random key>\"}'

# On a room Pi: pass every star up to the aggregate
#SCROLL_ORIGIN=https://trust.hitchhikers.earth
#ROOM_NAME=Mitch Pi 4
#ROOM_KEY=<the same key as in the aggregate's ROOM_KEYS>"
  if [ "$DRY" = 1 ]; then echo "  would write $CONF/env:"; printf '%s\n' "$ENVTXT" | sed 's/^/    | /'
  else printf '%s\n' "$ENVTXT" > "$CONF/env"; chmod 600 "$CONF/env"; echo "  wrote $CONF/env"; fi
fi
if [ -d "$SITE/data" ] && [ -f "$SITE/data/store.json" ] && [ ! -f "$DATA/store.json" ]; then
  echo "  found a chain in $SITE/data: copying it to $DATA (the old copy stays where it is)"
  run cp -n "$SITE/data/store.json" "$SITE/data/keeper-key.txt" "$DATA/" 2>/dev/null || true
fi

say "The server: trust-guide.service"
write_root "$UNITS/trust-guide.service" "[Unit]
Description=The Hitchhiker's Guide to Trust ($DOMAIN)
After=network-online.target
Wants=network-online.target

[Service]
User=$ME
WorkingDirectory=$SITE
EnvironmentFile=$CONF/env
ExecStart=$NODE_BIN serve.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target"

if [ "$VIA" = tunnel ]; then
  say "The tunnel: $DOMAIN"
  command -v cloudflared >/dev/null || { echo "  cloudflared is missing: install Cloudflare's arm64 package, then run this again"; exit 1; }
  if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
    echo "  cloudflared is not logged in. Run this once (it opens a link to approve in a browser), then run install.sh again:"
    echo "    cloudflared tunnel login"
    exit 1
  fi
  if cloudflared tunnel list --output json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.exit(JSON.parse(s||"[]").some(t=>t.name==="trust-guide")?0:1))'; then
    echo "  tunnel trust-guide exists"
  else
    run cloudflared tunnel create trust-guide
  fi
  TID="$(cloudflared tunnel list --output json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const t=JSON.parse(s||"[]").find(t=>t.name==="trust-guide");process.stdout.write(t?t.id:"")})')"
  [ -n "$TID" ] || { [ "$DRY" = 1 ] && TID='<tunnel-id>' || { echo "  could not find the tunnel's id"; exit 1; }; }
  CFG="tunnel: $TID
credentials-file: $HOME/.cloudflared/$TID.json
ingress:
  - hostname: $DOMAIN
    service: http://127.0.0.1:$PORT
  - service: http_status:404"
  if [ "$DRY" = 1 ]; then echo "  would write $HOME/.cloudflared/trust-guide.yml:"; printf '%s\n' "$CFG" | sed 's/^/    | /'
  else printf '%s\n' "$CFG" > "$HOME/.cloudflared/trust-guide.yml"; echo "  wrote $HOME/.cloudflared/trust-guide.yml"; fi
  # points the name at the tunnel; says so and carries on if the name already has a record
  run cloudflared tunnel route dns trust-guide "$DOMAIN" || echo "  (route dns did not complete: if $DOMAIN already points somewhere, change it in the Cloudflare dashboard)"
  write_root "$UNITS/trust-guide-tunnel.service" "[Unit]
Description=Cloudflare tunnel for the Guide to Trust ($DOMAIN)
After=network-online.target trust-guide.service
Wants=network-online.target

[Service]
User=$ME
ExecStart=$(command -v cloudflared) --no-autoupdate tunnel --config $HOME/.cloudflared/trust-guide.yml run
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target"
fi

if [ "$AUTO" = 1 ]; then
  say "Auto-update: every 10 minutes"
  write_root "$UNITS/trust-guide-update.service" "[Unit]
Description=Pull the Guide to Trust and restart it if anything changed

[Service]
Type=oneshot
ExecStart=$SITE/pi/update.sh --quiet"
  write_root "$UNITS/trust-guide-update.timer" "[Unit]
Description=Check for a new Guide to Trust every 10 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=10min

[Install]
WantedBy=timers.target"
fi

say "Starting"
run sudo systemctl daemon-reload
run sudo systemctl enable --now trust-guide
[ "$VIA" = tunnel ] && run sudo systemctl enable --now trust-guide-tunnel
[ "$AUTO" = 1 ] && run sudo systemctl enable --now trust-guide-update.timer

if [ "$DRY" = 0 ]; then
  CHECK="http://127.0.0.1:$PORT/api/gate"; [ "$BIND" = 127.0.0.1 ] || CHECK="http://$BIND:$PORT/api/gate"
  ok=0; for _ in $(seq 1 15); do curl -fsS "$CHECK" >/dev/null 2>&1 && { ok=1; break; }; sleep 1; done
  if [ $ok = 1 ]; then echo "  up: $(curl -fsS "$CHECK")"; else echo "  not answering yet: journalctl -u trust-guide -n 30"; exit 1; fi
fi

say "Done"
echo "  keeper key: $DATA/keeper-key.txt (the keeper page is https://$DOMAIN/keeper)"
echo "  settings:   $CONF/env  (set EVENTS before the first visitor, then: sudo systemctl restart trust-guide)"
echo "  update:     $SITE/pi/update.sh"
if [ "$VIA" = caddy ]; then
  UP="127.0.0.1:$PORT"; [ "$BIND" = 127.0.0.1 ] || UP="$BIND:$PORT"
  echo
  echo "  For whoever runs Caddy (this script does not touch it), add:"
  echo "    $DOMAIN {"
  echo "      reverse_proxy $UP"
  echo "    }"
  echo "  If Caddy runs on another machine: set HOST=<this Pi's tailnet address> in $CONF/env, then restart trust-guide."
else
  echo "  check from anywhere: curl https://$DOMAIN/api/gate"
fi
