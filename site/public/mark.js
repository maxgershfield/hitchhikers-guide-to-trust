// Your mark: a secret kept on this device; the chain only ever sees its hash. From any hash come a sigil (four
// glyphs) and a spell (three words), so links in the evidence chain read in the language, not as bare hex.
// Later, when a community launches, showing the secret proves these links were yours: trust you arrive with.
(function () {
  const GLYPHS = ['🐬', '🧭', '🌌', '🧣', '🛸', '🐭', '🌍', '⭐', '🌀', '🔭', '🗝️', '🕯️', '🪐', '🌙', '🔥', '🌊'];
  const WORDS = ['towel', 'thumb', 'compass', 'lantern', 'kettle', 'comet', 'harbour', 'map', 'satchel', 'pebble', 'moth', 'orbit', 'tide', 'ember', 'meadow', 'signal',
    'quiet', 'bright', 'patient', 'curious', 'kind', 'steady', 'wandering', 'brave', 'gentle', 'hoopy', 'open', 'far', 'small', 'true', 'shared', 'local',
    'road', 'gate', 'guide', 'node', 'star', 'river', 'bridge', 'door', 'seed', 'fork', 'circle', 'spell', 'proverb', 'promise', 'witness', 'keeper',
    'panic', 'calm', 'question', 'answer', 'story', 'thread', 'shelter', 'journey', 'pilot', 'mouse', 'fish', 'whale', 'tea', 'dawn', 'dusk', 'forty-two'];
  const KEY = 'dp-secret', MINE = 'dp-mine';
  const get = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const hex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
  function secret() { let s = get(KEY, ''); if (!s) { s = [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join(''); set(KEY, s); } return s; }
  const sigil = h => [0, 1, 2, 3].map(i => GLYPHS[parseInt(h[i], 16)]).join('');
  const spell = h => [0, 1, 2].map(i => WORDS[parseInt(h.slice(4 + i * 2, 6 + i * 2), 16) % WORDS.length]).join(' ');
  const mine = () => { try { return JSON.parse(get(MINE, '[]')); } catch (e) { return []; } };
  // what's behind a star: sealed with a key only this device can derive from its secret
  const key = async () => crypto.subtle.importKey('raw', new Uint8Array((await hex('seal|' + secret())).match(/../g).map(x => parseInt(x, 16))), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const b64 = u => btoa(String.fromCharCode(...u)), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function seal(obj) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await key(), new TextEncoder().encode(JSON.stringify(obj)))); return {iv: b64(iv), ct: b64(ct)}; }
  async function sealBytes(u8) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await key(), u8)); let s = ''; for (let i = 0; i < ct.length; i += 8192) s += String.fromCharCode(...ct.subarray(i, i + 8192)); return {iv: b64(iv), ct: btoa(s)}; }
  async function openBytes(box) { try { return new Uint8Array(await crypto.subtle.decrypt({name: 'AES-GCM', iv: unb64(box.iv)}, await key(), unb64(box.ct))); } catch (e) { return null; } }
  async function open(box) { try { const pt = await crypto.subtle.decrypt({name: 'AES-GCM', iv: unb64(box.iv)}, await key(), unb64(box.ct)); return JSON.parse(new TextDecoder().decode(pt)); } catch (e) { return null; } }
  // the claim code: four words drawn from the secret; only its hash is committed with the thumb up
  const claimWords = async () => { const h = await hex('claim|' + secret()); return [0, 1, 2, 3].map(i => WORDS[parseInt(h.slice(i * 2, i * 2 + 2), 16) % WORDS.length]).join(' '); };
  const claimCode = async () => { const w = await claimWords(), h = await hex('claim|' + secret()); return {sigil: sigil(h), words: w}; };
  const claimHash = async () => hex('claimcode|' + await claimWords());
  // which night's guide: ?event= in the address (remembered on this device), or the site's default
  // remembered for the day only, so a phone at IIW on the 4th adds to Newspeak House on the 5th
  const EV = (() => { const day = new Date().toISOString().slice(0, 10), q = (new URLSearchParams(location.search).get('event') || '').toLowerCase().replace(/[^a-z0-9-]/g, ''); if (q) set('dp-event', q + '|' + day); const [e, d] = get('dp-event', '').split('|'); return q || (d === day ? e : ''); })();
  const base = location.protocol.startsWith('http') ? '' : 'https://hh.mages.city';
  window.DP = {
    mark: () => hex('mark|' + secret()), sigil, spell, mine, seal, open, sealBytes, openBytes, claimCode, claimHash, event: EV,
    u: p => base + p + (EV ? (p.includes('?') ? '&' : '?') + 'event=' + EV : ''),
    remember: hash => { const m = mine(); if (!m.includes(hash)) { m.push(hash); set(MINE, JSON.stringify(m.slice(-200))); } },
    api: base
  };
})();
