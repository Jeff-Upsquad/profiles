import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

// Entirely isolated transport fixtures: no production credentials or calls.
process.env.SUPABASE_URL = 'https://support-fixture.test';
process.env.SUPABASE_ANON_KEY = 'test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
let handler: (url: URL, init: RequestInit) => Response;
const originalFetch = globalThis.fetch;
let bot: typeof import('./squad-bot.service.js');
let support: typeof import('./support-chat.service.js');
before(async () => {
  globalThis.fetch = async (input, init) => handler(new URL(String(input)), init ?? {});
  bot = await import('./squad-bot.service.js');
  support = await import('./support-chat.service.js');
});
after(() => { globalThis.fetch = originalFetch; });
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
const conv = { id: 'chat', talent_user_id: null, status: 'handoff', crm_lead_id: 'lead', handoff_at: null };
test('Support Chat replies stay in the app even when the latest talent message was WhatsApp', async () => {
  let inserted: any;
  handler = (url, init) => {
    assert.equal(url.hostname, 'support-fixture.test', 'Must never contact CRM WhatsApp endpoint');
    if (url.pathname.endsWith('/squad_bot_conversations')) return json(init.method === 'PATCH' ? null : [conv]);
    if (url.pathname.endsWith('/squad_bot_messages') && init.method === 'POST') {
      inserted = JSON.parse(String(init.body)); return json({ ...inserted, id: 'reply', created_at: new Date().toISOString() });
    }
    if (url.pathname.endsWith('/squad_bot_messages')) return json([{ sender: 'talent', channel: 'whatsapp', body: 'WhatsApp latest' }]);
    throw new Error(`Unexpected call: ${url}`);
  };
  await bot.staffReply('chat', { id: 'staff', name: 'Team' }, 'App reply', 'app');
  assert.equal(inserted.sender, 'staff');
  assert.notEqual(inserted.channel, 'whatsapp');
  assert.equal(inserted.body, 'App reply');
});
test('app message filter is applied before the history limit', async () => {
  handler = (url) => {
    assert.equal(url.searchParams.get('channel'), 'eq.app');
    assert.equal(url.searchParams.get('limit'), '100');
    return json([]);
  };
  await bot.recentLines('chat', 100, 'app');
});
test('older support messages use an app-only cursor before limiting', async () => {
  handler = (url) => {
    if (url.pathname.endsWith('/support_chat_conversations')) return json([conv]);
    assert.equal(url.searchParams.get('channel'), 'eq.app');
    assert.equal(url.searchParams.get('created_at'), 'lt.2026-09-28T00:00:00.000Z');
    assert.equal(url.searchParams.get('limit'), '100');
    return json([]);
  };
  const page = await support.getSupportChat('chat', '2026-09-28T00:00:00.000Z');
  assert.deepEqual(page.messages, []);
});
test('the support detail rejects WhatsApp-only or nonexistent chat IDs', async () => {
  handler = (url) => { assert.ok(url.pathname.endsWith('/support_chat_conversations')); return json([]); };
  await assert.rejects(support.getSupportChat('whatsapp-chat'), { statusCode: 404 });
});
test('while handed off an app message is saved without invoking the model', async () => {
  let writes = 0;
  handler = (url, init) => {
    if (url.pathname.endsWith('/squad_bot_conversations')) return json(init.method === 'PATCH' ? null : [conv]);
    if (init.method === 'HEAD') return new Response(null, { headers: { 'content-range': '0-0/1' } });
    if (url.pathname.endsWith('/squad_bot_messages') && init.method === 'POST') {
      writes++; return json({ ...JSON.parse(String(init.body)), id: 'message', created_at: new Date().toISOString() });
    }
    throw new Error(`Unexpected request during handoff: ${url}`);
  };
  const result = await bot.sendTalentMessage('talent', 'A follow-up question');
  assert.equal(result.status, 'handoff'); assert.equal(writes, 1);
  assert.equal(result.messages.length, 1);
});
