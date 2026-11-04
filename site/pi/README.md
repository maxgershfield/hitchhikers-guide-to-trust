# Hosting the guide on a Pi

The same code runs in two homes, each with its own chain and keeper key:

| | address | Pi | public name by | role |
|---|---|---|---|---|
| the Hitchhikers | `trust.hitchhikers.earth` | their Pi 5 | their Caddy | the aggregate chain |
| Mitch | `trust.mages.city` | Mitch's Pi 4 | a Cloudflare tunnel | a second home and the backup |

Each Pi keeps a clone of this repo. Changes go: **push to `main` → the Pi pulls → the server restarts.**
The chain lives outside the clone (`~/trust-data`), so pulling never touches anyone's stars.

## Once, on each Pi

Needs Node.js 20+ (arm64 build from nodejs.org), git, and systemd (Raspberry Pi OS or Ubuntu).

```
git clone https://github.com/mitchuski/hitchhikers-guide-to-trust.git ~/trust

# the Hitchhikers' Pi 5 (behind their Caddy)
~/trust/site/pi/install.sh --domain trust.hitchhikers.earth --via caddy

# Mitch's Pi 4 (Cloudflare tunnel; run `cloudflared tunnel login` once first)
~/trust/site/pi/install.sh --domain trust.mages.city --via tunnel
```

Add `--dry-run` to see everything it would do first. It:

- writes the settings to `~/.config/trust-guide/env` (once; never overwritten, yours to edit),
- keeps the chain and keeper key in `~/trust-data`,
- installs `trust-guide.service` (the server) and, with `--via tunnel`, `trust-guide-tunnel.service` with its own
  config `~/.cloudflared/trust-guide.yml`,
- starts them and checks the server answers.

It never edits Caddy, an existing cloudflared config, or anything else on the Pi. With `--via caddy` it prints the
block for whoever runs Caddy:

```
trust.hitchhikers.earth {
  reverse_proxy 127.0.0.1:8788
}
```

If Caddy runs on a different machine from the server, set `HOST=` in the settings file to the Pi's tailnet address
and use that address in the block instead.

Other options: `--port` (if 8788 is taken), `--name` (what `/api/gate` calls this node), `--auto-update` (below).

**Before the first visitor**, set each night in `EVENTS` in the settings file, then
`sudo systemctl restart trust-guide`. A night's first link is fixed once written.

**Each night**, set `DEFAULT_EVENT` (`iiw43`, `newspeak`, `archive`) in the settings file and restart: every star
that doesn't come through a night's own door (`/iiw43`, `/newspeak`) goes to that night. The next day, change it and
restart again. Without it the night is picked by date in UTC, which flips mid-afternoon in California.

## Each time something changes

```
# on your computer
git push

# on each Pi
~/trust/site/pi/update.sh
```

`update.sh` shows what's new, pulls it, checks the server scripts parse, restarts, and checks the server answers.
If anything fails it goes back to the version it was on. It refuses to run if the clone has local edits (a Pi
only ever pulls). `--check` only says whether there is something new.

With `install.sh --auto-update`, a timer runs it every 10 minutes, so a push to `main` reaches the Pi by itself.
It's off by default: on the day of a talk you may prefer to choose when the room sees a change.

## Looking after it

| | |
|---|---|
| is it up? | `curl https://<domain>/api/gate` |
| logs | `journalctl -u trust-guide -n 50` (tunnel: `-u trust-guide-tunnel`) |
| restart | `sudo systemctl restart trust-guide` |
| keeper key | `~/trust-data/keeper-key.txt` (keeper page: `https://<domain>/keeper`) |
| backups | a dated copy of the chain every night at 03:30 in `~/trust-data/backups/` (last 30 kept): `pi/backup.sh --list`, or `pi/backup.sh` for one now. `install.sh` sets the timer up; on a Pi installed before it existed, run `~/trust/site/pi/backup.sh --install` once. The copies share the card with the chain, so now and then `scp` one to another machine, and keep them private: they hold everyone's sealed stars and voice notes. |
| back up the chain | copy `~/trust-data/store.json` while the server runs |

## Rooms: Pis feeding the aggregate

A Pi can also pass every star it receives up to the aggregate (`trust.hitchhikers.earth`): its hash, the visitor's
mark and the room's name, never what was written. In the aggregate's settings, list the room and a long random key:

```
ROOM_KEYS='{"Mitch Pi 4":"<key>"}'
```

and in the room Pi's settings:

```
SCROLL_ORIGIN=https://trust.hitchhikers.earth
ROOM_NAME=Mitch Pi 4
ROOM_KEY=<the same key>
```

Restart both. Not yet built: a star passed up while the aggregate is offline is not retried, and the Pi 4 does not
yet keep a full copy of the aggregate's chain.
