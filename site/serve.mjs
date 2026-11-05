// Run dontpanic on a community node (a Pi) or for a local preview: runs src/worker.js on http://127.0.0.1:8788 with ./public, and keeps the
// proverbs in data/store.json so a restart loses nothing. It listens on this machine only; a tunnel
// (Cloudflare Tunnel or Tailscale Funnel) is what lets people online reach it. Run: node serve.mjs
// The keeper key comes from KEEPER_KEY, or is generated once into data/keeper-key.txt.
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import worker from './src/worker.js';

// HOST: this machine only by default; set it (e.g. a tailnet address) when the proxy runs on another machine.
const PORT = +(process.env.PORT || 8788), HOST = process.env.HOST || '127.0.0.1';
// DATA=<folder> PORT=<port> runs a second, separate room (e.g. one per hostname) from the same pages.
const dir = new URL('./public/', import.meta.url), data = process.env.DATA ? pathToFileURL(process.env.DATA.replace(/[\/]?$/, '/')) : new URL('./data/', import.meta.url);
await mkdir(data, { recursive: true });
const storeFile = new URL('store.json', data), keyFile = new URL('keeper-key.txt', data);

let KEEPER_KEY = process.env.KEEPER_KEY;
if (!KEEPER_KEY) {
  if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(18).toString('base64url') + '\n');
  KEEPER_KEY = readFileSync(keyFile, 'utf8').trim();
}

// KV stand-in: rate-limit counters live in memory only; everything else is written to data/store.json.
const mem = new Map(Object.entries(existsSync(storeFile) ? JSON.parse(readFileSync(storeFile, 'utf8')) : {}));
let saving = Promise.resolve();
const persist = () => { saving = saving.then(() => writeFile(storeFile, JSON.stringify(Object.fromEntries([...mem].filter(([k]) => !k.startsWith('rl:'))), null, 1))); };
const PROVERBS = {
  async get(k, type) { const v = mem.get(k); if (v == null) return null; return type === 'json' ? JSON.parse(v) : v; },
  async put(k, v, opts) { mem.set(k, v); if (opts?.expirationTtl) setTimeout(() => mem.delete(k), opts.expirationTtl * 1000).unref(); else persist(); }
};
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml' };
const ASSETS = { async fetch(req) {
  const raw = decodeURIComponent(new URL(req.url).pathname);
  if (raw.includes('..')) return new Response('Not found', { status: 404 });
  // /talk/ → talk/index.html, /keeper → keeper.html, /talk → redirect to /talk/ (so relative links resolve)
  const tries = raw.endsWith('/') ? [raw + 'index.html'] : /\.\w+$/.test(raw) ? [raw] : [raw + '.html'];
  // no-cache on pages and scripts: a tunnel's cache would otherwise keep the old script for hours after an update
  for (const p of tries) {
    try { return new Response(await readFile(new URL('.' + p, dir)), { headers: { 'content-type': TYPES[p.split('.').pop()] || 'application/octet-stream', ...(/\.(js|css|html)$/.test(p) ? { 'cache-control': 'no-cache' } : {}) } }); } catch (e) {}
  }
  if (!raw.endsWith('/') && !/\.\w+$/.test(raw) && existsSync(new URL('.' + raw + '/index.html', dir))) return new Response(null, { status: 301, headers: { location: raw + '/' + new URL(req.url).search } });
  return new Response('Not found', { status: 404 });
} };
// NODE_NAME labels where the gate is held (shown on the end prompt), e.g. NODE_NAME="Mitch's Pi".
const env = { PROVERBS, ASSETS, KEEPER_KEY, NODE_NAME: process.env.NODE_NAME || 'this node',
  // a room node (one of several Pis feeding one scroll): SCROLL_ORIGIN, ROOM_NAME, ROOM_KEY. The central scroll: ROOM_KEYS.
  SCROLL_ORIGIN: process.env.SCROLL_ORIGIN, ROOM_NAME: process.env.ROOM_NAME, ROOM_KEY: process.env.ROOM_KEY, ROOM_KEYS: process.env.ROOM_KEYS,
  // which guides (events) this node keeps, and the community it leads into
  EVENTS: process.env.EVENTS, DEFAULT_EVENT: process.env.DEFAULT_EVENT, CITY_API: process.env.CITY_API, CITY_JOIN: process.env.CITY_JOIN };
if (env.SCROLL_ORIGIN && env.ROOM_NAME && env.ROOM_KEY) {
  const beat = () => fetch(env.SCROLL_ORIGIN.replace(/\/$/, '') + '/api/room/beat', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.ROOM_KEY }, body: JSON.stringify({ room: env.ROOM_NAME, host: env.NODE_NAME }) }).catch(() => {});
  beat(); setInterval(beat, 30000).unref();
}

// One API call at a time. The worker reads the chain, adds to it and saves it back, with awaits between, so two calls
// at the same instant would read the same chain and the second save would erase the first one's star.
// /api/city is left out: it waits on another server, and only reads.
let turn = Promise.resolve();
const inTurn = fn => { const run = turn.then(fn); turn = run.catch(() => {}); return run; };

http.createServer(async (req, res) => {
  try {
    const chunks = []; for await (const c of req) chunks.push(c);
    // Behind a tunnel the visitor's address arrives in a header; locally it is the socket.
    const ip = req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
    const request = new Request('http://' + (req.headers.host || HOST) + req.url, { method: req.method, headers: { ...req.headers, 'cf-connecting-ip': ip }, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const queued = req.url.startsWith('/api/') && !req.url.startsWith('/api/city');
    const r = await (queued ? inTurn(() => worker.fetch(request, env)) : worker.fetch(request, env));
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { res.writeHead(500); res.end('error'); }
}).listen(PORT, HOST, () => {
  console.log(`Don't Panic is up on http://${HOST}:${PORT}` + (HOST === '127.0.0.1' ? '  (this machine only)' : ''));
  console.log(`Keeper page: http://localhost:${PORT}/keeper   key: ${process.env.KEEPER_KEY ? '(from KEEPER_KEY)' : 'see data/keeper-key.txt'}`);
  console.log(`Proverbs are saved in data/store.json. Open a tunnel to let people online reach it (see README).`);
});
