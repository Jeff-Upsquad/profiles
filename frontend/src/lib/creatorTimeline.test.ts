import assert from 'node:assert/strict';
import test from 'node:test';
import { creatorTimelineFields, isAsSoonAsPossible } from './creatorTimeline';
import { connectBriefSchema } from '../../../backend/src/validators/connect-brief.validators';

test('ASAP clears both dates and survives brief validation for assignments and subscriptions', () => {
  const fields = creatorTimelineFields({ asSoonAsPossible: true, startDate: '2026-11-12', deliveryDate: '2026-11-15' });
  for (const card_type of ['assignment', 'subscription'] as const) {
    const brief = connectBriefSchema.parse({
      service_types: ['social_media_creator'], brand_name: 'Brand', business_nature: 'Education',
      business_note: 'Online courses', languages: ['English'], working_days: card_type === 'subscription' ? ['Mon'] : [], card_type,
      role_requirements: { social_media_creator: {
        note: 'Launch our campaign', start_date: fields.start_date, deadline: fields.deadline,
        additional_requirements: { ...fields.additional, channels: ['Instagram'], creator_audience: ['Education creators in India'], deliverables: ['One reel'], usage_rights: ['Not specified'] },
      } },
    });
    const role = brief.role_requirements!.social_media_creator!;
    assert.equal(role.start_date, '');
    assert.equal(role.deadline, '');
    assert.ok(isAsSoonAsPossible(role.additional_requirements));
  }
});

test('dated briefs keep their dates and do not imply ASAP when dates are absent', () => {
  const fields = creatorTimelineFields({ asSoonAsPossible: false, startDate: '2026-11-12', deliveryDate: '2026-11-15' });
  assert.equal(fields.start_date, '2026-11-12');
  assert.equal(fields.deadline, '2026-11-15');
  assert.equal(isAsSoonAsPossible(fields.additional), false);
  assert.equal(isAsSoonAsPossible(null), false);
  assert.equal(isAsSoonAsPossible({}), false);
});
