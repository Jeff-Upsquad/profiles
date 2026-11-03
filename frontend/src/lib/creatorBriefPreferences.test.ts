import assert from 'node:assert/strict';
import test from 'node:test';
import { toggleCreatorPreference } from './creatorBriefPreferences';

test('Any replaces specific creator preferences', () => {
  assert.deepEqual(toggleCreatorPreference(['Education', 'Technology'], 'Any'), ['Any']);
  assert.deepEqual(toggleCreatorPreference(['Stories'], 'Any'), ['Any']);
});

test('specific creator preferences replace Any and remain multi-select', () => {
  assert.deepEqual(toggleCreatorPreference(['Any'], 'Education'), ['Education']);
  assert.deepEqual(toggleCreatorPreference(['Education'], 'Technology'), ['Education', 'Technology']);
  assert.deepEqual(toggleCreatorPreference(['Education', 'Technology'], 'Education'), ['Technology']);
  assert.deepEqual(toggleCreatorPreference(['Any'], 'Any'), []);
});
