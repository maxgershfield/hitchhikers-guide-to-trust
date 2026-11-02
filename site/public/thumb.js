// A small thumbs-up in the corner of every scene: each touch adds a star to the guide's chain from this device
// (its own mark; what's behind the star, the scene it was given on, sealed with the device's own key).
(function () {
  if (!window.DP) return;
  const host = document.getElementById('stage') || document.body;
  const css = document.createElement('style');
  css.textContent = `#tu{position:absolute;right:70px;bottom:62px;z-index:7;display:flex;align-items:center;gap:8px;font-family:"Space Mono",Consolas,monospace}
#tu button{width:52px;height:52px;border-radius:50%;border:1.5px solid #1F4BFF;background:#F6F1E6;font-size:24px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.15);transition:transform .15s}
#tu button:hover{transform:scale(1.08)}#tu button:active{transform:scale(.94)}#tu button[disabled]{opacity:.5;cursor:wait}
#tu .msg{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#1F4BFF;background:#F6F1E6;padding:4px 8px;border-radius:3px;opacity:0;transition:opacity .3s}
#tu .msg.on{opacity:1}
#tu .burst{position:absolute;right:16px;bottom:40px;font-size:20px;pointer-events:none;animation:tuup 1.2s ease-out forwards}
@keyframes tuup{to{transform:translateY(-70px);opacity:0}}`;
  document.head.append(css);
  const box = document.createElement('div'); box.id = 'tu';
  box.innerHTML = '<span class="msg"></span><button title="Thumbs up: add your star to the guide">👍</button>';
  host.append(box);
  const btn = box.querySelector('button'), msg = box.querySelector('.msg'); let t;
  const say = (s, ms) => { msg.textContent = s; msg.classList.add('on'); clearTimeout(t); t = setTimeout(() => msg.classList.remove('on'), ms || 2600); };
  btn.onclick = async e => {
    e.stopPropagation(); btn.disabled = true;
    try {
      let scene = ''; try { const on = document.querySelector('.scene.on'); scene = on ? on.dataset.sec : document.title; } catch (x) {}
      const mark = await DP.mark(), sealed = await DP.seal({kind: 'thumb', at: new Date().toISOString(), scene}), claim = await DP.claimHash();
      const r = await fetch(DP.u('/api/thumb'), {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({mark, sealed, claim})});
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { say(d.error || 'That did not go through'); return; }
      DP.remember(d.link.hash);
      const b = document.createElement('span'); b.className = 'burst'; b.textContent = '✦'; box.append(b); setTimeout(() => b.remove(), 1300);
      say(`+1 star · #${d.link.seq} · ${DP.sigil(d.link.hash)}`);
    } catch (x) { say('Offline: the chain could not be reached'); }
    finally { btn.disabled = false; }
  };
})();
