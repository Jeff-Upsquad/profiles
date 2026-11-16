import assert from 'node:assert/strict';
import test from 'node:test';
import { agencyPortfolioCurationSchema } from '../validators/agency.validators.js';

const id = '11111111-1111-4111-8111-111111111111';
test('curation rejects duplicate IDs, invalid visibility and negative positions', () => {
  const item = { id, sort_order: 0, hidden_from_agency: false };
  assert.equal(agencyPortfolioCurationSchema.safeParse({ items: [item] }).success, true);
  for (const items of [[item, item], [{ ...item, sort_order: -1 }], [{ ...item, hidden_from_agency: 'false' }], []]) {
    assert.equal(agencyPortfolioCurationSchema.safeParse({ items }).success, false);
  }
});

test('agency public views exclude hidden items while management retains them and never reads partner originals', async t => {
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY = 'test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
  const { supabaseAdmin } = await import('../config/supabase.js');
  const { getAgencyPublicView, getAgencyMemberPublicView } = await import('./agency-public.service.js');
  const { getTotalPortfolio } = await import('./agency.service.js');
  const fixtures: Record<string, unknown> = {
    agency_users: { id, agency_name: 'Agency' },
    agency_profiles: null,
    agency_squad_members: [{ id: 'member', full_name: 'Partner' }],
    agency_member_profiles: [{ id: 'profile', squad_member_id: 'member', category_id: 'category' }],
    agency_general_portfolios: [],
    agency_portfolio_items: [
      { id: 'second', member_profile_id: 'profile', sort_order: 0 },
      { id: 'hidden', member_profile_id: 'profile', sort_order: 1, hidden_from_agency: true },
      { id: 'first', member_profile_id: 'profile', sort_order: 2 },
    ],
  };
  const calls: string[] = [];
  const portfolioScopes: unknown[][] = [];
  const portfolioOrders: unknown[][] = [];
  t.mock.method(supabaseAdmin, 'from', (table: string) => {
    calls.push(table);
    assert.ok(table in fixtures, `Unexpected table: ${table}`);
    const query: any = {};
    for (const method of ['select', 'is', 'range', 'single', 'maybeSingle']) query[method] = () => query;
    query.eq = (...args: unknown[]) => { if (table === 'agency_portfolio_items') portfolioScopes.push(args); return query; };
    query.order = (...args: unknown[]) => { if (table === 'agency_portfolio_items') portfolioOrders.push(args); return query; };
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: fixtures[table], error: null }).then(resolve);
    return query;
  });
  const publicView = await getAgencyPublicView(id);
  assert.deepEqual(publicView.portfolio_items.map(item => item.id), ['second', 'first']);
  const memberView = await getAgencyMemberPublicView(id, 'member');
  assert.deepEqual(memberView.portfolio_items.map(item => item.id), ['second', 'first']);
  const management = await getTotalPortfolio(id);
  assert.deepEqual(management.portfolio_items.map(item => item.id), ['second', 'hidden', 'first']);
  assert.ok(!calls.includes('portfolio_items'));
  assert.ok(portfolioScopes.length > 0);
  assert.ok(portfolioScopes.every(scope => scope[0] === 'agency_user_id' && scope[1] === id));
  assert.deepEqual(portfolioOrders[0], ['sort_order', { ascending: true }]);
});
