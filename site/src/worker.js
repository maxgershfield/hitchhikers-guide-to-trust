// dontpanic.mages.city: The Hitchhiker's Guide to Trust, hosted. Serves the pages (./public) and one small API:
// visitors leave a "Don't Panic" proverb or launch a guide at the end of a presentation; the keeper approves
// each one before it appears. Keeper calls carry Bearer KEEPER_KEY. Storage: KV keys "queue" and "approved".
//
// Gate mode: set GATE_ORIGIN to a community node's address (a Pi running serve.mjs behind a tunnel) and every
// /api/* call is handed to that node instead. The pages stay up here; when the node is unplugged, the gate is
// closed and nothing can be submitted. Hosting the graph is what lets people in.

const LIMIT = { title: 40, text: 160, by: 40 }, PER_MINUTE = 30, QUEUE_MAX = 500, GATE_TIMEOUT_MS = 4000, CHAIN_MAX = 20000;
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

const shown = list => list.filter(x => !x.hidden).map(({ id, kind, title, text, by }) => ({ id, kind, title, text, by }));

// Approved guides and proverbs as Federated Wiki pages, ready for a community node's wiki to import.
function wikiPages(list) {
  const slug = t => t.replace(/\s/g, '-').replace(/[^A-Za-z0-9-]/g, '').toLowerCase(); // Federated Wiki's own slug rule
  const id = () => [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
  const page = (title, paras) => { const story = paras.map(text => ({ type: 'paragraph', id: id(), text })); return { slug: slug(title), page: { title, story, journal: [{ type: 'create', item: { title, story }, date: Date.now() }] } }; };
  const live = list.filter(x => !x.hidden), credit = x => x.by ? ` (${x.by})` : '';
  return [page("Don't Panic", ["Proverbs left by visitors to The Hitchhiker's Guide to Trust.", ...live.filter(x => x.kind === 'proverb').map(x => x.text + credit(x))])]
    .concat(live.filter(x => x.kind === 'guide').map(x => page(x.title, ["A Hitchhiker guide, launched at The Hitchhiker's Guide to Trust.", x.text + credit(x)])));
}

// ---- the evidence chain ----
// Each link: leaf = sha256 of what was done (kind + content + time); hash = sha256(prev | leaf | mark | seq).
// Content never enters the chain in the clear: only its hash, and a box sealed with the visitor's own key. mark = sha256 of a secret the visitor's phone keeps (or '').
const hex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const isMark = m => /^[0-9a-f]{64}$/.test(String(m || ''));
const isSealed = b => b && typeof b.iv === 'string' && typeof b.ct === 'string' && b.iv.length <= 24 && b.ct.length <= 2400 && /^[A-Za-z0-9+/=]+$/.test(b.iv + b.ct);
async function addLink(env, kind, content, mark, sealed, claim) {
  const chain = await load(env, 'chain'); if (chain.length >= CHAIN_MAX) return null;
  const at = new Date().toISOString(), prev = chain.length ? chain[chain.length - 1].hash : '0'.repeat(64), seq = chain.length;
  const leaf = await hex(JSON.stringify({ kind, content, at })), m = isMark(mark) ? mark : '';
  const link = { seq, kind, at, leaf, mark: m, prev, hash: await hex([prev, leaf, m, seq].join('|')) };
  if (isSealed(sealed)) link.sealed = { iv: sealed.iv, ct: sealed.ct }; // only its owner's key opens it
  if (claim) link.claim = claim; // the hash of a claim code only the owner was shown
  chain.push(link); await save(env, 'chain', chain);
  if (env.SCROLL_ORIGIN && env.ROOM_NAME && env.ROOM_KEY && kind !== 'room') { // a room node: pass the star up to the scroll
    const up = fetch(env.SCROLL_ORIGIN.replace(/\/$/, '') + '/api/room/link', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.ROOM_KEY },
      body: JSON.stringify({ room: env.ROOM_NAME, kind, ref: link.hash, mark: m }) }).catch(() => {});
    if (env.waitUntil) env.waitUntil(up);
  }
  return link;
}
const roomKeys = env => { try { return JSON.parse(env.ROOM_KEYS || '{}'); } catch (e) { return {}; } };
function roomOf(env, req, room) { const k = roomKeys(env)[room], got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!k || got.length !== k.length) return false; let d = 0; for (let i = 0; i < got.length; i++) d |= got.charCodeAt(i) ^ k.charCodeAt(i); return d === 0; }

