import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchDomains, historyToMessages, introNote, isNewConversation, teamInstructions, knowledgeKeysFor, nextStep, talentContext, type TalentBrief } from './squad-bot-prompt.js';

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

test('WhatsApp leads: pipeline picks the knowledge and the landing page', async () => {
  const { formTypeForPipeline, prospectContext } = await import('./squad-bot-prompt.js');
  assert.equal(formTypeForPipeline('Designers and Editors'), 'creative');
  assert.equal(formTypeForPipeline('Accountants'), 'accountant');
  assert.equal(formTypeForPipeline('Jobs Candidates'), null);
  const ctx = prospectContext({ name: 'Arun', pipelineName: 'Accountants' });
  assert.match(ctx, /NOT signed up/);
  assert.match(ctx, /partner-program\/accountant/);
});

test('introduce only at the start of a conversation or after a long gap', () => {
  const at = (h: number) => new Date(Date.UTC(2026, 8, 1) + h * 3600_000).toISOString();
  // First message ever (or only talent messages so far) → introduce.
  assert.equal(isNewConversation([{ sender: 'talent', body: 'Hi', created_at: at(0) }]), true);
  assert.equal(isNewConversation([
    { sender: 'talent', body: 'Hi', created_at: at(0) },
    { sender: 'talent', body: 'anyone?', created_at: at(1) },
  ]), true);
  // Ongoing chat → don't.
  const ongoing = [
    { sender: 'talent' as const, body: 'Hi', created_at: at(0) },
    { sender: 'bot' as const, body: "Hi, I'm Squad Bot", created_at: at(0) },
    { sender: 'talent' as const, body: 'How do I upload?', created_at: at(2) },
  ];
  assert.equal(isNewConversation(ongoing), false);
  // Back after days → introduce again. System lines don't count.
  assert.equal(isNewConversation([
    ...ongoing.slice(0, 2),
    { sender: 'system' as const, body: 'Handed to the team', created_at: at(70) },
    { sender: 'talent' as const, body: 'Hello again', created_at: at(80) },
  ]), true);
  assert.match(introNote(true), /introduction/);
  assert.match(introNote(false), /do not introduce/);
});

test('team instructions stay out of the turns and go to the system prompt', () => {
  const lines = [
    { sender: 'talent' as const, body: 'When is the webinar?' },
    { sender: 'bot' as const, body: 'Let me get the team.' },
    { sender: 'instruction' as const, body: 'Webinar details are at https://www.upsquadconnect.com/webinar' },
  ];
  assert.deepEqual(historyToMessages(lines).map((m) => m.role), ['user', 'assistant']);
  assert.match(teamInstructions(lines), /Instructions from the UpSquad team[\s\S]*- Webinar details/);
  assert.equal(teamInstructions(lines.slice(0, 2)), '');
});

test('web fetch is limited to UpSquad plus sites the team linked', () => {
  assert.deepEqual(fetchDomains([]), ['upsquadconnect.com']);
  assert.deepEqual(
    fetchDomains(['See https://docs.google.com/document/d/abc and https://www.upsquadconnect.com/x', 'http://127.0.0.1/x http://localhost:3000']),
    ['docs.google.com', 'upsquadconnect.com'],
  );
});
