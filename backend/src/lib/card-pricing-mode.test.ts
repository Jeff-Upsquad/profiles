import assert from 'node:assert/strict';
import test from 'node:test';
import { isSubscriptionRequestQuote, resolveCardPricingMode } from './card-pricing-mode.js';

test('recognises legacy price-less subscriptions as request quote', () => {
  assert.equal(isSubscriptionRequestQuote('subscription', {}), true);
  assert.equal(resolveCardPricingMode('subscription', {}), 'unpriced');
});

test('keeps subscriptions with numeric or legacy formatted prices priced', () => {
  assert.equal(isSubscriptionRequestQuote('subscription', { monthly_price: 12_000 }), false);
  assert.equal(isSubscriptionRequestQuote('subscription', { price_label: '₹12,000/month' }), false);
});

test('honours explicit request-quote and priced markers', () => {
  assert.equal(
    isSubscriptionRequestQuote('subscription', { pricing_mode: 'unpriced', monthly_price: 12_000 }),
    true,
  );
  assert.equal(isSubscriptionRequestQuote('subscription', { pricing_mode: 'priced' }), false);
});

test('preserves assignment pricing mode behaviour', () => {
  assert.equal(
    resolveCardPricingMode('assignment', { assignment_details: { pricing_mode: 'unpriced' } }),
    'unpriced',
  );
  assert.equal(resolveCardPricingMode('assignment', {}), 'priced');
});
