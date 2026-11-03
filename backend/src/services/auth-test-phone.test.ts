import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://auth-phone-fixture.test';
process.env.SUPABASE_ANON_KEY = 'fixture';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';
const originalFetch = globalThis.fetch;
let auth: typeof import('./auth.service.js');
let createAttempts = 0;

before(async () => {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'auth-phone-fixture.test');
    let result: unknown = [];
    let status = 200;
    if (url.pathname.includes('/rpc/check_contact_exists')) {
      const body = JSON.parse(String(init?.body));
      result = body.p_email === 'existing@example.test' || body.p_phone_digits
        ? [{ source: 'talent' }] : [];
    } else if (url.pathname.includes('/rpc/consume_talent_signup_code')) {
      result = true;
    } else if (url.pathname === '/auth/v1/admin/users') {
      createAttempts++;
      // Stop before creating any account; reaching Auth proves the duplicate
      // guard allowed the test number through the actual signup path.
      result = { message: 'fixture reached account creation' };
      status = 400;
    }
    return new Response(JSON.stringify(result), { status, headers: { 'content-type': 'application/json' } });
  };
  auth = await import('./auth.service.js');
});
after(() => { globalThis.fetch = originalFetch; });

test('only the testing phone bypasses duplicate checks, including country-code formatting', async () => {
  for (const phone of ['9645545553', '+91 96455 45553', '919645545553']) {
    assert.equal((await auth.checkCandidateStatus({ phone })).has_account, false);
    assert.equal((await auth.checkCandidateStatus({ phone, email: 'new@example.test' })).has_account, false);
    assert.equal((await auth.checkCandidateStatus({ phone, email: 'existing@example.test' })).has_account, true);
  }
  assert.equal((await auth.checkCandidateStatus({ phone: '9645545554' })).has_account, true);
  assert.equal((await auth.checkCandidateStatus({ email: 'existing@example.test' })).has_account, true);
});

test('signup permits reuse of the testing phone but still rejects duplicate emails and other phones', async () => {
  const signup = { email: 'new@example.test', password: 'fixture-password', otp: { challenge_id: '12345678-1234-4234-8234-123456789012', code: '123456' }, full_name: 'Test', phone: '+91 9645545553' };
  await assert.rejects(auth.signupTalent(signup), /fixture reached account creation/);
  assert.equal(createAttempts, 1);
  await assert.rejects(auth.signupTalent({ ...signup, email: 'existing@example.test' }), /already exists/);
  await assert.rejects(auth.signupTalent({ ...signup, phone: '9645545554' }), /already exists/);
  assert.equal(createAttempts, 1);
});
