import assert from 'node:assert/strict';
import test from 'node:test';
import { adoptLegacyPages, normalizeTitle } from './training-page-adoption.js';

const incoming = (id: string, parent_id: string | null, title: string) => ({ id, parent_id, title });
const legacy = (id: string, parent_page_id: string | null, title: string) => ({
  id,
  parent_page_id,
  title,
});

test('pairs a section and its lesson that differ only by case', () => {
  // The shape the live Onboarding Basics course is actually in.
  const map = new Map<string, string>();
  const adopted = adoptLegacyPages(
    [incoming('S-root', null, 'Basic Profile'), incoming('S-child', 'S-root', 'Basic profile')],
    [legacy('L-root', null, 'Basic Profile'), legacy('L-child', 'L-root', 'Basic profile')],
    map,
  );
  assert.equal(map.get('S-root'), 'L-root');
  assert.equal(map.get('S-child'), 'L-child');
  assert.equal(adopted.length, 2);
});

test('ignores case and stray whitespace in titles', () => {
  const map = new Map<string, string>();
  adoptLegacyPages(
    [incoming('S1', null, 'onboarding  training')],
    [legacy('L1', null, 'Onboarding Training ')],
    map,
  );
  assert.equal(map.get('S1'), 'L1');
  assert.equal(normalizeTitle(' Basic   Profile '), 'basic profile');
});

test('leaves genuinely new pages to be inserted', () => {
  const map = new Map<string, string>();
  const adopted = adoptLegacyPages(
    [incoming('S1', null, 'Payouts')],
    [legacy('L1', null, 'Basic Profile')],
    map,
  );
  assert.deepEqual(adopted, []);
  assert.equal(map.size, 0);
});

test('skips a subtree whose parent found no partner', () => {
  const map = new Map<string, string>();
  const adopted = adoptLegacyPages(
    [incoming('S-root', null, 'New section'), incoming('S-child', 'S-root', 'Intro')],
    [legacy('L-child', 'L-root', 'Intro')],
    map,
  );
  assert.deepEqual(adopted, []);
});

test('consumes same-titled siblings one each', () => {
  const map = new Map<string, string>();
  const adopted = adoptLegacyPages(
    [incoming('S1', null, 'Intro'), incoming('S2', null, 'Intro')],
    [legacy('L1', null, 'Intro'), legacy('L2', null, 'Intro')],
    map,
  );
  assert.equal(new Set(adopted).size, 2);
});

test('is a no-op once every page is already linked', () => {
  assert.deepEqual(adoptLegacyPages([incoming('S1', null, 'Intro')], [], new Map()), []);
});
