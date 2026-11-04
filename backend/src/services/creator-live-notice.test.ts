import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://creator-notice.test';
process.env.SUPABASE_ANON_KEY = 'test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
process.env.SQUADHIRE_CRM_SYSTEM_EVENTS_URL = 'https://creator-crm.test/system-events';
const originalFetch = globalThis.fetch;
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
let sweep: typeof import('./creator-live-notice.service.js').deliverCreatorLiveNotices;
let attempts = 0;
let delivered = false;
let alreadySent = false;
let skipped = false;
let claimLost = false;
let sends = 0;
let checkedSince = '';
before(async () => {
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.hostname === 'creator-crm.test') {
      sends++;
      const payload = JSON.parse(String(init.body));
      assert.equal(payload.system_event, 'talent_creator_profile_live');
      return json({ data: { skipped } });
    }
    assert.equal(url.hostname, 'creator-notice.test', 'No production requests');
    const table = url.pathname.split('/').pop();
    if (table === 'creator_live_notice_outbox') {
      if (init.method === 'PATCH') {
        const body = JSON.parse(String(init.body));
        if ('attempts' in body) {
          if (claimLost) return json(null);
          assert.equal(url.searchParams.get('attempts'), `eq.${attempts}`);
          attempts = body.attempts;
          return json({ id: 'notice' });
        }
        delivered = !!body.delivered_at;
        return new Response(null, { status: 204 });
      }
      return json(delivered ? [] : [{ id: 'notice', talent_user_id: 'creator', attempts, created_at: '2026-11-04T00:00:00Z' }]);
    }
    if (table === 'talent_users') return json({ full_name: 'Creator', phone: '+919000000000' });
    if (table === 'crm_leads') return json([{ id: 'lead' }]);
    if (table === 'crm_messages') {
      checkedSince = url.searchParams.get('created_at') ?? '';
      return json(alreadySent ? [{ id: 'message' }] : []);
    }
    throw new Error(`Unexpected fixture URL ${url}`);
  };
  sweep = (await import('./creator-live-notice.service.js')).deliverCreatorLiveNotices;
});
after(() => { globalThis.fetch = originalFetch; });
function reset() { attempts = 0; delivered = false; alreadySent = false; skipped = false; claimLost = false; sends = 0; }

test('WhatsApp sends once; subsequent sweeps ignore delivered notices', async () => {
  reset(); await sweep(); await sweep();
  assert.equal(sends, 1); assert.equal(delivered, true);
  assert.equal(checkedSince, 'gte.2026-11-04T00:00:00Z', 'old unrelated messages cannot suppress this notice');
});
test('CRM stage automation send satisfies the notice without sending again', async () => {
  reset(); alreadySent = true; await sweep();
  assert.equal(sends, 0); assert.equal(delivered, true);
});
test('CRM skipped response remains pending and retries', async () => {
  reset(); skipped = true; await sweep();
  assert.equal(delivered, false); assert.equal(attempts, 1);
  skipped = false; await sweep();
  assert.equal(delivered, true); assert.equal(attempts, 2);
});
test('another process claiming the queue row prevents a duplicate send', async () => {
  reset(); claimLost = true; await sweep();
  assert.equal(sends, 0); assert.equal(delivered, false);
});
