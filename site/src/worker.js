// hitchhiker.mages.city: The Hitchhiker's Guide to Trust, hosted. Serves the pages (./public) and one small API.
// One Hitchhikers guide, many nights (Newspeak House, IIW 43, the Internet Archive): a single evidence chain,
// begun by the guide's genesis, where each night opens with a gathering link and presence, proverbs, guides and
// voice notes are recorded as hashes, sealed with each visitor's own key. Nobody has to join anything to be part of the night's history; a claim code (or, after
// joining a community, the code plus a DID) later shows the stars were theirs. The keeper approves proverbs and
// guides before they show. Keeper calls carry Bearer KEEPER_KEY. Storage (KV): chain:<guide>, queue, approved.
//
// Gate mode: set GATE_ORIGIN to a community node's address (a Pi running serve.mjs behind a tunnel) and every
// /api/* call is handed to that node instead. The pages stay up here; when the node is unplugged, the gate is
// closed and nothing can be submitted. Hosting the graph is what lets people in.

const LIMIT = { title: 40, text: 160, by: 40 }, PER_MINUTE = 30, QUEUE_MAX = 500, GATE_TIMEOUT_MS = 4000, CHAIN_MAX = 20000;
const VOICE_MAX_B64 = 480000, VOICES_MAX = 400; // ~45 s of opus per note, sealed; a few hundred notes per event
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET, POST, OPTIONS' };

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS } });
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const load = async (env, key) => (await env.PROVERBS.get(key, 'json')) || [];
const save = (env, key, v) => env.PROVERBS.put(key, JSON.stringify(v));

// Rate limit by a salted, daily hash of the address; the address itself is never stored. A venue's Wi-Fi puts a
// whole room behind one address, so the limit is room-sized; the approval queue is the real guard against spam.
async function limited(env, req) {
  const day = new Date().toISOString().slice(0, 10), src = req.headers.get('cf-connecting-ip') || 'unknown';
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(day + '|' + src + '|' + (env.KEEPER_KEY || '')));
  const key = 'rl:' + [...new Uint8Array(b)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join('');
  const n = parseInt(await env.PROVERBS.get(key) || '0', 10);
  if (n >= PER_MINUTE) return true;
  await env.PROVERBS.put(key, String(n + 1), { expirationTtl: 60 });
  return false;
}

function isKeeper(env, req) {
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!env.KEEPER_KEY || got.length !== env.KEEPER_KEY.length) return false;
  let d = 0; for (let i = 0; i < got.length; i++) d |= got.charCodeAt(i) ^ env.KEEPER_KEY.charCodeAt(i);
  return d === 0;
}

const shown = list => list.filter(x => !x.hidden).map(({ id, kind, title, text, by, event }) => ({ id, kind, title, text, by, event }));

