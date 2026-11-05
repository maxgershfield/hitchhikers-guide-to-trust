# The Hitchhiker's Guide to Trust

**A Galaxy of Local-First Verifiable Trust Communities, Agents, Guides and Guidance Built with Trust Tasks**

A guide you visit, play with and add to, for the Hitchhikers' presentations: first shown at IIW 43, with a lightning
version for Hitchhiker nights. Two halves: **the Hitchhikers** (their story, method and ceremonies) and **the
implementation** (OpenVTC and VTI). Everyone in the room can add to its evidence chain from their own phone as the
talk goes.

This repo is the deployable piece, and only that:

1. **The website**: the guide, the chain page, the home page (`site/public/`).
2. **The evidence chain**: the small server that keeps it (`site/serve.mjs` on a Pi, or `site/src/worker.js` as a
   Cloudflare Worker), plus the wiring for several Pis to feed one aggregate chain.
3. **The connection to a VTC**: the chain page's *Join* tab reads a verifiable trust community's live profile and join
   manifest, so visitors can join it by DID and claim their stars.

## Run it

```
cd site
node serve.mjs            # http://localhost:8788 (Node 20+; no install step)
```

The keeper key for `/keeper` is generated into `site/data/keeper-key.txt`; the chain is kept in `site/data/store.json`.
Neither is ever committed.

## The pages

| page | what |
|---|---|
| `/guide/?path=iiw` | **the full presentation**: the Hitchhikers, then the implementation (OpenVTC + VTI) |
| `/guide/?path=lightning` | **the lightning talk**: the short path; teleport between the two at any scene |
| `/chain/` | **the evidence chain**: every thumbs up, proverb, guide and voice note is a star. `H` hides the text; `?demo&from=1&every=3` grows an example night from its genesis |
| `/` · `/newspeak` · `/iiw43` · `/archive` | home, and each night's own door to the one chain |
| `/keeper` | the keeper's page: approve, hide, export guides as wiki pages |
| `/over-to-you/` | **Over to You**: the questions for the tables, for phones. Edit them in `site/public/questions.js` (the talk's slide and `/record` use the same list). Also a scene inside the guide |
| `/record/` | a one-button voice note for a phone on a table: sealed on the phone, kept on the Pi, its star on the chain, optionally labelled proverb, poem, pledge, question or 42. Also a scene inside the guide |
| `/future/` | **Who Owns the Future?** venue map + agenda (Newspeak House): edit `site/public/future/index.html` |

Every scene of the guide has a thumbs-up button (top right): each touch adds this device's star to the chain, with the
scene sealed inside. The Pi Ceremony's record button records a pledge, sealed, as a voice star.

## Settings

| variable | what |
|---|---|
| `PORT`, `HOST`, `DATA` | where the server listens (default 127.0.0.1:8788; `HOST` a tailnet address if the proxy is on another machine) and keeps its data |
| `KEEPER_KEY` | the keeper's key (otherwise generated into `DATA/keeper-key.txt`) |
| `EVENTS`, `DEFAULT_EVENT` | each night's name, date and place. **Set before the first visitor**: a chain's genesis is fixed once written. `DEFAULT_EVENT` is tonight's night (`iiw43`, `newspeak`, `archive`): set, it always wins; unset, the night is picked by date (UTC) |
| `CITY_API`, `CITY_JOIN` | **the VTC to connect to**: its API base (public profile, join manifest, DID QR) and its join page. Default: Mages City. For the Hitchhikers VTC, set both to its addresses once it is up |
| `SCROLL_ORIGIN`, `ROOM_NAME`, `ROOM_KEY` | on a room/city Pi: pass every star up to the aggregate chain |
| `ROOM_KEYS` | on the aggregate Pi: the rooms allowed to feed it, as JSON `{"name": "key"}` |
| `GATE_ORIGIN` | Worker only: hand every `/api/*` call to a Pi, so the Pi holds the door |

## Deploy

- **One Pi, public**: `site/pi/install.sh` sets it up as a service from a clone of this repo, behind a reverse proxy
  or a tunnel; `site/pi/update.sh` pulls each push and restarts it, going back if it doesn't answer. See `site/pi/README.md`.
  Two homes are planned, the same code, each with its own chain and keeper key:
  - `trust.hitchhikers.earth`: the Hitchhikers' instance, on their Pi 5 (behind their Caddy), holding the aggregate chain.
  - `trust.mages.city`: Mitch's instance, on his Pi 4 (a Cloudflare tunnel). A second home, and the **backup**: if the
    Hitchhikers' Pi is down, the guide still runs here, and it keeps a copy of the aggregate chain.
- **Many Pis, one aggregate**: each Pi keeps its own chain (`SCROLL_ORIGIN` → the aggregate Pi over the tailnet); the
  aggregate Pi hosts the site and lists the room keys. See "Rooms" in `site/README.md`.
- **Cloudflare Worker**: `site/wrangler.jsonc` (KV namespace, keeper key, deploy).
- **The night's group chat**: `site/bot/claim-bot.mjs` answers a claim code with a proverb (reference bot; not yet run
  against Telegram).

## Privacy, in one paragraph

No accounts and no tracking. A visitor's mark is a hash of a secret their own browser keeps. The chain holds hashes and
boxes sealed with the visitor's own key; nothing anyone writes appears on it in the clear. Proverbs and guides are
public only once the keeper approves them. Addresses are never stored, only a salted daily hash for the rate limit.

## Status

Built and tested locally: the guide and its paths, the evidence chain and sealing, thumbs up from every scene, recorded
pledges, rooms feeding an aggregate chain, the gate, claiming after joining (claim code + DID, the DID kept only as a
hash). Not yet: a live deployment; the room outbox (a star passed up while the aggregate Pi is offline is not yet
retried); safe writes for power cuts; the bot run against Telegram; the hosting agent signing the chain; DID-signed
claims; a VTC turning a claim into a credential.

## Credits

The Hitchhikers' presentations (Public Intelligence; the reviewed assembly) shaped the first half. Baby Dragon images:
REAL PARENT / INJURY, used with permission. The sigil script (`site/public/sigil/sigilcode.js`) and the 64-state
geometry come from the City of Mages scrolls (mages.city).
