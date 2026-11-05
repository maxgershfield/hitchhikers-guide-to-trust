// ChatHackers → Ceremony listener. Ingests consented text from chat, holds it for admin approval,
// then writes an approved contribution onto the Guide's evidence chain (keeper /api/keeper/ceremony).
//
//   CHATHACKERS_WEBHOOK_SECRET=... TRUST_ADMIN_KEY=... \
//   TRUST_SITE=http://127.0.0.1:8788 KEEPER_KEY=... \
//   node server.mjs
//
// TRUST_SITE + KEEPER_KEY are required for approve to land a star. Without them, approve stays local only.

import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const PORT = Number(process.env.PORT || 8799);
const HOST = process.env.HOST || '127.0.0.1';
const SECRET = process.env.CHATHACKERS_WEBHOOK_SECRET;
const ADMIN = process.env.TRUST_ADMIN_KEY;
const TRUST_SITE = (process.env.TRUST_SITE || '').replace(/\/$/, '');
const KEEPER_KEY = process.env.KEEPER_KEY || '';
const FILE = process.env.CONTRIBUTIONS_FILE || path.resolve('data/chathackers-contributions.json');
const NIGHTS = new Set(['newspeak', 'iiw43', 'archive']);
const CHANNELS = new Set(['whatsapp', 'signal', 'test']);

if (!SECRET || !ADMIN) {
  console.error('Set CHATHACKERS_WEBHOOK_SECRET and TRUST_ADMIN_KEY');
  process.exit(1);
}

