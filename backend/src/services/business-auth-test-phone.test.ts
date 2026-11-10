import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://business-phone-fixture.test';
process.env.SUPABASE_ANON_KEY = 'fixture';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';
process.env.JWT_SECRET = 'business-phone-fixture-secret';
const originalFetch = globalThis.fetch;
let auth: typeof import('./business-auth.service.js');
let businessInserts = 0;
let sessions = 0;

// Row the fixture pretends already exists: activated, on the password track,
// with a password set — the exact shape that trips the 409 "already set up".
const existingRow = {
  id: 'existing-row-id',
  contact_email: 'taken@example.test',
  contact_phone: '+91 9876543210',
  is_active: true,
  password_required: true,
  password_hash: 'preset-hash',
  invitation_id: null,
  access_expires_at: null,
  company_name: 'Existing Co',
  contact_person_name: 'Existing',
};

const signup = (email: string, phone: string) => ({
  email,
  phone,
  name: 'Test',
  company_name: 'Test Co',
  password: 'fixture-password',
});

before(async () => {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'business-phone-fixture.test');
    const path = url.pathname;
    if (path === '/rest/v1/business_users') {
      if ((init?.method ?? 'GET') === 'POST') {
        // Signup insert: echo the submitted row back (single() wants an object).
        businessInserts++;
        const row = JSON.parse(String(init?.body));
        return new Response(JSON.stringify(row), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        });
      }
      // Identity lookups: a row exists only for the taken email / other phone.
      const email = url.searchParams.get('contact_email') ?? '';
      const phone = url.searchParams.get('contact_phone_normalized') ?? '';
      const found = email.endsWith('taken@example.test') || phone.includes('9876543210');
      return new Response(JSON.stringify(found ? [existingRow] : []), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (path === '/rest/v1/business_sessions') {
      sessions++;
      return new Response(null, { status: 201 });
    }
    // Default (e.g. the void-fired subscription_cards stamp): succeed quietly.
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  auth = await import('./business-auth.service.js');
});

after(async () => {
  // Let the void-fired post-signup hook settle before restoring real fetch.
  await new Promise((r) => setTimeout(r, 25));
  globalThis.fetch = originalFetch;
});

test('signup permits reuse of the testing phone across accounts, in any formatting', async () => {
  const first = await auth.businessSignup(signup('new1@example.test', '+91 9645545553'));
  assert.equal(first.status, 'ok');
  const second = await auth.businessSignup(signup('new2@example.test', '919645545553'));
  assert.equal(second.status, 'ok');
  assert.notEqual(first.user.id, second.user.id);
  assert.notEqual(first.access_token, second.access_token);
  assert.equal(businessInserts, 2);
  assert.equal(sessions, 2);
  assert.equal(second.must_change_password, false);
});

test('signup still rejects a duplicate email even when reusing the testing phone', async () => {
  await assert.rejects(
    auth.businessSignup(signup('taken@example.test', '9645545553')),
    /already set up/,
  );
  assert.equal(businessInserts, 2);
});

test('signup still rejects duplicate accounts for any other phone', async () => {
  await assert.rejects(
    auth.businessSignup(signup('new3@example.test', '+91 98765 43210')),
    /already set up/,
  );
  assert.equal(businessInserts, 2);
});
