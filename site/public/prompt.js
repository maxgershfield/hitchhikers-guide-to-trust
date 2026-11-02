// The one call to action, shared by the talk and the guide: put your thumbs up, leave a "Don't Panic" proverb, or
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
.dp-prompt svg{position:static!important;display:block}.dp-mbox .dp-thumb{font-size:16px}
.dp-approved{font-family:"Space Grotesk","Segoe UI",Arial,sans-serif}.dp-item{border-left:3px solid #1F4BFF;padding:6px 12px;margin:0 0 8px;font-size:18px}
.dp-item small{display:block;font-family:"Space Mono",Consolas,monospace;font-size:12px;text-transform:uppercase;opacity:.7}`;
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  const api = (location.protocol.startsWith('http') ? '' : 'https://hh.mages.city'), U = p => window.DP ? DP.u(p) : api + p;
  const chainUrl = (location.protocol.startsWith('http') ? '/chain/' : 'https://hh.mages.city/chain/') + (window.DP && DP.event ? '?event=' + DP.event : '');

  document.querySelectorAll('[data-prompt]').forEach(box => {
    box.className = 'dp-prompt'; const Q = new URLSearchParams(location.search), W = (Q.get('w') || '').toLowerCase(), MEET = (Q.get('meet') || '').toLowerCase(); let kind = MEET ? 'meet' : 'thumb';
    box.innerHTML = `<div class="dp-tabs"><button data-k="thumb">👍 Thumbs up</button><button data-k="proverb">A proverb</button><button data-k="guide">Launch a guide</button><button data-k="voice">🎙 Voice note</button><button data-k="meet">🤝 Meet</button></div>
      <div class="dp-meet" style="display:none"><p class="dp-thumb">The Meet Rite: two phones, two yeses, one edge. A scan is only a meeting; an edge needs you both to agree.</p><button type="button" class="dp-go dp-mstart">Start a meeting</button> <input class="dp-mcode" maxlength="8" placeholder="their code" style="width:150px;display:inline-block"> <button type="button" class="dp-go dp-mjoin">Join</button><div class="dp-mbox"></div></div>
      <p class="dp-thumb">The first trust task: put your thumbs up. Your mark joins tonight's guide from its genesis: no account, no joining. What you add is sealed with your own key; claim it later, when you join.</p>
      <div class="dp-voice" style="display:none"><p class="dp-thumb">Say what tonight taught you, up to 45 seconds. It is sealed on your phone before it leaves; only you can play it back. Its star joins the guide.</p><button type="button" class="dp-go dp-rec">● Record</button> <span class="dp-secs"></span> <audio class="dp-play" controls style="display:none;vertical-align:middle;max-width:240px"></audio></div>
      <input class="dp-title" maxlength="40" placeholder="Name your guide" style="display:none">
      <input class="dp-place" maxlength="60" placeholder="Where it begins (a place)" style="display:none">
      <textarea class="dp-text" maxlength="160" placeholder="Don't panic; …" style="display:none"></textarea>
      <label class="dp-fm" style="display:none"><input type="checkbox" class="dp-fmc" style="width:auto;margin:0 8px 0 0"> Offer it to Hitchhiker FM: it may be read on air (the keeper listens first)</label>
      <div class="dp-row"><input class="dp-by" maxlength="40" placeholder="from (optional)" style="display:none"><button class="dp-go dp-send">Thumbs up</button></div>
      <div class="dp-msg"></div><div class="dp-you"></div><div class="dp-gate"></div>`;
    const $ = s => box.querySelector(s);
    const mode = () => { const t = kind === 'thumb', v = kind === 'voice', g = kind === 'guide', mt = kind === 'meet', w = !t && !v && !mt;
      box.querySelector(':scope > .dp-thumb').style.display = t ? '' : 'none'; $('.dp-voice').style.display = v ? '' : 'none'; $('.dp-meet').style.display = mt ? '' : 'none';
      $('.dp-text').style.display = w ? '' : 'none'; $('.dp-by').style.display = w ? '' : 'none'; $('.dp-title').style.display = g ? '' : 'none'; $('.dp-place').style.display = g ? '' : 'none';
      $('.dp-fm').style.display = kind === 'proverb' || v ? 'block' : 'none'; $('.dp-send').style.display = mt ? 'none' : '';
      $('.dp-send').textContent = t ? (W ? 'Thumbs up, here' : 'Thumbs up') : v ? 'Send the note' : g ? 'Launch the guide' : 'Send';
      $('.dp-text').placeholder = g ? 'Its first clue: where to go, what to look for' : "Don't panic; …";
      $('.dp-msg').textContent = w ? (g ? 'A guide drafted here can become a Field Guide: a name, a place, a first clue. Its star joins the chain now; the keeper launches it.' : 'Its star joins the chain now, sealed with your key; the keeper reads it before it shows on the guide.') : ''; };
    box.querySelectorAll('.dp-tabs button').forEach(b => b.classList.toggle('on', b.dataset.k === kind));
    if (W) box.querySelector(':scope > .dp-thumb').textContent = "You scanned the room's screen. Your thumbs up will be marked as witnessed here tonight (the code proves you could see the screen, no more).";
    box.querySelectorAll('.dp-tabs button').forEach(b => b.onclick = () => { kind = b.dataset.k; box.querySelectorAll('.dp-tabs button').forEach(x => x.classList.toggle('on', x === b)); mode(); });
    box.addEventListener('keydown', e => e.stopPropagation());
    // Morse 42 (....- ..---): Hitchhiker FM's motif, played when something is offered to the station
    const morse42 = () => { try { const ac = new (window.AudioContext || window.webkitAudioContext)(); let t = ac.currentTime + .05;
      ['....-', '..---'].forEach(ch => { [...ch].forEach(c => { const o = ac.createOscillator(), g = ac.createGain(), d = c === '.' ? .08 : .24; o.frequency.value = 660; g.gain.value = .12; o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d); t += d + .08; }); t += .22; }); } catch (e) {} };
    // the gate: when the community node hosting the graph is offline, the door is closed
    const gate = async () => { const g = $('.dp-gate'); let open = false, host = '';
      try { const r = await fetch(U('/api/gate'), { cache: 'no-store' }); const d = await r.json(); open = r.ok && d.gate === 'open'; host = d.host || ''; } catch (e) {}
      g.innerHTML = open ? `<span class="dp-dot on"></span>Gate open${host && host !== 'worker' ? ' · held by ' + esc(host) : ''}` : '<span class="dp-dot"></span>Gate closed: the community node is offline';
      box.querySelectorAll('textarea,input,.dp-go').forEach(x => x.disabled = !open); };
    // the Meet Rite: one phone opens a meeting, the other says yes, the first confirms; then the edge is written
    const sigil = h => window.DP ? DP.sigil(h) : '';
    const loadQR = () => window.qrcode ? Promise.resolve() : new Promise(r => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'; sc.onload = r; sc.onerror = r; document.head.append(sc); });
    const met = link => { DP.remember(link.hash); $('.dp-mbox').innerHTML = '<p class="dp-thumb">You met. Two yeses, one edge: it is recorded on tonight\'s guide. Claim it with your DID later, and your agent can carry it as a credential once that is built.</p>'; you(link); };
    const watch = (code, mine) => { const t = setInterval(async () => { try { const d = await (await fetch(U('/api/meet/status?code=' + code), { cache: 'no-store' })).json();
      if (d.error) { clearInterval(t); $('.dp-mbox').innerHTML = `<p class="dp-thumb">${esc(d.error)}</p>`; return; }
      if (d.link) { clearInterval(t); met(d.link); return; }
      if (mine && d.b && !$('.dp-mok')) { $('.dp-mbox').innerHTML = `<p class="dp-thumb"><b style="font-size:26px">${sigil(d.b)}</b> said yes to meeting you. Do you?</p><button type="button" class="dp-go dp-mok">Yes, we met</button>`;
        $('.dp-mok').onclick = async () => { const r = await fetch(U('/api/meet/confirm'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, mark: await DP.mark() }) }), e = await r.json(); if (r.ok) { clearInterval(t); met(e.link); } else $('.dp-mbox').textContent = e.error; }; }
    } catch (e) {} }, 2000); };
    $('.dp-mstart').onclick = async () => { if (!window.DP) return; const r = await fetch(U('/api/meet/open'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mark: await DP.mark() }) }), d = await r.json();
      if (!r.ok) { $('.dp-mbox').textContent = d.error; return; } await loadQR(); const url = location.origin.startsWith('http') ? location.origin + '/m/' + d.code : 'https://hh.mages.city/m/' + d.code;
      let qr = ''; try { const q = qrcode(0, 'M'); q.addData(url); q.make(); qr = q.createSvgTag({ cellSize: 4, margin: 2 }); } catch (e) {}
      $('.dp-mbox').innerHTML = `<div style="display:flex;gap:14px;align-items:center;margin-top:10px"><div style="background:#fff;padding:4px;line-height:0">${qr}</div><div class="dp-thumb">Show this to the person you're meeting.<br>Their code: <b style="font-size:24px;letter-spacing:.1em">${d.code}</b><br>Waiting for their yes…</div></div>`; watch(d.code, true); };
    const join = async code => { if (!window.DP || !code) return; const r = await fetch(U('/api/meet/accept'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, mark: await DP.mark() }) }), d = await r.json();
      if (!r.ok) { $('.dp-mbox').innerHTML = `<p class="dp-thumb">${esc(d.error)}</p>`; return; }
      $('.dp-mbox').innerHTML = `<p class="dp-thumb">You said yes to <b style="font-size:26px">${sigil(d.a)}</b>. Waiting for them to say yes too…</p>`; watch(code, false); };
    $('.dp-mjoin').onclick = () => join($('.dp-mcode').value.trim().toLowerCase());
    if (MEET) { $('.dp-mbox').innerHTML = `<p class="dp-thumb">Someone wants to meet you. Say yes?</p><button type="button" class="dp-go dp-myes">Yes, we're meeting</button>`; setTimeout(() => { const y = $('.dp-myes'); if (y) y.onclick = () => join(MEET); }); }
    gate(); setInterval(gate, 8000);
    // a voice note: recorded here, sealed here, sent as a sealed box
    let rec = null, chunks = [], blob = null, secs = 0, tick = null, mime = '';
    const stopRec = () => { if (rec && rec.state === 'recording') rec.stop(); clearInterval(tick); };
    $('.dp-rec').onclick = async () => {
      if (rec && rec.state === 'recording') { stopRec(); return; }
      try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
        rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 }); chunks = []; secs = 0; blob = null;
        rec.ondataavailable = e => e.data.size && chunks.push(e.data);
        rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' }); const a = $('.dp-play'); a.src = URL.createObjectURL(blob); a.style.display = ''; $('.dp-rec').textContent = '● Record again'; $('.dp-secs').textContent = secs + ' s · ready to send'; };
        rec.start(); $('.dp-rec').textContent = '■ Stop'; $('.dp-play').style.display = 'none';
        tick = setInterval(() => { secs++; $('.dp-secs').textContent = secs + ' s'; if (secs >= 45) stopRec(); }, 1000);
      } catch (e) { $('.dp-msg').textContent = 'No microphone here (or it was not allowed).'; } };
    const you = async link => { if (!link || !window.DP) return; DP.remember(link.hash); const mk = await DP.mark();
      $('.dp-you').innerHTML = `Your mark <b>${DP.sigil(mk)}</b> · ${esc(DP.spell(mk))}<br>recorded on tonight's guide · link #${link.seq}: ${DP.sigil(link.hash)} ${esc(DP.spell(link.hash))} · <a href="${chainUrl}" target="_blank" rel="noopener">see yourself in the guide →</a>`; };
    $('.dp-send').onclick = async () => { const m = $('.dp-msg'), fm = $('.dp-fmc').checked;
      if (kind === 'voice') { if (!blob || !window.DP) { m.textContent = 'Record a note first.'; return; } m.textContent = 'Sealing and sending…';
        try { const type = new TextEncoder().encode((blob.type || 'audio/webm') + '\n'), audio = new Uint8Array(await blob.arrayBuffer()), all = new Uint8Array(type.length + audio.length); all.set(type); all.set(audio, type.length);
          let open; if (fm) { let s2 = ''; for (let i = 0; i < audio.length; i += 8192) s2 += String.fromCharCode(...audio.subarray(i, i + 8192)); open = btoa(s2); }
          const box = await DP.sealBytes(all), r = await fetch(U('/api/voice'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mark: await DP.mark(), iv: box.iv, ct: box.ct, secs, fm, open, type: blob.type }) });
          const d = await r.json(); if (!r.ok) { m.textContent = d.error || 'That did not go through.'; return; }
          m.textContent = fm ? 'Your voice note is sealed and on the guide, and offered to Hitchhiker FM: the keeper listens first.' : 'Your voice note is sealed and on the guide. Only you can play it back.'; if (fm) morse42(); blob = null; $('.dp-secs').textContent = ''; $('.dp-rec').textContent = '● Record'; you(d.link);
        } catch (e) { m.textContent = 'No connection. Try again in a moment.'; } return; }
      m.textContent = 'Sending…';
      try { const mark = window.DP ? await DP.mark() : '', sealed = window.DP ? await DP.seal(kind === 'thumb' ? {kind, at: new Date().toISOString()} : {kind, title: $('.dp-title').value, place: $('.dp-place').value, text: $('.dp-text').value, by: $('.dp-by').value}) : null;
        const claim = kind === 'thumb' && window.DP ? await DP.claimHash() : undefined;
        const r = kind === 'thumb' ? await fetch(U('/api/thumb'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mark, sealed, claim, w: W || undefined }) })
          : await fetch(U('/api/submit'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, title: $('.dp-title').value, place: $('.dp-place').value, text: $('.dp-text').value, by: $('.dp-by').value, fm: kind === 'proverb' && fm, mark, sealed }) });
        const d = await r.json(); if (!r.ok) { m.textContent = d.error || 'That did not go through.'; return; }
        $('.dp-text').value = ''; $('.dp-title').value = ''; $('.dp-place').value = ''; if (kind === 'proverb' && fm) morse42();
        m.textContent = kind === 'thumb' ? (d.witnessed ? "Witnessed: you could see the room's screen tonight. You're part of tonight's guide." : d.expired ? "Thumbs up. (The room's code had changed; scan the screen again to be witnessed.)" : "Thumbs up. You're part of tonight's guide.") : kind === 'proverb' && fm ? 'Received, and offered to Hitchhiker FM. Its star is on the chain; it shows on the guide once approved.' : kind === 'guide' ? 'Received. Its star is on the chain, sealed with your key; the keeper will launch the guide.' : 'Received. Its star is on the chain, sealed with your key; it shows on the guide once approved.';
        you(d.link);
        if (kind === 'thumb' && window.DP) { const c = await DP.claimCode();
          $('.dp-you').insertAdjacentHTML('beforeend', `<div style="margin-top:10px"><a href="${chainUrl}#join" target="_blank" rel="noopener">Join Mages City, and claim your stars →</a></div><div class="dp-claim"><div>Your claim code. Keep it: it proves these stars are yours.</div><b>${c.sigil} ${esc(c.words)}</b> <button type="button" class="dp-copy">copy</button><div style="text-transform:none;opacity:.85">Paste it in the night's group chat for a proverb back, or, once you have joined (no DID yet? vta.farm makes one), claim your stars with it and your DID on the chain page. Only you have this code.</div></div>`);
          const cp = $('.dp-copy'); if (cp) cp.onclick = () => { try { navigator.clipboard.writeText(c.sigil + ' ' + c.words); cp.textContent = 'copied'; } catch (e) {} }; }
      } catch (e) { m.textContent = 'No connection. Try again in a moment.'; } };
  });

  const shelves = document.querySelectorAll('[data-approved]');
  if (shelves.length) {
    const draw = list => shelves.forEach(s => { s.className = 'dp-approved'; const n = +(s.dataset.approved || 6);
      s.innerHTML = list.slice(-n).reverse().map(x => x.kind === 'guide' ? `<div class="dp-item"><small>new guide${x.place ? ' · ' + esc(x.place) : ''}</small><b>${esc(x.title)}</b>: ${esc(x.text)}</div>` : `<div class="dp-item">${esc(x.text)}${x.by ? `<small>${esc(x.by)}</small>` : ''}</div>`).join(''); });
    const poll = async () => { try { const r = await fetch(U('/api/approved'), { cache: 'no-store' }); if (r.ok) draw(await r.json()); } catch (e) {} };
    poll(); setInterval(poll, 15000);
  }
})();
