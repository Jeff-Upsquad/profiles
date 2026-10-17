import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL = 'https://control-db.test';
process.env.SUPABASE_ANON_KEY = 'test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
process.env.SQUADHUB_BOT_KEY = 'sbk_test';
process.env.SQUAD_BOTS_API_URL = 'https://control-bots.test';
const originalFetch = globalThis.fetch;
let enabled = true;
let offline = false;
let controls: boolean[] = [];
let writes: any[] = [];
let svc: typeof import('./chat-bot-switch.service.js');
before(async () => {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === 'control-bots.test') {
      if (offline) throw new Error('offline');
      if (url.pathname.endsWith('/conversations/control')) {
        enabled = JSON.parse(String(init?.body)).enabled;
        controls.push(enabled);
      }
      return Response.json({ data: { conversation_id: 'central', taken_over: !enabled } });
    }
    assert.equal(url.hostname, 'control-db.test');
    writes.push(JSON.parse(String(init?.body)));
    return Response.json(null);
  };
  svc = await import('./chat-bot-switch.service.js');
});
after(() => { globalThis.fetch = originalFetch; });
const conv = () => ({ id: 'chat', status: 'handoff', contact_name: 'Candidate' } as any);
test('shared on clears a stale hiring handoff, so the next inbound can answer', async () => {
  enabled = true; const chat = conv();
  assert.equal(await svc.currentChatBotSwitch(chat), true);
  assert.equal(chat.status, 'bot');
  assert.equal(writes.at(-1).handoff_at, null);
});
test('Bots inbox off pauses a locally active hiring conversation', async () => {
  enabled = false; const chat = { ...conv(), status: 'bot' };
  assert.equal(await svc.currentChatBotSwitch(chat), false);
  assert.equal(chat.status, 'handoff');
});
test('human takeover and handback write the same shared switch', async () => {
  controls = []; const chat = conv();
  await svc.setChatBotSwitch(chat, false, { id: null, name: 'Jeff' });
  await svc.setChatBotSwitch(chat, true, { id: null, name: 'Jeff' });
  assert.deepEqual(controls, [false, true]);
  assert.equal(chat.status, 'bot');
});
test('ownership outages fail closed instead of answering over a human', async () => {
  offline = true;
  await assert.rejects(svc.currentChatBotSwitch(conv()), /offline/);
  offline = false;
});

test('a legacy hiring handoff seeds the shared switch off only when no shared chat exists', async () => {
  const priorFetch = globalThis.fetch;
  let exists = false;
  let seeded: boolean | undefined;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === 'control-bots.test') {
      if (url.pathname.endsWith('/conversations/control')) {
        seeded = JSON.parse(String(init?.body)).enabled;
        exists = true;
      }
      return exists ? Response.json({ data: { conversation_id: 'central', taken_over: true } })
        : Response.json({ error: 'Conversation not found' }, { status: 404 });
    }
    assert.equal(url.hostname, 'control-db.test');
    if (init?.method === 'PATCH') return Response.json(null);
    return Response.json(url.pathname.endsWith('/squad_bot_messages') ? [] : conv());
  };
  try {
    assert.equal(await svc.currentChatBotSwitch(conv()), false);
    assert.equal(seeded, false);
  } finally { globalThis.fetch = priorFetch; }
});
