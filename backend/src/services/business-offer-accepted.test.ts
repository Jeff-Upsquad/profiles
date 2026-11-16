import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://offer-accepted.test';
process.env.SUPABASE_ANON_KEY = 'test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
process.env.SQUADCRM_SYSTEM_EVENTS_URL = 'https://business-crm.test/system-event';
process.env.SQUADHIRE_CRM_SYSTEM_EVENTS_URL = 'https://talent-crm.test/system-event';
const originalFetch = globalThis.fetch;
const json = (data: unknown) => new Response(JSON.stringify(data), {
  headers: { 'content-type': 'application/json' },
});
let notify: typeof import('./business-card-alerts.service.js').notifyBusinessOfferAccepted;
let card: Record<string, unknown>;
let business: Record<string, unknown>;
let sent: Record<string, any>[];
let failDelivery = false;

function reset() {
  card = { id: 'tier-card', card_type: 'assignment', business_user_id: 'business',
    status: 'active', archived_at: null, group_id: null, content: { title: 'Editing project' } };
  business = { contact_person_name: 'Jeff', contact_phone: '+919000000000',
    is_active: true, whatsapp_card_alerts_enabled: true };
  sent = [];
  failDelivery = false;
}

before(async () => {
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.hostname === 'business-crm.test') {
      sent.push(JSON.parse(String(init.body)));
      if (failDelivery) throw new Error('CRM unavailable');
      return json({ success: true });
    }
    assert.equal(url.hostname, 'offer-accepted.test', 'No talent CRM or production requests');
    assert.equal(init.method ?? 'GET', 'GET', 'Acceptance notices must not spend batch alert slots');
    if (url.pathname.endsWith('/subscription_cards')) {
      if (url.searchParams.has('group_id')) return json([
        { id: 'primary-card', is_secondary: false }, { id: 'tier-card', is_secondary: true },
      ]);
      return json(card);
    }
    if (url.pathname.endsWith('/business_users')) return json(business);
    throw new Error(`Unexpected request ${url}`);
  };
  notify = (await import('./business-card-alerts.service.js')).notifyBusinessOfferAccepted;
});
after(() => { globalThis.fetch = originalFetch; });

test('offer acceptance routes to business CRM with the agreed template and card link', async () => {
  reset();
  await notify({ cardId: 'tier-card', talentName: 'Fuhad AK' });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].system_event, 'business_assignment_offer_accepted');
  assert.deepEqual(sent[0].body_params, ['Jeff', 'Fuhad AK', 'Editing project']);
  assert.equal(sent[0].button_url_param, 'tier-card');
  assert.equal(sent[0].talent.phone, business.contact_phone);
});

test('subscription acceptance uses the primary card for a grouped brief', async () => {
  reset(); card.card_type = 'subscription'; card.group_id = 'group';
  await notify({ cardId: 'tier-card', talentName: 'John' });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].button_url_param, 'primary-card');
  assert.equal(sent[0].data.card_id, 'primary-card');
});

test('business opt-out, inactivity, or missing phone prevents WhatsApp', async () => {
  for (const override of [{ whatsapp_card_alerts_enabled: false }, { is_active: false }, { contact_phone: null }]) {
    reset(); Object.assign(business, override);
    await notify({ cardId: 'tier-card', talentName: 'Fuhad' });
    assert.equal(sent.length, 0);
  }
});

test('closed, archived, and hiring cards do not send assignment acceptance notices', async () => {
  for (const override of [{ status: 'closed' }, { archived_at: '2026-11-16' }, { card_type: 'hiring' }]) {
    reset(); Object.assign(card, override);
    await notify({ cardId: 'tier-card', talentName: 'Fuhad' });
    assert.equal(sent.length, 0);
  }
});

test('user-authored template parameters are flattened for Meta', async () => {
  reset(); card.content = { title: 'Editing\n\t  project' };
  await notify({ cardId: 'tier-card', talentName: 'John\n  Abraham' });
  assert.deepEqual(sent[0].body_params, ['Jeff', 'John Abraham', 'Editing project']);
});

test('CRM outage does not reject the acceptance notification', async () => {
  reset(); failDelivery = true;
  await assert.doesNotReject(notify({ cardId: 'tier-card', talentName: 'Fuhad' }));
  assert.equal(sent.length, 1);
});