fs.mkdirSync(path.dirname(FILE), { recursive: true });
let records = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : [];
const listeners = new Set();
const maxBody = 65536;

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}
function tokenEqual(a, b) {
  const x = Buffer.from(a || ''), y = Buffer.from(b || '');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function auth(req, token) {
  return tokenEqual((req.headers.authorization || '').replace(/^Bearer\s+/i, ''), token);
}
function persist() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}
function publicRecord(r) {
  return {
    id: r.id, eventId: r.eventId, transcript: r.transcript, displayName: r.displayName,
    channel: r.channel, createdAt: r.createdAt, type: r.type || 'text', status: r.status,
    seq: r.seq, hash: r.hash
  };
}
function broadcast(r) {
  const data = `id: ${r.id}\nevent: star\ndata: ${JSON.stringify(publicRecord(r))}\n\n`;
  for (const res of listeners) {
    try { res.write(data); } catch { listeners.delete(res); }
  }
}
async function body(req) {
  let chunks = [], size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > maxBody) throw Error('Payload too large');
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function writeChain(r) {
  if (!TRUST_SITE || !KEEPER_KEY) {
    return { skipped: true, reason: 'Set TRUST_SITE and KEEPER_KEY to write the Guide chain.' };
  }
  const res = await fetch(TRUST_SITE + '/api/keeper/ceremony', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEEPER_KEY },
    body: JSON.stringify({
      event: r.eventId,
      text: r.transcript,
      by: r.displayName,
      sourceId: r.sourceId,
      channel: r.channel
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('Chain write failed (' + res.status + ')'));
  return data;
}

const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>ChatHackers Ceremony Listener</title>
<style>body{background:#080e22;color:#e8efff;font:16px system-ui;max-width:850px;margin:40px auto;padding:20px}button,input,textarea,select{padding:10px;margin:5px;background:#172744;color:white;border:1px solid #5878ad;border-radius:6px}textarea{width:90%;height:85px}.star{padding:16px;margin:12px 0;background:#12213b;border-radius:12px;border-left:3px solid #b4d0ff}small{color:#a9c4e7}</style></head><body>
<h1>✦ Ceremony Listener</h1>
<p>Text pledges from ChatHackers. Approve writes a star on the Guide chain when TRUST_SITE is set.</p>
<input id="secret" type="password" placeholder="Webhook secret">
<input id="admin" type="password" placeholder="Admin key">
<p><select id="event"><option value="newspeak">newspeak</option><option value="iiw43">iiw43</option><option value="archive">archive</option></select></p>
<p><textarea id="transcript" placeholder="I will show up for two hours at the terrace desk tonight."></textarea></p>
<button id="submit">Send test contribution</button>
<button id="refresh">Load pending (admin)</button>
<p id="status"></p>
<h2>Approved stars</h2><div id="stars"></div>
<h2>Pending review</h2><div id="pending"></div>
<script>
const $=id=>document.getElementById(id);const root=location.pathname.replace(/\\/$/,'');const api=p=>root+p;
function el(tag,text){const n=document.createElement(tag);n.textContent=text;return n;}
function show(r){if(document.getElementById('star-'+r.id))return;const d=el('div','');d.id='star-'+r.id;d.className='star';
  d.append(el('strong','✦ '+r.transcript),el('p',r.displayName+' · '+r.channel+' · '+r.eventId+(r.seq!=null?' · chain #'+r.seq:'')));$('stars').prepend(d);}
async function approved(){const r=await fetch(api('/api/ceremony/contributions'));if(r.ok)(await r.json()).contributions.forEach(show);}
async function pending(){const r=await fetch(api('/api/ceremony/pending'),{headers:{authorization:'Bearer '+$('admin').value}});
  if(!r.ok){$('status').textContent='Admin authentication failed';return;}$('pending').replaceChildren();
  for(const x of (await r.json()).contributions){const d=el('div','');d.className='star';d.append(el('p',x.transcript+' · '+x.eventId));
    const a=el('button','Approve → chain');a.onclick=async()=>{const res=await fetch(api('/api/ceremony/approve/'+encodeURIComponent(x.id)),{method:'POST',headers:{authorization:'Bearer '+$('admin').value}});
      const body=await res.json().catch(()=>({}));$('status').textContent=res.ok?JSON.stringify(body):('Approval failed: '+(body.error||res.status));pending();};
    const rej=el('button','Reject');rej.onclick=async()=>{await fetch(api('/api/ceremony/reject/'+encodeURIComponent(x.id)),{method:'POST',headers:{authorization:'Bearer '+$('admin').value}});pending();};
    d.append(a,rej);$('pending').append(d);}}
$('submit').onclick=async()=>{const r=await fetch(api('/api/integrations/chathackers'),{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+$('secret').value},
  body:JSON.stringify({messageId:crypto.randomUUID(),channel:'test',type:'text',transcript:$('transcript').value,displayName:'Test Hitchhiker',consentToPublish:true,eventId:$('event').value})});
  $('status').textContent=JSON.stringify(await r.json());};
$('refresh').onclick=pending;approved();
const s=new EventSource(api('/api/ceremony/events'));s.addEventListener('star',e=>show(JSON.parse(e.data)));
</script></body></html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  try {
    if (req.method === 'GET' && (p === '/' || p === '/health')) {
      if (p === '/health') return send(res, 200, { ok: true, chain: !!(TRUST_SITE && KEEPER_KEY) });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }

    if (req.method === 'POST' && p === '/api/integrations/chathackers') {
      if (!auth(req, SECRET)) return send(res, 401, { error: 'Unauthorized' });
      const x = await body(req);
      if (typeof x.messageId !== 'string' || !x.messageId.trim() || x.messageId.length > 200) {
        return send(res, 400, { error: 'messageId required' });
      }
      if (typeof x.transcript !== 'string' || !x.transcript.trim() || x.transcript.length > 4000) {
        return send(res, 400, { error: 'transcript required (max 4000 characters)' });
      }
      if (x.consentToPublish !== true) return send(res, 422, { error: 'Explicit publication consent required' });
      const eventId = typeof x.eventId === 'string' ? x.eventId.trim().toLowerCase() : '';
      if (!NIGHTS.has(eventId)) return send(res, 400, { error: 'eventId required: newspeak, iiw43, or archive' });
      const type = x.type === 'voice' ? 'voice' : 'text';
      if (type !== 'text') return send(res, 400, { error: 'Only type=text is accepted for now (send a transcript).' });

      const existing = records.find(r => r.sourceId === x.messageId);
      if (existing) return send(res, 200, { id: existing.id, status: existing.status, duplicate: true });

      const r = {
        id: crypto.randomUUID(),
        sourceId: x.messageId,
        eventId,
        transcript: x.transcript.trim(),
        displayName: typeof x.displayName === 'string' ? x.displayName.slice(0, 80) : 'Anonymous Hitchhiker',
        channel: CHANNELS.has(x.channel) ? x.channel : 'unknown',
        type: 'text',
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      records.push(r);
      persist();
      return send(res, 202, { id: r.id, status: 'pending', eventId: r.eventId });
    }

    if (req.method === 'GET' && p === '/api/ceremony/contributions') {
      return send(res, 200, { contributions: records.filter(r => r.status === 'approved').map(publicRecord) });
    }
    if (req.method === 'GET' && p === '/api/ceremony/pending') {
      if (!auth(req, ADMIN)) return send(res, 401, { error: 'Unauthorized' });
      return send(res, 200, { contributions: records.filter(r => r.status === 'pending').map(publicRecord) });
    }
    if (req.method === 'POST' && p.startsWith('/api/ceremony/approve/')) {
      if (!auth(req, ADMIN)) return send(res, 401, { error: 'Unauthorized' });
      const id = decodeURIComponent(p.split('/').pop());
      const r = records.find(row => row.id === id);
      if (!r) return send(res, 404, { error: 'Not found' });
      if (r.status === 'approved') return send(res, 200, { id: r.id, status: r.status, seq: r.seq, hash: r.hash, already: true });
      if (r.status === 'rejected') return send(res, 409, { error: 'Already rejected' });
      try {
        const chain = await writeChain(r);
        if (!chain.skipped) {
          r.seq = chain.seq;
          r.hash = chain.hash;
          r.chainId = chain.id;
        } else {
          r.chainSkipped = chain.reason;
        }
        r.status = 'approved';
        persist();
        broadcast(r);
        return send(res, 200, { id: r.id, status: r.status, seq: r.seq, hash: r.hash, chain });
      } catch (e) {
        return send(res, 502, { error: e.message || 'Chain write failed' });
      }
    }
    if (req.method === 'POST' && p.startsWith('/api/ceremony/reject/')) {
      if (!auth(req, ADMIN)) return send(res, 401, { error: 'Unauthorized' });
      const id = decodeURIComponent(p.split('/').pop());
      const r = records.find(row => row.id === id);
      if (!r) return send(res, 404, { error: 'Not found' });
      if (r.status === 'approved') return send(res, 409, { error: 'Already on the chain' });
      r.status = 'rejected';
      persist();
      return send(res, 200, { id: r.id, status: r.status });
    }
    if (req.method === 'GET' && p === '/api/ceremony/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no'
      });
      res.write(': connected\n\n');
      listeners.add(res);
      req.on('close', () => listeners.delete(res));
      return;
    }
    return send(res, 404, { error: 'Not found' });
  } catch (e) {
    return send(res, e instanceof SyntaxError ? 400 : 500, { error: e instanceof SyntaxError ? 'Invalid JSON' : 'Request failed' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Ceremony listener at http://${HOST}:${PORT}`);
  console.log(TRUST_SITE && KEEPER_KEY
    ? `Approve → chain at ${TRUST_SITE}/api/keeper/ceremony`
    : 'Approve is local only until TRUST_SITE and KEEPER_KEY are set');
});
