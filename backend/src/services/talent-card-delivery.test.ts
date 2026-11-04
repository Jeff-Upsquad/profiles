import assert from 'node:assert/strict';
import test from 'node:test';
import { supabaseAdmin } from '../config/supabase.js';
import { reconcileTalentCardDeliveries } from './talent-card-delivery.service.js';
import { backfillCardsForTalent } from './card-backfill.service.js';
type Row = Record<string, any>;
function fixture() {
  const users: Row[] = ['language', 'location', 'neither'].map((id) => ({ id, is_active: true, suspended: false, blacklisted: false, languages_spoken: [id === 'language' ? 'English' : 'Hindi'] }));
  const profiles: Row[] = users.map((u) => ({ id: 'p-' + u.id, talent_user_id: u.id, category_id: 'design', status: 'approved', is_active: true, deleted_at: null, tier: 'pro', field_data: {} }));
  const card: Row = { id: 'card', business_user_id: 'business', card_type: 'subscription', status: 'active', distribution: 'auto', archived_at: null, expires_at: null, content: {}, match_rules: { category_ids: ['design'], target_tiers: ['Pro'], target_languages: ['English'], target_regions: [{ country_name: 'India', region: 'Kerala' }] } };
  const tables: Record<string, Row[]> = { talent_users: users, talent_profiles: profiles, talent_profiles_basic: users.map((u) => ({ talent_user_id: u.id, country: 'India', state: u.id === 'location' ? 'Kerala' : 'Maharashtra' })), talent_job_preferences: [], subscription_cards: [card], subscription_card_recipients: [] };
  const original = supabaseAdmin.from; let conflict = false;
  supabaseAdmin.from = ((table: string) => {
    const filters: Array<(row: Row) => boolean> = []; let single = false, bounds: [number, number] | undefined, inserts: Row[] | undefined, update: Row | undefined;
    const rows = () => table === 'v_talent_profile_tier' ? profiles.map((p) => ({ talent_profile_id: p.id, tier: p.tier })) : tables[table];
    const field = (r: Row, key: string) => key.startsWith('talent_users.') ? users.find((u) => u.id === r.talent_user_id)?.[key.split('.')[1]] : r[key];
    const query = {
      select() { return this; }, order() { return this; }, limit() { return this; },
      eq(k: string, v: unknown) { filters.push((r) => field(r, k) === v); return this; },
      is(k: string, v: unknown) { filters.push((r) => (field(r, k) ?? null) === v); return this; },
      in(k: string, v: unknown[]) { filters.push((r) => v.includes(field(r, k))); return this; },
      not(k: string, _operator: string, v: unknown) { filters.push((r) => (field(r, k) ?? null) !== v); return this; },
      range(a: number, b: number) { bounds = [a, b]; return this; }, maybeSingle() { single = true; return this; }, single() { single = true; return this; },
      insert(data: Row[]) { inserts = data; return this; }, update(data: Row) { update = data; return this; },
      then(resolve: (v: unknown) => unknown) {
        assert.ok(rows(), 'Unexpected table: ' + table);
        if (inserts) {
          if (conflict) { conflict = false; tables[table].push({ ...inserts[0], id: 'concurrent', cancelled_at: null }); return Promise.resolve(resolve({ data: null, error: { code: '23505' } })); }
          for (const r of inserts) tables[table].push({ ...r, id: String(tables[table].length), cancelled_at: null });
          return Promise.resolve(resolve({ data: inserts, error: null, count: inserts.length }));
        }
        let data = rows().filter((r) => filters.every((f) => f(r))); if (update) for (const r of data) Object.assign(r, update);
        if (bounds) data = data.slice(bounds[0], bounds[1] + 1);
        return Promise.resolve(resolve({ data: single ? data[0] ?? null : data, error: null }));
      },
    }; return query;
  }) as unknown as typeof supabaseAdmin.from;
  return { tables, users, profiles, card, conflict() { conflict = true; }, restore() { supabaseAdmin.from = original; } };
}
test('catch-up uses location OR language, is scoped, repeatable, and defaults to read-only', async () => {
  const f = fixture(); try {
    assert.deepEqual(await reconcileTalentCardDeliveries(), { checked: 1, missing: 2, inserted: 0, failed: 0 });
    assert.equal(f.tables.subscription_card_recipients.length, 0);
    assert.equal(await backfillCardsForTalent('language'), 1); assert.equal(await backfillCardsForTalent('location'), 1); assert.equal(await backfillCardsForTalent('neither'), 0);
    assert.equal((await reconcileTalentCardDeliveries({ apply: true })).inserted, 0);
  } finally { f.restore(); }
});
test('cancelled, accepted and declined history is preserved', async () => {
  for (const status of ['accepted', 'rejected', 'pending']) {
    const f = fixture(); try {
      f.tables.subscription_card_recipients.push({ id: 'old', card_id: 'card', talent_user_id: 'language', status, cancelled_at: status === 'pending' ? '2026-01-01' : null });
      await reconcileTalentCardDeliveries({ apply: true });
      assert.equal(f.tables.subscription_card_recipients.filter((r) => r.talent_user_id === 'language').length, 1); assert.equal(f.tables.subscription_card_recipients[0].status, status);
    } finally { f.restore(); }
  }
});
test('manual, archived, expired and unowned cards are not swept', async () => {
  const f = fixture(); try {
    f.tables.subscription_cards = [{ ...f.card, id: 'manual', distribution: 'manual' }, { ...f.card, id: 'archive', archived_at: '2026-01-01' }, { ...f.card, id: 'expired', expires_at: '2000-01-01' }, { ...f.card, id: 'orphan', business_user_id: null }];
    assert.equal((await reconcileTalentCardDeliveries({ apply: true })).checked, 0); assert.equal(f.tables.subscription_card_recipients.length, 0);
  } finally { f.restore(); }
});
test('missing tiers, unapproved, inactive, deleted and blocked talents remain excluded', async () => {
  for (const patch of [{ tier: null }, { status: 'pending_review' }, { is_active: false }, { deleted_at: '2026-01-01' }]) {
    const f = fixture(); try { for (const p of f.profiles) Object.assign(p, patch); assert.equal((await reconcileTalentCardDeliveries({ apply: true })).inserted, 0); } finally { f.restore(); }
  }
  for (const patch of [{ suspended: true }, { blacklisted: true }, { is_active: false }]) {
    const f = fixture(); try { for (const u of f.users) Object.assign(u, patch); assert.equal((await reconcileTalentCardDeliveries({ apply: true })).inserted, 0); } finally { f.restore(); }
  }
});
test('concurrent webhook delivery does not drop the remaining recipients', async () => {
  const f = fixture(); try { f.conflict(); const r = await reconcileTalentCardDeliveries({ apply: true }); assert.equal(r.failed, 0); assert.equal(r.inserted, 1); assert.deepEqual(f.tables.subscription_card_recipients.map((r) => r.talent_user_id).sort(), ['language', 'location']); } finally { f.restore(); }
});
test('card pagination includes matches after the first thousand', async () => {
  const f = fixture(); try { f.tables.subscription_cards = Array.from({ length: 1001 }, (_, i) => ({ ...f.card, id: String(i), distribution: i === 1000 ? 'auto' : 'manual' })); assert.equal((await reconcileTalentCardDeliveries()).missing, 2); } finally { f.restore(); }
});
async function settled() { for (let i = 0; i < 25; i++) await new Promise<void>((r) => setImmediate(r)); }
test('tier and profile/account reactivation trigger actual catch-up delivery', async () => {
  const admin = await import('./admin.service.js');
  for (const change of ['tier', 'profile', 'account']) {
    const f = fixture(); try {
      if (change === 'tier') { f.profiles[0].tier = null; await admin.setProfileTier('p-language', 'pro', null); }
      else if (change === 'profile') { f.profiles[0].is_active = false; await admin.setProfileActive('p-language', true, { role: 'admin', id: null, name: 'Test' }); }
      else { f.users[0].is_active = false; await admin.setTalentUserActive('language', { is_active: true }); }
      await settled(); assert.ok(f.tables.subscription_card_recipients.some((r) => r.talent_user_id === 'language'), change);
    } finally { await settled(); f.restore(); }
  }
});

test('job catch-up keeps opt-in and rejected-applicant gates', async () => {
  const f = fixture();
  try {
    f.card.card_type = 'hiring';
    f.tables.talent_job_preferences = [{ talent_user_id: 'language', opted_in_at: '2026-01-01', preferred_districts: [] }];
    assert.equal((await reconcileTalentCardDeliveries()).missing, 1);
    f.users[0].jobs_pipeline_stage = 'rejected';
    assert.equal((await reconcileTalentCardDeliveries({ apply: true })).inserted, 0);
    f.users[0].jobs_pipeline_stage = 'pending';
    await reconcileTalentCardDeliveries({ apply: true });
    assert.deepEqual(f.tables.subscription_card_recipients.map((r) => r.talent_user_id), ['language']);
  } finally { f.restore(); }
});
