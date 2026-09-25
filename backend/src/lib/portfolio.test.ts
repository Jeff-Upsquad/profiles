import assert from 'node:assert/strict';
import test from 'node:test';
import {
  categoryHasPortfolio,
  formTypeHasPortfolio,
  portfolioRequiredFor,
} from '../../../shared/src/portfolio.js';

test('sales and accountant have no portfolio; designers and editors do', () => {
  assert.equal(categoryHasPortfolio('accountant'), false);
  assert.equal(categoryHasPortfolio('sales'), false);
  assert.equal(categoryHasPortfolio('designer'), true);
  assert.equal(categoryHasPortfolio('video-editor'), true);
  assert.equal(formTypeHasPortfolio('accountant'), false);
  assert.equal(formTypeHasPortfolio('creative'), true);
});

test('a talent owes a portfolio only when one of their categories has it', () => {
  assert.equal(portfolioRequiredFor(['accountant']), false);
  assert.equal(portfolioRequiredFor(['accountant', 'jobs']), false);
  assert.equal(portfolioRequiredFor(['accountant', 'creative']), true);
  assert.equal(portfolioRequiredFor(['jobs']), true); // category unknown
  assert.equal(portfolioRequiredFor([]), true);
});
