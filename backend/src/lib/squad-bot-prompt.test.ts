import assert from 'node:assert/strict';
import test from 'node:test';
import { historyToMessages, knowledgeKeysFor, nextStep, talentContext, type TalentBrief } from './squad-bot-prompt.js';

const base: TalentBrief = {
  first_name: 'Anu', categories: ['Designer'], wants_jobs: false, partner_approval: 'approved',
  application_cancelled: false, account_inactive: false, onboarding_course_done: true, basic_missing: [],
  job_profiles: [], portfolio_required: true, portfolio_items: 0, app_downloaded: false, webinar_attended: false,
};

test('knowledge keys: everyone gets general + tech, plus their category slugs', () => {
  assert.deepEqual(knowledgeKeysFor(['creative'], []), ['designer', 'designer-editor', 'general', 'tech', 'video-editor']);
  assert.deepEqual(knowledgeKeysFor(['accountant', 'jobs'], ['accountant']), ['accountant', 'general', 'tech']);
});

test('next step follows the onboarding order', () => {
  assert.match(nextStep({ ...base, partner_approval: 'pending' }), /approve/);
  assert.match(nextStep({ ...base, onboarding_course_done: false }), /onboarding course/);
  assert.match(nextStep({ ...base, basic_missing: ['Education', 'Profile photo'] }), /Education, Profile photo/);
  assert.match(nextStep(base), /at least 10 portfolio items \(has 0\)/);
  assert.match(nextStep({ ...base, portfolio_required: false }), /create the job profile and submit/);
  assert.match(
    nextStep({ ...base, job_profiles: [{ category: 'Designer', status: 'changes_requested', requested_changes: ['Add portfolio'], portfolio_items: 3 }] }),
    /requested changes on the Designer profile/,
  );
  assert.match(nextStep({ ...base, job_profiles: [{ category: 'Designer', status: 'approved', requested_changes: [], portfolio_items: 12 }] }), /Partner app/);
  assert.match(nextStep({ ...base, application_cancelled: true }), /hand off/);
});

test('talent context names what is missing', () => {
  const ctx = talentContext({ ...base, basic_missing: ['Education'] });
  assert.match(ctx, /Basic profile: missing Education/);
  assert.match(ctx, /Next step: finish the basic profile: Education/);
});

test('history maps to alternating turns, starting with the talent', () => {
  const msgs = historyToMessages([
    { sender: 'bot', body: 'Hi!' },
    { sender: 'talent', body: 'When do I get paid?' },
    { sender: 'talent', body: 'Hello?' },
    { sender: 'system', body: 'Handed to the team' },
    { sender: 'staff', body: 'Between the 5th and 15th.' },
  ]);
  assert.deepEqual(msgs, [
    { role: 'user', content: 'When do I get paid?\n\nHello?' },
    { role: 'assistant', content: '[Reply from the UpSquad team] Between the 5th and 15th.' },
  ]);
});
