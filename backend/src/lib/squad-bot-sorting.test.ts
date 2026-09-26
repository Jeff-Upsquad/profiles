import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SORT_ROLES, askRoleText, moveTool, sortingContext, sortingInstructions } from './squad-bot-sorting.js';

test('the move tool offers exactly the configured teams', () => {
  const tool = moveTool(DEFAULT_SORT_ROLES);
  assert.deepEqual(tool.input_schema.properties.team.enum, DEFAULT_SORT_ROLES.map((r) => r.key));
  assert.equal(new Set(DEFAULT_SORT_ROLES.map((r) => r.key)).size, DEFAULT_SORT_ROLES.length);
});

test('talent boards land on the landing-page stage; UpSquad hiring boards on New', () => {
  const by = Object.fromEntries(DEFAULT_SORT_ROLES.map((r) => [r.pipeline, r.stage]));
  assert.equal(by['Designers and Editors'], 'Share Landing Page');
  assert.equal(by['Accountants'], 'Share Landing Page');
  assert.equal(by['Sales content'], 'Share Landing Page');
  assert.equal(by['Recruiter'], 'New');
  assert.equal(by['Sales Hiring for upsquad'], 'New');
});

test('instructions list every team and send businesses to the team', () => {
  const text = sortingInstructions(DEFAULT_SORT_ROLES);
  for (const r of DEFAULT_SORT_ROLES) assert.ok(text.includes(`- ${r.key}: ${r.label}.`));
  assert.match(text, /business, brand or client/);
});

test('the first question uses a real first name only', () => {
  assert.match(askRoleText('Arun Kumar'), /^Hi Arun, thanks/);
  assert.match(askRoleText(null), /^Hi, thanks/);
  assert.match(askRoleText('+91 98765'), /^Hi, thanks/);
});

test('context says whether they already have an account', () => {
  assert.match(sortingContext({ name: 'Anu', accountCategories: null }), /No UpSquad account yet/);
  assert.match(sortingContext({ name: 'Anu', accountCategories: ['Designer'] }), /talent account for: Designer/);
});
