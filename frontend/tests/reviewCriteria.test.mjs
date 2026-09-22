import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateRecipientMatches } from '../src/lib/reviewCriteria.ts';

const card = {
  categories: [{ name: 'Video Editor' }],
  target_country_names: ['India'],
  target_regions: [],
  target_languages: ['English', 'Tamil', 'Malayalam'],
  additional_requirements: null,
};

const talent = {
  category: { name: 'Video Editor' },
  country: 'India',
  state: 'Kerala',
  languages_spoken: [{ language: 'English' }],
  skill_tool_names: [],
};

test('country-only card keeps a language match abroad in Partially Matching', () => {
  const result = evaluateRecipientMatches({ ...talent, country: 'UAE' }, card);
  assert.equal(result.isAllMatch, false);
  assert.equal(result.items.find((item) => item.key === 'country')?.matches, false);
  assert.equal(result.items.find((item) => item.key === 'language')?.matches, true);
});

test('country-only card places an in-country language match in All Matching', () => {
  const result = evaluateRecipientMatches(talent, card);
  assert.equal(result.isAllMatch, true);
  assert.equal(result.items.find((item) => item.key === 'country')?.matches, true);
});

test('a region narrows its country, while another selected country stays country-wide', () => {
  const targeted = {
    ...card,
    target_country_names: ['India', 'UAE'],
    target_regions: [{ country_name: 'India', region: 'Kerala' }],
  };
  assert.equal(evaluateRecipientMatches({ ...talent, state: 'Maharashtra' }, targeted).isAllMatch, false);
  assert.equal(evaluateRecipientMatches({ ...talent, country: 'UAE', state: 'Dubai' }, targeted).isAllMatch, true);
});

test('missing optional tools move a broadcast-eligible talent to Partially Matching', () => {
  const result = evaluateRecipientMatches(talent, {
    ...card,
    additional_requirements: { tools: ['Premiere Pro'] },
  });
  assert.equal(result.isAllMatch, false);
  assert.deepEqual(result.items.filter((item) => !item.matches).map((item) => item.label), ['Premiere Pro']);
  assert.equal(result.items.find((item) => item.label === 'Premiere Pro')?.optional, true);
});
