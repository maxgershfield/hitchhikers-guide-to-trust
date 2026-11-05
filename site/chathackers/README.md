# ChatHackers → Ceremony listener

Standalone Node 20+ adapter. ChatHackers posts **consented text**; a ceremony admin
approves; approval writes a **chat star** onto the Guide evidence chain and puts the
text on that night's approved wall.

This does not invent cryptographic seals. The Guide's own keeper endpoint
(`/api/keeper/ceremony` in `site/src/worker.js`) creates the star.

## Start (with local Guide)

Terminal A, the Guide:

```bash
cd ../
node serve.mjs          # http://127.0.0.1:8788 — note data/keeper-key.txt
```

Terminal B, this listener:

```bash
cd site/chathackers
export CHATHACKERS_WEBHOOK_SECRET="$(openssl rand -hex 32)"
export TRUST_ADMIN_KEY="$(openssl rand -hex 32)"
export TRUST_SITE=http://127.0.0.1:8788
export KEEPER_KEY="$(tr -d '\n' < ../data/keeper-key.txt)"
node server.mjs         # http://127.0.0.1:8799/
```

Open the test UI, paste both secrets, send a text contribution with a night selected,
then Approve. Confirm a new `chat` star on `http://127.0.0.1:8788/chain/?event=newspeak`.

## ChatHackers contract

`POST /api/integrations/chathackers`  
`Authorization: Bearer <CHATHACKERS_WEBHOOK_SECRET>`

```json
{
  "messageId": "unique-message-id",
  "channel": "whatsapp",
  "type": "text",
  "transcript": "I will keep the terrace desk for two hours tonight.",
  "displayName": "Anonymous Hitchhiker",
  "consentToPublish": true,
  "eventId": "newspeak"
}
```

- `eventId` required: `newspeak` | `iiw43` | `archive`
- `type` must be `text` (transcript required; audio-only not accepted yet)
- `consentToPublish` must be `true`
- Repeated `messageId` → `200` duplicate, no second row

## Routes

| Route | Auth | Role |
|-------|------|------|
| `GET /health` | — | Health; `chain: true` when TRUST_SITE is wired |
| `POST /api/integrations/chathackers` | webhook | Ingest pending text |
| `GET /api/ceremony/pending` | admin | Pending list |
| `POST /api/ceremony/approve/:id` | admin | Approve → Guide chain |
| `POST /api/ceremony/reject/:id` | admin | Reject |
| `GET /api/ceremony/contributions` | — | Approved feed |
| `GET /api/ceremony/events` | — | SSE `event: star` |

## Deploy beside the Pi site

Run on `127.0.0.1:8799`. In Caddy, route `/api/integrations/chathackers` and
`/api/ceremony/*` here **before** the main Guide. Set `TRUST_SITE` to the Guide's
loopback URL and `KEEPER_KEY` to the same key as the Guide. Do not expose the test UI
or admin key publicly.

## What lands on the chain

On approve, the listener calls `POST {TRUST_SITE}/api/keeper/ceremony` with the keeper
key. The Guide:

1. adds a `chat` link whose leaf commits to `sha256(chathackers|sourceId|text)`
2. puts the clear text on the **approved** proverb wall for that night (ceremony already
   moderated; no second queue hop)

Public chain responses still show hashes and kinds only; the wall holds readable text.
