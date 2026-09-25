import assert from 'node:assert/strict';
import test from 'node:test';
import { flattenPages, tiptapToText } from './knowledge-text.js';

const doc = (...content: unknown[]) => ({ type: 'doc', content });
const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

test('tiptap doc flattens to one line per paragraph, bullets for list items', () => {
  const text = tiptapToText(doc(
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Fees' }] },
    p('Joining is free.'),
    { type: 'bulletList', content: [
      { type: 'listItem', content: [p('₹3,000 up to ₹20,000')] },
      { type: 'listItem', content: [p('₹5,000 above ₹20,000')] },
    ] },
    { type: 'paragraph', content: [] },
  ));
  assert.equal(text, 'Fees\nJoining is free.\n- ₹3,000 up to ₹20,000\n- ₹5,000 above ₹20,000');
});

test('a post keeps title + body without repeating its own page title', () => {
  const out = flattenPages('When do I get paid?', null, [
    { id: 'a', parent_id: null, title: 'When do I get paid?', position: 0, blocks: [
      { id: 'b', type: 'text', position: 0, text_content: doc(p('Between the 5th and 15th.')) },
    ] },
  ] as any);
  assert.equal(out, 'When do I get paid?\n\nBetween the 5th and 15th.');
});

test('nested pages come out in tree order with headings', () => {
  const out = flattenPages('App help', 'Common fixes', [
    { id: 'c', parent_id: 'a', title: 'Reset password', position: 0, blocks: [] },
    { id: 'a', parent_id: null, title: 'Login', position: 0, blocks: [
      { id: 'v', type: 'video_embed', position: 0, caption: 'Walkthrough' },
    ] },
    { id: 'b', parent_id: null, title: 'Uploads', position: 1, blocks: [] },
  ] as any);
  assert.equal(out, 'App help\n\nCommon fixes\n\n## Login\n\n[video_embed] Walkthrough\n\n### Reset password\n\n## Uploads');
});

test('numbered lists keep their numbers', () => {
  const text = tiptapToText(doc({ type: 'orderedList', content: [
    { type: 'listItem', content: [p('Sign up.')] },
    { type: 'listItem', content: [p('Wait for approval.')] },
  ] }));
  assert.equal(text, '1. Sign up.\n2. Wait for approval.');
});
