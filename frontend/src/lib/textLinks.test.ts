import assert from 'node:assert/strict';
import test from 'node:test';
import { splitTextLinks } from './textLinks';

test('links multiple URLs while preserving line breaks and punctuation', () => {
  const text = 'See (https://example.com/product).\nOr www.example.org/a?x=1&y=2!';
  const parts = splitTextLinks(text);
  assert.equal(parts.map(part => part.text).join(''), text);
  assert.deepEqual(parts.filter(part => part.href).map(part => part.href), ['https://example.com/product', 'https://www.example.org/a?x=1&y=2']);
});

test('balanced URL parentheses stay in the link', () => {
  const parts = splitTextLinks('Read https://example.com/wiki/Example_(topic).');
  assert.equal(parts.find(part => part.href)?.href, 'https://example.com/wiki/Example_(topic)');
});

test('unsafe schemes, credentialed links and malformed URLs stay plain text', () => {
  const text = 'javascript:alert(1) data:text/html,test https://user:pass@example.com https://invalid';
  const parts = splitTextLinks(text);
  assert.equal(parts.some(part => part.href), false);
  assert.equal(parts.map(part => part.text).join(''), text);
});
