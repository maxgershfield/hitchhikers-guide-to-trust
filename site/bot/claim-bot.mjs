// The group chat's side of the toy invitation trust task (reference, Telegram). It reads the night's group chat;
// when a message carries someone's claim code, the site writes their claim onto their evidence chain and the bot
// answers with a proverb. It needs no database: the site does the matching; the bot only relays.
//
// Run (on the Pi, beside serve.mjs, or anywhere):
//   TELEGRAM_BOT_TOKEN=... SITE=https://dontpanic.mages.city KEEPER_KEY=... node bot/claim-bot.mjs
// Add the bot to the group and turn off its privacy mode (BotFather: /setprivacy → Disable) so it sees messages.
// Untested against Telegram itself; the site's claim endpoint is tested.

const TOKEN = process.env.TELEGRAM_BOT_TOKEN, SITE = (process.env.SITE || 'http://127.0.0.1:8788').replace(/\/$/, ''), KEY = process.env.KEEPER_KEY;
if (!TOKEN || !KEY) { console.error('Set TELEGRAM_BOT_TOKEN and KEEPER_KEY.'); process.exit(1); }
const tg = async (method, body) => (await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();

async function claim(msg) {
  const r = await fetch(SITE + '/api/keeper/claim', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY },
    body: JSON.stringify({ text: msg.text, who: `tg:${msg.chat.id}:${msg.from && msg.from.id}` }) });
  if (r.status === 404) return; // no claim code in this message: stay quiet
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 503) await tg('sendMessage', { chat_id: msg.chat.id, reply_to_message_id: msg.message_id, text: "The gate is closed right now: the community's node is offline. Try again soon." }); return; }
  const text = d.already
    ? `Already on the chain (link #${d.seq}). Don't panic.\n\n“${d.proverb}”`
    : `Welcome aboard. Your claim is on the community's chain: link #${d.seq}.\n\n“${d.proverb}”`;
  await tg('sendMessage', { chat_id: msg.chat.id, reply_to_message_id: msg.message_id, text });
}

let offset = 0;
for (;;) {
  try {
    const u = await tg('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
    for (const up of u.result || []) { offset = up.update_id + 1; if (up.message && up.message.text) await claim(up.message); }
  } catch (e) { console.error('poll failed:', e.message); await new Promise(r => setTimeout(r, 5000)); }
}