// Approved guides and proverbs as Federated Wiki pages, ready for a community node's wiki to import.
function wikiPages(list, name) {
  const slug = t => t.replace(/\s/g, '-').replace(/[^A-Za-z0-9-]/g, '').toLowerCase(); // Federated Wiki's own slug rule
  const id = () => [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
  const page = (title, paras) => { const story = paras.map(text => ({ type: 'paragraph', id: id(), text })); return { slug: slug(title), page: { title, story, journal: [{ type: 'create', item: { title, story }, date: Date.now() }] } }; };
  const live = list.filter(x => !x.hidden), credit = x => x.by ? ` (${x.by})` : '';
  return [page("Don't Panic", [`Proverbs left by visitors to ${name}.`, ...live.filter(x => x.kind === 'proverb').map(x => x.text + credit(x))])]
    .concat(live.filter(x => x.kind === 'guide').map(x => page(x.title, [`A Hitchhiker guide, launched at ${name}.`, x.text + credit(x)])));
}

// ---- the nights: each event is a chapter of the one guide ----
// Override or add with EVENTS (JSON, same shape); DEFAULT_EVENT picks the night a bare address adds to. A night's
// gathering link records it as first opened, so set its details before its first visitor arrives.
const EVENTS_DEFAULT = {
  newspeak: { name: 'The Guide to Newspeak House', date: '2026-11-05', place: 'Newspeak House, London', with: 'The Hitchhikers · Field Guide · Mages City' },
  iiw43: { name: 'The Guide to IIW 43', date: '2026-11-04', place: 'Internet Identity Workshop 43', with: 'The Hitchhikers · Mages City' },
  archive: { name: 'The Guide to the Internet Archive', date: '2026-11-05', place: 'Internet Archive', with: 'The Hitchhikers' } };
const GUIDE = env => ({ id: env.GUIDE_ID || 'hitchhikers', name: env.GUIDE_NAME || "The Hitchhiker's Guide to Trust", with: 'The Hitchhikers' });
const CK = env => 'chain:' + GUIDE(env).id;
const events = env => { try { return { ...EVENTS_DEFAULT, ...JSON.parse(env.EVENTS || '{}') }; } catch (e) { return EVENTS_DEFAULT; } };
// the night a contribution belongs to: the address it came in on; otherwise tonight's (by date), preferring the default
function eventOf(env, req, body) {
  const EV = events(env), asked = new URL(req.url).searchParams.get('event') || (body && body.event);
  if (asked) { const e = String(asked).toLowerCase(); return EV[e] ? e : null; }
  const today = new Date().toISOString().slice(0, 10), on = Object.keys(EV).filter(k => EV[k].date === today), def = env.DEFAULT_EVENT || 'newspeak';
  return on.includes(def) ? def : on[0] || def;
}

// ---- the evidence chain ----
// Each link: leaf = sha256 of what was done (kind + content + time); hash = sha256(prev | leaf | mark | seq).
// Content never enters the chain in the clear: only its hash, and a box sealed with the visitor's own key. mark = sha256 of a secret the visitor's phone keeps (or '').
// Link 0 is the guide's genesis; each night begins with a gathering link (kind 'genesis' too); both in the clear.
const hex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const isMark = m => /^[0-9a-f]{64}$/.test(String(m || ''));
const isDid = d => /^did:[a-z0-9]+:[A-Za-z0-9._:%-]{3,300}$/.test(String(d || ''));
// The OpenVTC community this guide leads into (Mages City by default): its daemon's public API and join page.
const cityApi = env => (env.CITY_API || 'https://vtc.mages.city').replace(/\/$/, '');
const MANIFEST = 'https://trusttasks.org/spec/vtc/join-requests/manifest/0.3';
const isSealed = b => b && typeof b.iv === 'string' && typeof b.ct === 'string' && b.iv.length <= 24 && b.ct.length <= 2400 && /^[A-Za-z0-9+/=]+$/.test(b.iv + b.ct);
async function push(chain, kind, content, mark, extra) {
  const at = new Date().toISOString(), prev = chain.length ? chain[chain.length - 1].hash : '0'.repeat(64), seq = chain.length;
  const leaf = await hex(JSON.stringify({ kind, content, at })), m = isMark(mark) ? mark : '';
  const link = { seq, kind, at, leaf, mark: m, prev, hash: await hex([prev, leaf, m, seq].join('|')), ...(extra || {}) };
  chain.push(link); return link;
}
async function chainOf(env) {
  const chain = await load(env, CK(env)); if (chain.length) return chain;
  const genesis = GUIDE(env); await push(chain, 'genesis', genesis, '', { genesis });
  await save(env, CK(env), chain); return chain;
}
const gathered = (chain, ev) => chain.some(l => l.kind === 'genesis' && l.genesis && l.genesis.event === ev);
async function addLink(env, ev, kind, content, mark, sealed, extra) {
  const chain = await chainOf(env); if (chain.length >= CHAIN_MAX) return null;
  if (ev && !gathered(chain, ev)) { const g = { event: ev, ...events(env)[ev] }; await push(chain, 'genesis', g, '', { event: ev, genesis: g }); } // the night opens
  const link = await push(chain, kind, content, mark, { event: ev, ...(extra || {}) });
  if (isSealed(sealed)) link.sealed = { iv: sealed.iv, ct: sealed.ct }; // only its owner's key opens it
  await save(env, CK(env), chain);
  if (env.SCROLL_ORIGIN && env.ROOM_NAME && env.ROOM_KEY && !link.room) { // a room node: pass the star up to the scroll
    const up = fetch(env.SCROLL_ORIGIN.replace(/\/$/, '') + '/api/room/link', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.ROOM_KEY },
      body: JSON.stringify({ room: env.ROOM_NAME, event: ev, kind, ref: link.hash, mark: m }) }).catch(() => {});
    if (env.waitUntil) env.waitUntil(up);
  }
  return link;
}
const roomKeys = env => { try { return JSON.parse(env.ROOM_KEYS || '{}'); } catch (e) { return {}; } };
function roomOf(env, req, room) { const k = roomKeys(env)[room], got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!k || got.length !== k.length) return false; let d = 0; for (let i = 0; i < got.length; i++) d |= got.charCodeAt(i) ^ k.charCodeAt(i); return d === 0; }
const words4 = t => String(t || '').toLowerCase().normalize('NFKC').replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(Boolean);
// find whose thumb up a claim code belongs to: any four words in a row whose hash matches a committed claim
async function findClaim(chain, text) {
  const words = words4(text), byClaim = new Map(chain.filter(l => l.kind === 'thumb' && l.claim).map(l => [l.claim, l]));
  for (let i = 0; i + 4 <= words.length; i++) { const c = await hex('claimcode|' + words.slice(i, i + 4).join(' ')); if (byClaim.has(c)) return byClaim.get(c); }
  return null;
}
const DEFAULT_PROVERBS = ["Don't panic: every task you share builds trust.", 'A towel and a runbook: never travel without both.', "Don't panic; check the checksum."];
const aProverb = approved => { const pool = approved.filter(x => x.kind === 'proverb' && !x.hidden).map(x => x.text), p = pool.length ? pool : DEFAULT_PROVERBS; return p[Math.floor(Math.random() * p.length)]; };

