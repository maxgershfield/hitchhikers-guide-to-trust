# The Hitchhiker's Guide to Trust: the site

A site anyone can visit, reread and play with. The one thing visitors can add is at the end: a "Don't Panic"
proverb or a new guide. It waits for the keeper, and it can only be sent while **the gate** is open.

| path | what |
|---|---|
| `/` | home: the guide, the short version, the work notes |
| `/guide/` | **The Hitchhiker's Guide to Trust**: 14 scenes to touch and play with (first shown at IIW 43) |
| `/talk/` | the short version, a lightning talk (in progress) |
| `/notes` | work notes: the technical side, written down plainly |
| `/keeper` | yours: approve, fix, hide; export guides as wiki pages |

## 1 · Deploy as a Cloudflare Worker (runs on its own)

```
npx wrangler kv namespace create PROVERBS     # paste the id into wrangler.jsonc
npx wrangler secret put KEEPER_KEY             # a long passphrase; this is your /keeper login
npx wrangler deploy
```

The pages and the API both come from the Worker; submissions are stored in KV. The gate shows as open.

## 2 · Let a Pi hold the gate

The pages stay on Cloudflare; every submission goes to the Pi instead. Unplug the Pi and the gate closes
(the guide and the home page say so, and the form locks); plug it back in and it reopens once the Pi has booted.

On the Pi (see `pi/README.md`): run `serve.mjs` as a service, with a Cloudflare Tunnel giving it a name such as
`gate.mages.city`. Then set `GATE_ORIGIN` in `wrangler.jsonc` to that address and deploy again.

The Pi keeps its own data and its own keeper key (`data/keeper-key.txt` on the Pi). With the gate on, `/keeper`
talks to the Pi.

## Rooms: several Pis, one scroll

Each room's Pi runs this same site with its own gate and its own chain, and passes every new star up to one central
scroll (its hash, the visitor's mark and the room's name; never what was written). The central scroll shows each
room with a live light, kept fresh by a heartbeat; unplug a room's Pi and only that room goes dark.

```
# the central scroll (a Worker, or a Pi): one key per room
ROOM_KEYS='{"Main hall":"<key>","Library":"<key>"}' node serve.mjs

# each room's Pi
SCROLL_ORIGIN=https://dontpanic.mages.city ROOM_NAME="Library" ROOM_KEY=<key> NODE_NAME="Library Pi" node serve.mjs
```

Each central link records the room link's own hash, so a room's chain and the central scroll can be checked
against each other. Everyone's stars are joined by their mark, wherever they were made, into their own evidence root.

## The night's group chat: the claim trust task

A thumb up shows the visitor a **claim code** (their sigil and four words). Only its hash goes on the chain, so
only they have it. Pasted into the night's group chat, the bot relays the message to `/api/keeper/claim`; the
site finds the thumb up that committed to that code and writes a **claim** link under the same mark (the chat
handle only as a salted hash), and the bot answers with a proverb from the approved wall.

`bot/claim-bot.mjs` is a reference Telegram bot (no database; the site does the matching):

```
TELEGRAM_BOT_TOKEN=... SITE=https://dontpanic.mages.city KEEPER_KEY=... node bot/claim-bot.mjs
```

Add it to the group and turn off its privacy mode (BotFather: /setprivacy → Disable). The site's claim endpoint
is tested; the bot has not yet been run against Telegram itself.

## 3 · Next

- The Hitchhikers' own node hosts the gate, at a hitchhikers.earth address.
- Submissions become wiki pages on that node automatically (today: export from `/keeper`).
- Knowledge-graph items from the chat app (Bonfires), if that work comes through.

## Local preview

`node serve.mjs` serves the same site at http://127.0.0.1:8788 with a file store in `data/`. This is also
exactly what the Pi runs.

## Privacy

No accounts and no tracking. Visitors send a line of text, and a name only if they choose. Addresses are never
stored (rate limiting uses a salted hash held for a minute). Nothing is public until the keeper approves it.