// Hand an /api/* call to the community node. Unreachable node = closed gate.
async function viaGate(req, env, path) {
  try {
    const target = env.GATE_ORIGIN.replace(/\/$/, '') + path;
    const headers = new Headers(req.headers); headers.set('cf-connecting-ip', req.headers.get('cf-connecting-ip') || '');
    const r = await fetch(target, { method: req.method, headers, body: req.method === 'POST' ? await req.text() : undefined, signal: AbortSignal.timeout(GATE_TIMEOUT_MS) });
    if (r.status >= 502) throw new Error('node down');
    const out = new Response(r.body, r); Object.entries(CORS).forEach(([k, v]) => out.headers.set(k, v)); return out;
  } catch (e) { return json({ gate: 'closed', error: 'The gate is closed: the community node is offline.' }, 503); }
}

async function api(req, env, path, body) {
  if (path === '/api/gate') return json({ gate: 'open', host: env.NODE_NAME || 'worker' });

  // ---- rooms: each room's Pi passes its stars up to this scroll, and says it is alive ----
  if (path === '/api/room/link' && req.method === 'POST') {
    const room = clean(body.room, 40); if (!roomOf(env, req, room)) return json({ error: 'Room key needed.' }, 401);
    if (!/^[0-9a-f]{64}$/.test(String(body.ref || ''))) return json({ error: 'Send the room link hash.' }, 400);
    const link = await addLink(env, clean(body.kind, 20) || 'thumb', { room, ref: body.ref }, body.mark);
    if (!link) return json({ error: 'The scroll is full.' }, 503);
    const chain = await load(env, 'chain'); chain[link.seq].room = room; chain[link.seq].ref = body.ref; await save(env, 'chain', chain);
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
  if (path === '/api/approved' && req.method === 'GET') return json(shown(await load(env, 'approved')));

  if (path === '/api/chain' && req.method === 'GET') {
    const chain = await load(env, 'chain'), since = Math.max(0, parseInt(new URL(req.url).searchParams.get('since') || '0', 10) || 0);
    return json({ length: chain.length, head: chain.length ? chain[chain.length - 1].hash : null, links: chain.slice(since, since + 500) });
  }

  // a thumb up: the first trust task. Joins the chain with nothing but your mark.
  if (path === '/api/thumb' && req.method === 'POST') {
    if (!isMark(body.mark)) return json({ error: 'Open the page again to make your mark.' }, 400);
    if (await limited(env, req)) return json({ error: 'Slow down a moment, then try again.' }, 429);
    const link = await addLink(env, 'thumb', body.mark, body.mark, body.sealed, /^[0-9a-f]{64}$/.test(String(body.claim || '')) ? body.claim : null);
    return link ? json({ ok: true, link }) : json({ error: 'The chain is full tonight.' }, 503);
  }

  if (path === '/api/submit' && req.method === 'POST') {
    const kind = body.kind === 'guide' ? 'guide' : 'proverb';
    const title = clean(body.title, LIMIT.title), text = clean(body.text, LIMIT.text), by = clean(body.by, LIMIT.by);
    if (kind === 'guide' && title.length < 3) return json({ error: 'Give your guide a name.' }, 400);
    if (text.length < 3) return json({ error: kind === 'guide' ? 'Write its first line.' : 'Write a proverb first.' }, 400);
    if (await limited(env, req)) return json({ error: 'Slow down a moment, then try again.' }, 429);
    const queue = await load(env, 'queue');
    if (queue.length >= QUEUE_MAX) return json({ error: 'The keeper is catching up. Try again later.' }, 503);
    queue.push({ id: Date.now() * 100 + Math.floor(Math.random() * 100), kind, title: kind === 'guide' ? title : '', text, by, at: new Date().toISOString() });
    await save(env, 'queue', queue);
    const link = await addLink(env, kind, { title, text, by }, body.mark, body.sealed);
    return json({ ok: true, held: true, link });
  }

  if (path.startsWith('/api/keeper/')) {
    if (!isKeeper(env, req)) return json({ error: 'Keeper key needed.' }, 401);
    const queue = await load(env, 'queue'), approved = await load(env, 'approved');
    const action = path.slice('/api/keeper/'.length), id = Number(body.id);
    if (action === 'state') return json({ queue, approved, host: env.NODE_NAME || 'worker' });
    if (action === 'export') return json(wikiPages(approved));
    // the invitation trust task: the group chat's bot sends a message; if it holds someone's claim code, their
    // claim is written onto their chain (the chat handle only as a salted hash) and a proverb comes back
    if (action === 'claim') {
      const words = String(body.text || '').toLowerCase().normalize('NFKC').replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(Boolean);
      const chain = await load(env, 'chain'), byClaim = new Map(chain.filter(l => l.kind === 'thumb' && l.claim).map(l => [l.claim, l]));
      let hit = null; for (let i = 0; i + 4 <= words.length && !hit; i++) { const c = await hex('claimcode|' + words.slice(i, i + 4).join(' ')); if (byClaim.has(c)) hit = byClaim.get(c); }
      if (!hit) return json({ error: 'No claim code in that message.' }, 404);
      const done = chain.find(l => l.kind === 'claim' && l.mark === hit.mark);
      const pool = approved.filter(x => x.kind === 'proverb' && !x.hidden).map(x => x.text), proverb = pool.length ? pool[Math.floor(Math.random() * pool.length)] : ["Don't panic: you own your own perspective in the trust graph.", 'A towel and a runbook: never travel without both.', "Don't panic; check the checksum."][Math.floor(Math.random() * 3)];
      if (done) return json({ ok: true, already: true, seq: done.seq, mark: hit.mark, proverb });
      const link = await addLink(env, 'claim', await hex('who|' + (env.KEEPER_KEY || '') + '|' + clean(body.who, 120)), hit.mark);
      return link ? json({ ok: true, seq: link.seq, mark: hit.mark, hash: link.hash, proverb }) : json({ error: 'The chain is full.' }, 503);
    }
    // the Pi's chat agent commits a chat contribution: it sends only a digest (and the member's mark, if known)
    if (action === 'commit') {
      const digest = String(body.digest || ''); if (!/^[0-9a-f]{64}$/.test(digest)) return json({ error: 'Send a sha256 digest.' }, 400);
      const link = await addLink(env, clean(body.kind, 20) || 'chat', digest, body.mark);
      return link ? json({ ok: true, link }) : json({ error: 'The chain is full.' }, 503);
    }
    if (action === 'approve') {
      const i = queue.findIndex(x => x.id === id); if (i < 0) return json({ error: 'Not in the queue.' }, 404);
      const [x] = queue.splice(i, 1);
      if (body.text) x.text = clean(body.text, LIMIT.text); if (body.title && x.kind === 'guide') x.title = clean(body.title, LIMIT.title);
      approved.push(x); await save(env, 'approved', approved); await save(env, 'queue', queue);
      return json({ ok: true });
    }
    if (action === 'reject') { await save(env, 'queue', queue.filter(x => x.id !== id)); return json({ ok: true }); }
    if (action === 'hide' || action === 'show') {
      const x = approved.find(y => y.id === id); if (!x) return json({ error: 'Not found.' }, 404);
      x.hidden = action === 'hide'; await save(env, 'approved', approved); return json({ ok: true });
    }
    return json({ error: 'Unknown action.' }, 404);
  }
  return json({ error: 'Not found.' }, 404);
}

export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (env.GATE_ORIGIN) return viaGate(req, env, path);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    return api(req, env, path, body);
  }
};
