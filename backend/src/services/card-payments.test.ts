import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { Request, Response } from 'express';

process.env.SUPABASE_URL = 'https://payments-fixture.test';
process.env.SUPABASE_ANON_KEY = 'test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
process.env.CASHFREE_APP_ID = 'fixture';
process.env.CASHFREE_SECRET_KEY = 'fixture-secret';
process.env.CASHFREE_ENV = 'sandbox';
delete process.env.SQUADBOOKS_API_URL;
delete process.env.SQUADBOOKS_ADMIN_API_KEY;
delete process.env.SQUADBOOKS_ORG_ID;
let controller: typeof import('../controllers/card-payments.controller.js');
let service: typeof import('./card-payments.service.js');
const originalFetch = globalThis.fetch;
let row: Record<string, unknown>;
let lookups = 0;
let gatewayChecks = 0;
let paidWrites = 0;
const reset = () => {
  row = { id: 'fixture-payment', card_id: 'card', recipient_id: 'recipient', gateway: 'cashfree',
    status: 'created', amount: 1, payment_link_id: 'link', payment_link_url: 'https://payments.cashfree.com/links/slug',
    created_at: new Date(Date.now() - 120_000).toISOString(), invoice_synced_at: 'done', invoice_sent_at: 'done' };
  lookups = gatewayChecks = paidWrites = 0;
};
before(async () => {
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
    if (url.hostname === 'sandbox.cashfree.com') {
      assert.equal(url.pathname, '/pg/links/link');
      gatewayChecks += 1;
      return json({ link_status: 'PAID', link_amount: 1, link_amount_paid: 1 });
    }
    assert.equal(url.hostname, 'payments-fixture.test', 'No external calls');
    assert.equal(url.pathname, '/rest/v1/card_payments');
    if (init.method === 'PATCH') {
      const body = JSON.parse(String(init.body));
      if (body.status === 'paid') {
        if (row.status !== 'created') return json([]);
        paidWrites += 1;
      }
      Object.assign(row, body);
    } else lookups += 1;
    const singular = new Headers(init.headers).get('accept')?.includes('object+json');
    return json(singular ? row : [row]);
  };
  controller = await import('../controllers/card-payments.controller.js');
  service = await import('./card-payments.service.js');
});
after(() => { globalThis.fetch = originalFetch; });
async function webhook(event: unknown, valid = true) {
  const body = Buffer.from(JSON.stringify(event));
  const timestamp = '1793708819503';
  const signature = createHmac('sha256', 'fixture-secret').update(timestamp).update(body).digest('base64');
  let status = 200;
  let result: Record<string, unknown> = {};
  const req = { body, header: (name: string) => name === 'x-webhook-timestamp' ? timestamp : valid ? signature : 'invalid' };
  const res = { status(code: number) { status = code; return this; }, json(value: Record<string, unknown>) { result = value; return this; } };
  await controller.cashfreeWebhook(req as unknown as Request, res as unknown as Response);
  return { status, result };
}
for (const type of ['PAYMENT_SUCCESS', 'PAYMENT_SUCCESS_WEBHOOK']) {
  test(`${type} confirms the payment and tolerates redelivery`, async () => {
    reset();
    const event = { type, data: { order: { order_id: 'CFPay_slug_random', order_amount: 1 }, payment: { payment_status: 'SUCCESS', cf_payment_id: 123 } } };
    assert.equal((await webhook(event)).result.matched, true);
    assert.equal(row.status, 'paid');
    await webhook(event);
    assert.equal(paidWrites, 1);
  });
}
for (const nested of [false, true]) {
  test(`payment link event handles ${nested ? 'nested' : 'flat'} data`, async () => {
    reset();
    const link = { link_id: 'link', link_status: 'PAID', link_amount_paid: 1, link_notes: { source: 'squadhire', card_payment_id: 'fixture-payment' } };
    assert.equal((await webhook({ type: 'PAYMENT_LINK_EVENT', data: nested ? { link } : link })).result.matched, true);
    assert.equal(row.status, 'paid');
  });
}
test('unsigned, failed, and incomplete success events cannot settle a payment', async () => {
  reset();
  const event = { type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: 'CFPay_slug_random', order_amount: 1 }, payment: { payment_status: 'SUCCESS' } } };
  assert.equal((await webhook(event, false)).status, 400);
  await webhook({ ...event, data: { ...event.data, payment: { payment_status: 'FAILED' } } });
  await webhook({ ...event, data: { order: event.data.order } });
  assert.equal(paidWrites, 0);
  assert.equal(lookups, 0);
});
test('background reconciliation recovers a paid link without a webhook or browser return', async () => {
  reset();
  await service.sweepPendingCardPayments();
  assert.equal(gatewayChecks, 1);
  assert.equal(row.status, 'paid');
  assert.equal(paidWrites, 1);
});
