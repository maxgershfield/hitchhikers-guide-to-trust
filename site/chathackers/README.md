# ChatHackers → Ceremony listener

Fast path for the night: ChatHackers posts **consented text** from a group; we write a
**chat star** on that night’s Guide chain immediately, tagged with a **topic**
(Knowledge Café). No approve click in the happy path.

## Start with the Guide

```bash
# Terminal A — Guide
cd site
node serve.mjs

# Terminal B — listener
cd site/chathackers
export CHATHACKERS_WEBHOOK_SECRET="$(openssl rand -hex 32)"
export TRUST_ADMIN_KEY="$(openssl rand -hex 32)"
export TRUST_SITE=http://127.0.0.1:8788
export KEEPER_KEY="$(tr -d '\n' < ../data/keeper-key.txt)"
export DEFAULT_EVENT=newspeak
export TOPIC_MAP='{"wa:deep-thought":"deep-thought","wa:space-data-centers":"space-data-centers"}'
node server.mjs
```

`AUTO_CHAIN` is on whenever `TRUST_SITE` and `KEEPER_KEY` are set. Set `AUTO_CHAIN=0` for the old pending/approve flow.

## ChatHackers contract

`POST /api/integrations/chathackers`  
`Authorization: Bearer <CHATHACKERS_WEBHOOK_SECRET>`

```json
{
  "messageId": "unique-message-id",
  "channel": "whatsapp",
  "type": "text",
  "transcript": "I will keep looking at Deep Thought with this table for an hour.",
  "displayName": "Anonymous Hitchhiker",
  "consentToPublish": true,
  "eventId": "newspeak",
  "groupId": "wa:deep-thought",
  "topic": "deep-thought"
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `messageId` | yes | Idempotent |
| `transcript` | yes | Text only for now |
| `consentToPublish` | yes | Must be `true` |
| `type` | yes | `text` |
| `eventId` | no | Defaults to `DEFAULT_EVENT` (`newspeak`) |
| `groupId` | no | Mapped via `TOPIC_MAP` → topic |
| `topic` | no | Wins over map; else `DEFAULT_TOPIC` |

**Response (auto):** `201 { status: "approved", seq, hash, topic, chainUrl }`  
**Duplicate `messageId`:** `200` with the existing star.

## Topics (different chat groups)

Set `TOPIC_MAP` to stable ChatHackers / WhatsApp group ids:

```bash
TOPIC_MAP='{
  "wa:deep-thought":"deep-thought",
  "wa:space-data-centers":"space-data-centers"
}'
```

| Group | topic |
|-------|-------|
| Deep Thought | `deep-thought` |
| Space Data Centers | `space-data-centers` |

Filter later: `/api/approved?topic=deep-thought` · `/api/ceremony/contributions?topic=space-data-centers` · `GET /api/ceremony/topics`

Ask ChatHackers to send `groupId` on every webhook. Optional: after `201`, reply in that group with `chainUrl` (we cannot send WhatsApp ourselves).

## Routes

| Route | Auth | Role |
|-------|------|------|
| `POST /api/integrations/chathackers` | webhook | Ingest → chain (auto) |
| `GET /api/ceremony/contributions` | — | Approved feed (`?topic=` / `?event=`) |
| `GET /api/ceremony/topics` | — | Counts + map |
| `GET /api/ceremony/pending` | admin | Only if `AUTO_CHAIN=0` |
| `POST /api/ceremony/approve/:id` | admin | Manual mode |
| `POST /api/ceremony/reject/:id` | admin | Reject before chain |
| `GET /api/ceremony/events` | — | SSE |

Already-on-chain hide: Guide `/keeper` (approved wall).

## What lands on the chain

`POST {TRUST_SITE}/api/keeper/ceremony` creates:

1. a `chat` link with `topic` (and optional `groupId`) on that night
2. an approved-wall proverb for readable text

Leaf commits to `sha256(chathackers|sourceId|topic|text)`.
