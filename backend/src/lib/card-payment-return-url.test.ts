import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { cardPaymentReturnUrl } from './card-payment-return-url.js';

for (const [type, section] of [['subscription', 'subscription'], ['assignment', 'assignments']]) {
  test(`${type} payments return to an existing review route`, () => {
    assert.equal(cardPaymentReturnUrl('https://fixture.test/', 'card-123', type),
      `https://fixture.test/business/${section}/card-123?payment=done`);
    assert.ok(existsSync(resolve(__dirname, `../../../frontend/src/app/business/${section}/[cardId]/page.tsx`)));
  });
}
test('no callback when the app origin is absent', () => {
  assert.equal(cardPaymentReturnUrl('', 'card-123', 'subscription'), undefined);
});
