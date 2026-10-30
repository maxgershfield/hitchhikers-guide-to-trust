# The Hitchhiker's Guide to Trust

**A Galaxy of Local-First Verifiable Trust Communities, Agents, Guides and Guidance Built with Trust Tasks**

A guide you visit, play with and add to, for the Hitchhikers' presentations: first shown at IIW 43, with a
lightning version for Hitchhiker nights and a university workshop in Amsterdam next. It brings together the
Hitchhikers (guides and guidance), OpenVTC (trust graphs), agentprivacy · Mages City (open autoresearch and agentic
privacy), Bonfires (knowledge graphs from chat), the local co-op (cooperative ownership) and Chathackers (agents in
group chats).

## What's here

| path | what |
|---|---|
| `site/` | the whole site: pages, the small API (`src/worker.js`), the Pi kit, the group-chat bot |
| `announce/` | the handwritten session card (HTML + PDF) and the announcement text |

On the site:

| page | what |
|---|---|
| `/` | home: the title, the doors, and the first trust task (thumb up) |
| `/guide/?path=workshop` | **the workshop**: a short guide, then "Over to you" (questions, and every deeper scene one touch away) |
| `/guide/?path=lightning` | **the lightning talk**: five scenes and the call to action |
| `/guide/` | the whole guide, 18 scenes |
| `/newspeak`, `/iiw43`, `/archive` | add to that night: one guide, one chain from its genesis, each night opening its own page (set nights' names, dates and places with `EVENTS` before each night's first visitor) |
| `/chain/` | **the evidence chain**: the public face of the guide. Every thumb up, proverb and guide is a star on the Star's 64 states; drag to turn it; point to see a star's threads and its owner's evidence root; *The scroll* writes the whole chain in the sigil script. `?demo` shows an example night |
| `/notes` | work notes: the technical side, written plainly |
| `/keeper` | the keeper's page: approve, hide, export guides as wiki pages |

## Try it on your machine

```
cd site
node serve.mjs            # http://localhost:8788 (Node 20+; no install step)
```

The keeper key for `/keeper` is generated into `site/data/keeper-key.txt` (never committed).

## Put it online

- **Cloudflare Worker**: `site/wrangler.jsonc` has the three commands at the top (KV namespace, keeper key, deploy).
- **A Pi holds the gate**: `site/pi/README.md`. Unplug the Pi and the gate closes; the pages stay up.
- **Several rooms, one scroll**: each room's Pi keeps its own chain and passes its stars up to the central scroll
  (see "Rooms" in `site/README.md`).
- **The night's group chat**: `site/bot/claim-bot.mjs` lets people paste their claim code; the bot writes the claim
  onto their chain and answers with a proverb.

## Privacy, in one paragraph

No accounts and no tracking. A visitor's mark is a hash of a secret their own phone keeps. The chain holds hashes
and boxes sealed with the visitor's own key; nothing anyone writes appears on it in the clear. Proverbs and guides
are public only once the keeper approves them. Addresses are never stored.

## Status

Built and tested locally: the guide and its paths, the evidence chain, sealing, the claim trust task (site side),
rooms feeding a central scroll, the gate. Also tested: one chain across nights (genesis, a gathering link per night, one root per person), sealed voice notes (recorded, sent, played back by the owner), claiming
after joining (claim code + DID, the DID kept only as a hash). Not yet: a live deployment, the bot run against
Telegram, the hosting agent signing the chain, DID-signed claims, and the City turning a claim into an invitation or credential.

Credits: the sigil script (`site/public/sigil/sigilcode.js`) and the 64-state geometry come from the City of Mages
scrolls (mages.city).
