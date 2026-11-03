import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

process.env.SUPABASE_URL = 'https://signup-otp-fixture.test';
process.env.SUPABASE_ANON_KEY = 'fixture';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';
process.env.JWT_SECRET = 'signup-otp-fixture-secret';
process.env.SQUADHIRE_CRM_SYSTEM_EVENTS_URL = 'https://signup-crm-fixture.test/events';
const originalFetch = globalThis.fetch;
let service: typeof import('./talent-signup-otp.service.js');
let reserved: Record<string, string>;
let deliveredCode: string;
let crmMode: 'sent' | 'skipped' | 'failed' = 'sent';
let acceptReservation = true;
let acceptCode = true;
let databaseFailure = false;
let activations = 0;

before(async () => {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const body = JSON.parse(String(init?.body));
    let result: unknown;
    let status = 200;
    if (url.hostname === 'signup-crm-fixture.test') {
      assert.equal(body.system_event, 'talent_signup_verification_code');
      assert.equal(body.talent.phone, '+919876543210');
      assert.match(body.data.code, /^\d{6}$/);
      assert.deepEqual(body.body_params, [body.data.code]);
      deliveredCode = body.data.code;
      result = { data: { skipped: crmMode === 'skipped' } };
      if (crmMode === 'failed') status = 503;
    } else {
      assert.equal(url.hostname, 'signup-otp-fixture.test');
      if (databaseFailure) return new Response(JSON.stringify({ message: 'unavailable' }), { status: 503 });
      if (url.pathname.endsWith('/reserve_talent_signup_code')) {
        reserved = body;
        assert.equal(body.p_email, 'talent@example.test');
        assert.equal(body.p_phone, '+919876543210');
        result = acceptReservation;
      } else if (url.pathname.endsWith('/consume_talent_signup_code')) {
        assert.equal(body.p_phone, reserved.p_phone);
        assert.equal(body.p_email, reserved.p_email);
        assert.equal(body.p_challenge_id, reserved.p_challenge_id);
        assert.equal(body.p_code_hash, reserved.p_code_hash);
        result = acceptCode;
      } else {
        assert.equal(url.pathname, '/rest/v1/talent_signup_challenges');
        assert.equal(body.delivered, true);
        activations++;
        result = [{ challenge_id: reserved.p_challenge_id }];
      }
    }
    return new Response(JSON.stringify(result), { status, headers: { 'content-type': 'application/json' } });
  };
  service = await import('./talent-signup-otp.service.js');
});
after(() => { globalThis.fetch = originalFetch; });
const input = { phone: '+91 98765 43210', email: 'Talent@Example.test' };

test('sends the OTP only over WhatsApp, stores a keyed hash, binds normalized identity on consume', async () => {
  const response = await service.sendTalentSignupCode(input);
  assert.deepEqual(Object.keys(response).sort(), ['challenge_id', 'expires_in', 'resend_after']);
  assert.equal(response.expires_in, 600);
  assert.equal(activations, 1);
  assert.equal(reserved.p_code_hash, createHmac('sha256', process.env.JWT_SECRET!)
    .update(JSON.stringify(['talent_signup', response.challenge_id, '+919876543210', 'talent@example.test', deliveredCode])).digest('hex'));
  assert.equal(await service.consumeTalentSignupCode(input.phone, input.email, { challenge_id: response.challenge_id, code: deliveredCode }), '+919876543210');
  acceptCode = false;
  await assert.rejects(service.consumeTalentSignupCode(input.phone, input.email, { challenge_id: response.challenge_id, code: deliveredCode }), /Incorrect or expired/);
});

test('does not activate challenges if the CRM skips or fails delivery', async () => {
  for (const mode of ['skipped', 'failed'] as const) {
    crmMode = mode;
    await assert.rejects(service.sendTalentSignupCode(input), /could not send/);
  }
  assert.equal(activations, 1);
  crmMode = 'sent';
});

test('fails closed on unavailable persistence and enforces resend rejection', async () => {
  acceptReservation = false;
  await assert.rejects(service.sendTalentSignupCode(input), /wait before requesting/);
  acceptReservation = true;
  databaseFailure = true;
  await assert.rejects(service.sendTalentSignupCode(input), /unavailable/);
  databaseFailure = false;
});

test('rejects missing OTP and malformed or ambiguous phone numbers', async () => {
  await assert.rejects(service.consumeTalentSignupCode(input.phone, input.email), /Verify your WhatsApp/);
  for (const phone of ['9876543210', '+91', '+00919876543210', '+91letters9876543210']) {
    await assert.rejects(service.sendTalentSignupCode({ ...input, phone }), /valid WhatsApp/);
  }
});
