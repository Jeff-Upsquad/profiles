import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanDraft, draftRequest, draftSchema } from './knowledge-draft.js';

const keys = ['general', 'tech', 'designer', 'accountant'];

test('drafts that are not worth saving, or empty, never reach the queue', () => {
  assert.equal(cleanDraft({ worth_saving: false, why: 'personal', question: 'x?', answer: 'y', categories: ['general'] }, keys), null);
  assert.equal(cleanDraft({ worth_saving: true, why: '', question: 'Why?', answer: '', categories: ['general'] }, keys), null);
  assert.equal(cleanDraft({ worth_saving: true, why: '', question: 'Why?', answer: 'Because.', categories: ['nope'] }, keys), null);
});

test('a good draft is trimmed and keeps only allowed categories', () => {
  const d = cleanDraft({ worth_saving: true, why: 'policy', question: '  Can I pause my profile?  ', answer: ' Yes, from Settings. ', categories: ['general', 'general', 'bogus'] }, keys)!;
  assert.equal(d.question, 'Can I pause my profile?');
  assert.equal(d.answer, 'Yes, from Settings.');
  assert.deepEqual(d.categories, ['general']);
});

test('schema limits categories to the allowed keys; request lists them with the chat', () => {
  assert.deepEqual((draftSchema(keys) as any).properties.categories.items.enum, keys);
  const req = draftRequest({
    lines: [{ sender: 'talent', body: 'Can I pause?' }, { sender: 'staff', body: 'Yes, from Settings.' }],
    categories: [{ key: 'general', label: 'General' }],
    existingTitles: ['When do I get paid?'],
  });
  assert.match(req, /- general \(General\)/);
  assert.match(req, /- When do I get paid\?/);
  assert.match(req, /Talent: Can I pause\?\nUpSquad team: Yes, from Settings\./);
});
