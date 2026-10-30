// The one call to action, shared by the talk and the guide: put your thumb up, leave a "Don't Panic" proverb, or
// launch a guide. Every one becomes a link in the evidence chain, sealed with your mark (see mark.js).
// Mount with <div data-prompt></div>; approved submissions appear in <div data-approved></div>.
(function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = `.dp-prompt{font-family:"Space Grotesk","Segoe UI",Arial,sans-serif;color:inherit;max-width:560px}
.dp-tabs{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}.dp-tabs button{font-family:"Space Mono",Consolas,monospace;font-size:14px;font-weight:700;text-transform:uppercase;padding:9px 14px;border:1.5px solid currentColor;border-radius:3px;background:transparent;color:inherit;cursor:pointer}
.dp-tabs button.on{background:#1F4BFF;border-color:#1F4BFF;color:#fff}
.dp-prompt input,.dp-prompt textarea{width:100%;box-sizing:border-box;font:inherit;font-size:19px;background:transparent;color:inherit;border:1.5px solid currentColor;border-radius:3px;padding:11px 12px;margin-bottom:8px}
.dp-prompt textarea{min-height:84px;resize:vertical}.dp-row{display:flex;gap:8px}.dp-row input{flex:1}
.dp-go{font-family:"Space Mono",Consolas,monospace;font-size:15px;font-weight:700;text-transform:uppercase;padding:12px 18px;border:0;border-radius:3px;background:#1F4BFF;color:#fff;cursor:pointer;white-space:nowrap}
.dp-thumb{font-size:18px;line-height:1.45;margin:0 0 10px}
.dp-msg{font-family:"Space Mono",Consolas,monospace;font-size:14px;min-height:20px;margin-top:6px;color:#8EA4FF}
.dp-claim{margin-top:10px;padding:10px 12px;border:1px dashed #8EA4FF;border-radius:4px}.dp-claim b{display:inline-block;margin:6px 0;font-size:20px;letter-spacing:.02em}.dp-copy{font-family:"Space Mono",Consolas,monospace;font-size:12px;text-transform:uppercase;border:1px solid currentColor;background:transparent;color:inherit;border-radius:3px;padding:3px 8px;cursor:pointer;margin-left:6px}
.dp-you{margin-top:10px;line-height:1.6;font-family:"Space Mono",Consolas,monospace;font-size:13px;text-transform:uppercase}.dp-you b{font-size:24px;letter-spacing:.08em}.dp-you a{color:#8EA4FF}
.dp-gate{font-family:"Space Mono",Consolas,monospace;font-size:13px;text-transform:uppercase;margin-top:10px;opacity:.85}.dp-dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#C0504D;margin-right:8px}.dp-dot.on{background:#3FCB6B}
.dp-prompt :disabled{opacity:.45;cursor:not-allowed}
.dp-approved{font-family:"Space Grotesk","Segoe UI",Arial,sans-serif}.dp-item{border-left:3px solid #1F4BFF;padding:6px 12px;margin:0 0 8px;font-size:18px}
.dp-item small{display:block;font-family:"Space Mono",Consolas,monospace;font-size:12px;text-transform:uppercase;opacity:.7}`;
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  const api = (location.protocol.startsWith('http') ? '' : 'https://dontpanic.mages.city');
  const chainUrl = (location.protocol.startsWith('http') ? '/chain/' : 'https://dontpanic.mages.city/chain/');

  document.querySelectorAll('[data-prompt]').forEach(box => {
    box.className = 'dp-prompt'; let kind = 'thumb';
    box.innerHTML = `<div class="dp-tabs"><button class="on" data-k="thumb">👍 Thumb up</button><button data-k="proverb">A proverb</button><button data-k="guide">Launch a guide</button></div>
      <p class="dp-thumb">The first trust task: put your thumb up. Your mark joins the evidence chain, the public face of this community's guide: see yourself in it, and start contributing.</p>
      <input class="dp-title" maxlength="40" placeholder="Name your guide" style="display:none">
      <textarea class="dp-text" maxlength="160" placeholder="Don't panic; …" style="display:none"></textarea>
      <div class="dp-row"><input class="dp-by" maxlength="40" placeholder="from (optional)" style="display:none"><button class="dp-go">Thumb up</button></div>
      <div class="dp-msg"></div><div class="dp-you"></div><div class="dp-gate"></div>`;
    const $ = s => box.querySelector(s);
    const mode = () => { const t = kind === 'thumb';
      $('.dp-thumb').style.display = t ? '' : 'none'; $('.dp-text').style.display = t ? 'none' : ''; $('.dp-by').style.display = t ? 'none' : '';
      $('.dp-title').style.display = kind === 'guide' ? '' : 'none'; $('.dp-go').textContent = t ? 'Thumb up' : 'Send';
      $('.dp-text').placeholder = kind === 'guide' ? 'Its first line of guidance' : "Don't panic; …";
      $('.dp-msg').textContent = t ? '' : 'Its star joins the chain now, sealed with your key; the keeper reads it before it shows on the guide.'; };
    box.querySelectorAll('.dp-tabs button').forEach(b => b.onclick = () => { kind = b.dataset.k; box.querySelectorAll('.dp-tabs button').forEach(x => x.classList.toggle('on', x === b)); mode(); });
    box.addEventListener('keydown', e => e.stopPropagation());
    // the gate: when the community node hosting the graph is offline, the door is closed
    const gate = async () => { const g = $('.dp-gate'); let open = false, host = '';
      try { const r = await fetch(api + '/api/gate', { cache: 'no-store' }); const d = await r.json(); open = r.ok && d.gate === 'open'; host = d.host || ''; } catch (e) {}
      g.innerHTML = open ? `<span class="dp-dot on"></span>Gate open${host && host !== 'worker' ? ' · held by ' + esc(host) : ''}` : '<span class="dp-dot"></span>Gate closed: the community node is offline';
      box.querySelectorAll('textarea,input,.dp-go').forEach(x => x.disabled = !open); };
    gate(); setInterval(gate, 8000);
    const you = async link => { if (!link || !window.DP) return; DP.remember(link.hash); const mk = await DP.mark();
      $('.dp-you').innerHTML = `Your mark <b>${DP.sigil(mk)}</b> · ${esc(DP.spell(mk))}<br>link #${link.seq}: ${DP.sigil(link.hash)} ${esc(DP.spell(link.hash))} · <a href="${chainUrl}" target="_blank" rel="noopener">see yourself in the guide →</a>`; };
    $('.dp-go').onclick = async () => { const m = $('.dp-msg'); m.textContent = 'Sending…';
      try { const mark = window.DP ? await DP.mark() : '', sealed = window.DP ? await DP.seal(kind === 'thumb' ? {kind, at: new Date().toISOString()} : {kind, title: $('.dp-title').value, text: $('.dp-text').value, by: $('.dp-by').value}) : null;
        const claim = kind === 'thumb' && window.DP ? await DP.claimHash() : undefined;
        const r = kind === 'thumb' ? await fetch(api + '/api/thumb', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mark, sealed, claim }) })
          : await fetch(api + '/api/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, title: $('.dp-title').value, text: $('.dp-text').value, by: $('.dp-by').value, mark, sealed }) });
        const d = await r.json(); if (!r.ok) { m.textContent = d.error || 'That did not go through.'; return; }
        $('.dp-text').value = ''; $('.dp-title').value = '';
        m.textContent = kind === 'thumb' ? 'Thumb up. A ride stopped: you are on the chain.' : kind === 'guide' ? 'Received. Its star is on the chain, sealed with your key; the keeper will launch the guide.' : 'Received. Its star is on the chain, sealed with your key; it shows on the guide once approved.';
        you(d.link);
        if (kind === 'thumb' && window.DP) { const c = await DP.claimCode();
          $('.dp-you').insertAdjacentHTML('beforeend', `<div class="dp-claim"><div>Your claim code, for the night's group chat:</div><b>${c.sigil} ${esc(c.words)}</b> <button type="button" class="dp-copy">copy</button><div style="text-transform:none;opacity:.85">Paste it in the chat: the bot writes your claim onto the community's chain and answers with a proverb. Only you have this code.</div></div>`);
          const cp = $('.dp-copy'); if (cp) cp.onclick = () => { try { navigator.clipboard.writeText(c.sigil + ' ' + c.words); cp.textContent = 'copied'; } catch (e) {} }; }
      } catch (e) { m.textContent = 'No connection. Try again in a moment.'; } };
  });

  const shelves = document.querySelectorAll('[data-approved]');
  if (shelves.length) {
    const draw = list => shelves.forEach(s => { s.className = 'dp-approved'; const n = +(s.dataset.approved || 6);
      s.innerHTML = list.slice(-n).reverse().map(x => x.kind === 'guide' ? `<div class="dp-item"><small>new guide</small><b>${esc(x.title)}</b>: ${esc(x.text)}</div>` : `<div class="dp-item">${esc(x.text)}${x.by ? `<small>${esc(x.by)}</small>` : ''}</div>`).join(''); });
    const poll = async () => { try { const r = await fetch(api + '/api/approved', { cache: 'no-store' }); if (r.ok) draw(await r.json()); } catch (e) {} };
    poll(); setInterval(poll, 15000);
  }
})();
