import test from 'node:test';
import assert from 'node:assert/strict';
import { agencyRequirementsComplete, redactAgencyCard } from './agency-training-access.js';

test('agency remains locked until a nonempty required course is complete', () => {
  assert.equal(agencyRequirementsComplete([]), false);
  assert.equal(agencyRequirementsComplete([{ total_count: 0, completed_count: 0 }]), false);
  assert.equal(agencyRequirementsComplete([{ total_count: 2, completed_count: 1 }]), false);
  assert.equal(agencyRequirementsComplete([{ total_count: 2, completed_count: 2 }]), true);
});

test('view-only card omits client identity and freeform fields from the API', () => {
  const card = {
    id: 'recipient', card: { external_id: 'secret-card-id', match_rules: { client_name: 'Acme' }, content: {
      title: 'Acme hiring', brand_name: 'Acme', client_name: 'Acme CEO',
      description: 'Call Jane at Acme', requirement_note: 'Private brief',
      monthly_price: 18000, plan_name: 'Plus',
    } },
  };
  const preview = redactAgencyCard(card);
  assert.equal(preview.card.content.monthly_price, 18000);
  assert.equal(preview.card.content.plan_name, 'Plus');
  assert.equal(preview.card.external_id, null);
  assert.equal(JSON.stringify(preview).includes('Acme'), false);
  assert.equal(JSON.stringify(preview).includes('Jane'), false);
});
