# The gate on a Raspberry Pi

The Pi holds the door: while it runs, visitors can add a proverb or a guide; unplug it and the door closes.
Works on a Pi 4 or Pi 5 with Raspberry Pi OS or Ubuntu, on any Wi-Fi (it only dials out).

## Before the night

1. **Node.js 20 or newer**: `node --version`. If older, install from nodejs.org (arm64 or armv7 build to match the OS).
2. **The site**: copy the whole `dontpanic.mages.city` folder to the Pi, e.g. `~/dontpanic`.
3. **Wi-Fi**: save the venue's network, or your phone's hotspot, so the Pi joins it by itself.
4. **The tunnel**: install `cloudflared` (Cloudflare's arm package), then once:
   ```
   cloudflared tunnel login
   cloudflared tunnel create dontpanic-gate
   cloudflared tunnel route dns dontpanic-gate gate.mages.city
   ```
   and point it at the site in `~/.cloudflared/config.yml`:
   ```
   tunnel: dontpanic-gate
   credentials-file: /home/<you>/.cloudflared/<tunnel-id>.json
   ingress:
     - hostname: gate.mages.city
       service: http://localhost:8788
     - service: http_status:404
   ```
5. **Start both on boot**: copy the two unit files in this folder to `/etc/systemd/system/` (edit `User=` and the
   paths), then `sudo systemctl enable --now dontpanic cloudflared-dontpanic`.
6. **Check**: `curl https://gate.mages.city/api/gate` answers `{"gate":"open","host":"…"}`.
7. **Point the Worker at it**: set `GATE_ORIGIN` to `https://gate.mages.city` in `wrangler.jsonc`, `npx wrangler deploy`.

Your keeper key on the Pi is in `~/dontpanic/data/keeper-key.txt`.

## On the night

Plug in: about a minute later the gate opens. Unplug: within seconds the guide's last scene and the home page say
the gate is closed, and the form locks. Plug back in to reopen it.

Tailscale isn't needed for the gate. It is handy for SSH into the Pi from a laptop on another network.