// Hand an /api/* call to the community node. Unreachable node = closed gate.
async function viaGate(req, env, path) {
  try {
    const u = new URL(req.url), target = env.GATE_ORIGIN.replace(/\/$/, '') + path + u.search;
    const headers = new Headers(req.headers); headers.set('cf-connecting-ip', req.headers.get('cf-connecting-ip') || '');
    const r = await fetch(target, { method: req.method, headers, body: req.method === 'POST' ? await req.text() : undefined, signal: AbortSignal.timeout(GATE_TIMEOUT_MS) });
    if (r.status >= 502) throw new Error('node down');
    const out = new Response(r.body, r); Object.entries(CORS).forEach(([k, v]) => out.headers.set(k, v)); return out;
  } catch (e) { return json({ gate: 'closed', error: 'The gate is closed: the community node is offline.' }, 503); }
}

async function api(req, env, path, body) {
  if (path === '/api/gate') return json({ gate: 'open', host: env.NODE_NAME || 'worker' });
  const url = new URL(req.url), ev = eventOf(env, req, body), EV = events(env);

  // the events: each one's name, date, place, and how far its chain has grown
  if (path === '/api/events' && req.method === 'GET') {
    const c = await load(env, CK(env)), out = Object.keys(EV).map(id => ({ id, ...EV[id], stars: c.filter(l => l.event === id && l.kind !== 'genesis').length, opened: (c.find(l => l.kind === 'genesis' && l.genesis && l.genesis.event === id) || {}).hash || null }));
    return json({ guide: GUIDE(env), default: env.DEFAULT_EVENT || 'newspeak', stars: c.filter(l => l.kind !== 'genesis').length, events: out });
  }

  // ---- rooms: each room's Pi passes its stars up to this scroll, and says it is alive ----
  if (path === '/api/room/link' && req.method === 'POST') {
    const room = clean(body.room, 40); if (!roomOf(env, req, room)) return json({ error: 'Room key needed.' }, 401);
    if (!ev) return json({ error: 'Unknown guide.' }, 400);
    if (!/^[0-9a-f]{64}$/.test(String(body.ref || ''))) return json({ error: 'Send the room link hash.' }, 400);
    const link = await addLink(env, ev, clean(body.kind, 20) || 'thumb', { room, ref: body.ref }, body.mark, null, { room, ref: body.ref });
    if (!link) return json({ error: 'The scroll is full.' }, 503);
    const rooms = (await env.PROVERBS.get('rooms', 'json')) || {}; rooms[room] = { ...(rooms[room] || {}), last: Date.now(), count: ((rooms[room] || {}).count || 0) + 1 }; await env.PROVERBS.put('rooms', JSON.stringify(rooms));
    return json({ ok: true, seq: link.seq, hash: link.hash });
  }
  if (path === '/api/room/beat' && req.method === 'POST') {
    const room = clean(body.room, 40); if (!roomOf(env, req, room)) return json({ error: 'Room key needed.' }, 401);
    const rooms = (await env.PROVERBS.get('rooms', 'json')) || {}; rooms[room] = { ...(rooms[room] || { count: 0 }), last: Date.now(), host: clean(body.host, 40) }; await env.PROVERBS.put('rooms', JSON.stringify(rooms));
    return json({ ok: true });
  }
  if (path === '/api/rooms' && req.method === 'GET') {
    const rooms = (await env.PROVERBS.get('rooms', 'json')) || {}, now = Date.now();
    return json(Object.keys(roomKeys(env)).concat(Object.keys(rooms)).filter((r, i, a) => a.indexOf(r) === i).map(r => ({ room: r, count: (rooms[r] || {}).count || 0, open: !!rooms[r] && now - rooms[r].last < 90000 })));
  }

  // the community to join: its DID, its QR, and the ways in, read live from its own join manifest
  if (path === '/api/city' && req.method === 'GET') {
    const base = cityApi(env), H = { accept: 'application/json', 'user-agent': 'hitchhikers-guide-to-trust' };
    try {
      const prof = await (await fetch(base + '/v1/community/public-profile', { headers: H })).json();
      const task = { id: 'urn:uuid:' + crypto.randomUUID(), type: MANIFEST, issuedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), recipient: prof.communityDid, payload: {} };
      const man = await (await fetch(base + '/v1/trust-tasks', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify(task) })).json();
      return json({ name: prof.name, did: prof.communityDid, publicUrl: prof.publicUrl, joinUrl: env.CITY_JOIN || 'https://join.mages.city/', qr: base + '/v1/community/did-qr.svg',
        criteria: ((man.payload || {}).criteria || []).map(c => ({ id: c.id, description: c.description, admission: c.admission })) });
    } catch (e) { return json({ error: 'The community is not answering right now.' }, 502); }
  }

  if (!ev) return json({ error: 'Unknown guide.' }, 400);
  const Q = 'queue', A = 'approved';
  if (path === '/api/approved' && req.method === 'GET') { const only = url.searchParams.get('only'); return json(shown((await load(env, A)).filter(x => !only || x.event === only))); }

  // one person's evidence: their stars (same mark) in order, chained into a root anyone can recompute
  if (path === '/api/evidence' && req.method === 'GET') {
    const mark = url.searchParams.get('mark'); if (!isMark(mark)) return json({ error: 'Give a mark.' }, 400);
    const chain = await chainOf(env), mine = chain.filter(l => l.mark === mark);
    let root = '0'.repeat(64); for (const l of mine) root = await hex(root + '|' + l.hash);
    return json({ guide: GUIDE(env).name, nights: [...new Set(mine.map(l => l.event).filter(Boolean))].map(e => (EV[e] || {}).name || e), mark, stars: mine.length, root, rule: 'root = sha256(root + "|" + hash), from 64 zeros, over these links in order',
      links: mine.map(l => ({ seq: l.seq, kind: l.kind, at: l.at, hash: l.hash, event: l.event, room: l.room, did: l.did })), genesis: chain[0].hash, chainLength: chain.length, chainHead: chain[chain.length - 1].hash });
  }

  if (path === '/api/chain' && req.method === 'GET') {
    const chain = await chainOf(env), since = Math.max(0, parseInt(url.searchParams.get('since') || '0', 10) || 0);
    return json({ event: ev, tonight: EV[ev], guide: GUIDE(env), nights: EV, genesis: chain[0], length: chain.length, head: chain[chain.length - 1].hash, links: chain.slice(since, since + 500) });
  }

  // a thumb up: the first trust task. Joins the chain with nothing but your mark.
  if (path === '/api/thumb' && req.method === 'POST') {
    if (!isMark(body.mark)) return json({ error: 'Open the page again to make your mark.' }, 400);
    if (await limited(env, req)) return json({ error: 'Slow down a moment, then try again.' }, 429);
    const claim = /^[0-9a-f]{64}$/.test(String(body.claim || '')) ? body.claim : null;
    const link = await addLink(env, ev, 'thumb', body.mark, body.mark, body.sealed, claim ? { claim } : null);
    return link ? json({ ok: true, link }) : json({ error: 'The chain is full tonight.' }, 503);
  }

  if (path === '/api/submit' && req.method === 'POST') {
    const kind = body.kind === 'guide' ? 'guide' : 'proverb';
    const title = clean(body.title, LIMIT.title), text = clean(body.text, LIMIT.text), by = clean(body.by, LIMIT.by);
    if (kind === 'guide' && title.length < 3) return json({ error: 'Give your guide a name.' }, 400);
    if (text.length < 3) return json({ error: kind === 'guide' ? 'Write its first line.' : 'Write a proverb first.' }, 400);
    if (await limited(env, req)) return json({ error: 'Slow down a moment, then try again.' }, 429);
    const queue = await load(env, Q);
    if (queue.length >= QUEUE_MAX) return json({ error: 'The keeper is catching up. Try again later.' }, 503);
    queue.push({ id: Date.now() * 100 + Math.floor(Math.random() * 100), kind, title: kind === 'guide' ? title : '', text, by, event: ev, at: new Date().toISOString() });
    await save(env, Q, queue);
    const link = await addLink(env, ev, kind, { title, text, by }, body.mark, body.sealed);
    return json({ ok: true, held: true, link });
  }

  // a voice note: recorded and sealed on the phone; stored here only as the sealed box, under its own hash.
  // Its star records that hash, so the note can't be swapped later; only its owner's key plays it.
  if (path === '/api/voice' && req.method === 'POST') {
    if (!isMark(body.mark)) return json({ error: 'Open the page again to make your mark.' }, 400);
    const iv = String(body.iv || ''), ct = String(body.ct || ''), secs = Math.max(0, Math.min(60, Math.round(+body.secs || 0)));
    if (iv.length > 24 || !ct || ct.length > VOICE_MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(iv + ct)) return json({ error: 'That note is too long (about 45 seconds at most).' }, 400);
    if (await limited(env, req)) return json({ error: 'Slow down a moment, then try again.' }, 429);
    const n = parseInt(await env.PROVERBS.get('voices:' + ev) || '0', 10); if (n >= VOICES_MAX) return json({ error: 'The guide has all the voice notes it can hold tonight.' }, 503);
    const id = await hex('voice|' + iv + '|' + ct);
    await env.PROVERBS.put('voice:' + id, JSON.stringify({ iv, ct })); await env.PROVERBS.put('voices:' + ev, String(n + 1));
    const link = await addLink(env, ev, 'voice', id, body.mark, null, { voice: id, secs });
    return link ? json({ ok: true, link }) : json({ error: 'The chain is full tonight.' }, 503);
  }
  if (path === '/api/voice' && req.method === 'GET') {
    const id = url.searchParams.get('id'); if (!/^[0-9a-f]{64}$/.test(String(id || ''))) return json({ error: 'Give a voice id.' }, 400);
    const box = await env.PROVERBS.get('voice:' + id, 'json'); return box ? json(box) : json({ error: 'Not found.' }, 404);
  }

  // claiming after joining: your claim code (only you were shown it) and the DID you joined with. The claim link
  // records the DID only as a hash, so it can later be matched by the community you joined, not read by anyone.
  if (path === '/api/claim' && req.method === 'POST') {
    const did = String(body.did || '').trim(); if (!isDid(did)) return json({ error: 'Paste the DID you joined with (it starts with did:).' }, 400);
    if (await limited(env, req)) return json({ error: 'Slow down a moment, then try again.' }, 429);
    const chain = await chainOf(env), hit = await findClaim(chain, body.code);
    if (!hit) return json({ error: 'That claim code is not on this guide.' }, 404);
    const didHash = await hex('did|' + did), proverb = aProverb(await load(env, A));
    const done = chain.find(l => l.kind === 'claim' && l.mark === hit.mark && l.did);
    if (done) return json({ ok: true, already: true, seq: done.seq, same: done.did === didHash, proverb });
    const link = await addLink(env, ev, 'claim', didHash, hit.mark, null, { did: didHash });
    return link ? json({ ok: true, seq: link.seq, hash: link.hash, mark: hit.mark, proverb }) : json({ error: 'The chain is full.' }, 503);
  }

  if (path.startsWith('/api/keeper/')) {
    if (!isKeeper(env, req)) return json({ error: 'Keeper key needed.' }, 401);
    const queue = await load(env, Q), approved = await load(env, A);
    const action = path.slice('/api/keeper/'.length), id = Number(body.id);
    if (action === 'state') return json({ guide: GUIDE(env).name, nights: Object.fromEntries(Object.entries(EV).map(([k, v]) => [k, v.name])), queue, approved, host: env.NODE_NAME || 'worker' });
    if (action === 'export') return json(wikiPages(approved, GUIDE(env).name));
    // the invitation trust task: the group chat's bot sends a message; if it holds someone's claim code, their claim
    // is written onto the guide (the chat handle only as a salted hash), on the night of their thumb up, and a proverb comes back
    if (action === 'claim') {
      const chain = await chainOf(env), hit = await findClaim(chain, body.text); if (!hit) return json({ error: 'No claim code in that message.' }, 404);
      const proverb = aProverb(approved), done = chain.find(l => l.kind === 'claim' && l.mark === hit.mark && !l.did);
      if (done) return json({ ok: true, already: true, event: done.event, seq: done.seq, mark: hit.mark, proverb });
      const link = await addLink(env, hit.event || ev, 'claim', await hex('who|' + (env.KEEPER_KEY || '') + '|' + clean(body.who, 120)), hit.mark);
      return link ? json({ ok: true, event: link.event, seq: link.seq, mark: hit.mark, hash: link.hash, proverb }) : json({ error: 'The chain is full.' }, 503);
    }
    // the Pi's chat agent commits a chat contribution: it sends only a digest (and the member's mark, if known)
    if (action === 'commit') {
      const digest = String(body.digest || ''); if (!/^[0-9a-f]{64}$/.test(digest)) return json({ error: 'Send a sha256 digest.' }, 400);
      const link = await addLink(env, ev, clean(body.kind, 20) || 'chat', digest, body.mark);
      return link ? json({ ok: true, link }) : json({ error: 'The chain is full.' }, 503);
    }
    if (action === 'approve') {
      const i = queue.findIndex(x => x.id === id); if (i < 0) return json({ error: 'Not in the queue.' }, 404);
      const [x] = queue.splice(i, 1);
      if (body.text) x.text = clean(body.text, LIMIT.text); if (body.title && x.kind === 'guide') x.title = clean(body.title, LIMIT.title);
      approved.push(x); await save(env, A, approved); await save(env, Q, queue);
      return json({ ok: true });
    }
    if (action === 'reject') { await save(env, Q, queue.filter(x => x.id !== id)); return json({ ok: true }); }
    if (action === 'hide' || action === 'show') {
      const x = approved.find(y => y.id === id); if (!x) return json({ error: 'Not found.' }, 404);
      x.hidden = action === 'hide'; await save(env, A, approved); return json({ ok: true });
    }
    return json({ error: 'Unknown action.' }, 404);
  }
  return json({ error: 'Not found.' }, 404);
}

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url), path = u.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    // short addresses for each night: /newspeak → that guide's home
    const short = path.replace(/^\/|\/$/g, '').toLowerCase();
    if (short && !short.includes('/') && events(env)[short]) return Response.redirect(u.origin + '/?event=' + short, 302);
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (env.GATE_ORIGIN) return viaGate(req, env, path);
    if (ctx && ctx.waitUntil && !env.waitUntil) env = { ...env, waitUntil: p => ctx.waitUntil(p) };
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    return api(req, env, path, body);
  }
};
