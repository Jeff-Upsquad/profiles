import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the mutation's HTTP request and cache effects without rendering React.
function setup() {
  const requests = [];
  const invalidated = [];
  const offer = { id: 'offer', card_id: 'talent-tier-card' };
  const testModule = { exports: {} };
  const source = readFileSync(new URL('../src/hooks/useBusinessAssignmentOffers.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  vm.runInNewContext(outputText, {
    exports: testModule.exports,
    require(name) {
      if (name === '@tanstack/react-query') return {
        useMutation: (options) => options,
        useQueryClient: () => ({ invalidateQueries: ({ queryKey }) => invalidated.push(Array.from(queryKey)) }),
      };
      if (name === '@/services/api') return {
        post: async (url, body) => { requests.push({ url, body }); return { data: { offer } }; },
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return { hooks: testModule.exports, requests, invalidated, offer };
}

test('a grouped review sends the counter to the recipient tier and refreshes both cards', async () => {
  const { hooks, requests, invalidated } = setup();
  const mutation = hooks.useBusinessSendOffer('representative-card');
  const amount = { amount: 5000, currency: 'INR', period: 'project' };
  const result = await mutation.mutationFn({
    recipientId: 'recipient', recipientCardId: 'talent-tier-card', amount, note: 'Our budget',
  });
  mutation.onSuccess(result);
  assert.equal(requests[0].url, '/business/my-subscription-cards/talent-tier-card/offers/send');
  assert.deepEqual(requests[0].body.amount, amount);
  assert.equal(requests[0].body.recipient_id, 'recipient');
  assert.equal(requests[0].body.note, 'Our budget');
  for (const cardId of ['representative-card', 'talent-tier-card']) {
    for (const key of ['business-assignment-offers', 'card-recipients']) {
      assert.ok(invalidated.some((query) => query[0] === key && query[1] === cardId));
    }
  }
  assert.ok(invalidated.some((query) => query[0] === 'my-assignment-cards'));
  assert.ok(invalidated.some((query) => query[0] === 'my-subscription-cards'));
});

test('single-card callers can still send without a recipient card override', async () => {
  const { hooks, requests } = setup();
  const mutation = hooks.useBusinessSendOffer('single-card');
  await mutation.mutationFn({ recipientId: 'recipient', amount: { amount: 5000 } });
  assert.equal(requests[0].url, '/business/my-subscription-cards/single-card/offers/send');
  assert.equal('note' in requests[0].body, false);
});
