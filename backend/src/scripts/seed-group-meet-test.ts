import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';

const BUSINESS_EMAIL = 'jeff@tagconnects.in';
const TEST_PASSWORD = 'Demo@1234';
const EXTERNAL_ID = 'test-group-meet-jeff-tagconnects';
const TEST_DOMAIN = 'demo.squadhire.test';

const talentSpecs = [
  {
    slug: 'groupmeet-aanya',
    name: 'Aanya Menon',
    location: 'Kochi, Kerala',
    tier: 'Top Talents',
    amount: 52_000,
    offerStatus: 'accepted',
    lastActor: 'talent',
  },
  {
    slug: 'groupmeet-dev',
    name: 'Dev Malhotra',
    location: 'Bengaluru, Karnataka',
    tier: 'pro',
    amount: 48_000,
    offerStatus: 'pending_business',
    lastActor: 'talent',
  },
  {
    slug: 'groupmeet-isha',
    name: 'Isha Rao',
    location: 'Mumbai, Maharashtra',
    tier: 'pro',
    amount: 55_000,
    offerStatus: 'pending_talent',
    lastActor: 'business',
  },
  {
    slug: 'groupmeet-kabir',
    name: 'Kabir Thomas',
    location: 'Chennai, Tamil Nadu',
    tier: 'junior',
    amount: null,
    offerStatus: null,
    lastActor: null,
  },
] as const;

function fail(scope: string, error: { message?: string } | null) {
  throw new Error(`${scope}: ${error?.message || 'unknown error'}`);
}

async function findAuthUser(email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`list users page ${page}`, error);
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function ensureTalent(
  spec: (typeof talentSpecs)[number],
  categoryId: string,
) {
  const email = `${spec.slug}@${TEST_DOMAIN}`;
  let authUser = await findAuthUser(email);
  if (!authUser) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'talent', full_name: spec.name, test_fixture: 'group-meet' },
    });
    if (error || !data.user) fail(`create ${email}`, error);
    authUser = data.user;
  } else {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'talent', full_name: spec.name, test_fixture: 'group-meet' },
    });
    if (error) fail(`reset ${email}`, error);
  }

  if (!authUser) throw new Error(`Could not provision ${email}`);
  const userId = authUser.id;
  const { error: userError } = await supabaseAdmin.from('talent_users').upsert({
    id: userId,
    full_name: spec.name,
    current_location: spec.location,
    native_place: spec.location.split(',')[0],
    languages_spoken: [
      { language: 'English', proficiency: 'Fluent' },
      { language: 'Hindi', proficiency: 'Fluent' },
    ],
    approval_status: 'approved',
    approved_at: new Date().toISOString(),
    is_active: true,
    onboarding_completed: true,
  });
  if (userError) fail(`upsert talent ${email}`, userError);

  const { error: basicError } = await supabaseAdmin.from('talent_profiles_basic').upsert({
    talent_user_id: userId,
    current_district: spec.location.split(',')[0],
    city: spec.location.split(',')[0],
    state: spec.location.split(',')[1]?.trim(),
    country: 'India',
    availability: ['full_time', 'part_time'],
    job_type: ['remote', 'hybrid'],
    expected_salary_full_time: spec.amount ?? 35_000,
    expected_salary_part_time: Math.round((spec.amount ?? 35_000) * 0.6),
    employment_type: ['salary', 'freelance'],
  }, { onConflict: 'talent_user_id' });
  if (basicError) fail(`upsert basic profile ${email}`, basicError);

  const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
    .from('talent_profiles')
    .select('id')
    .eq('talent_user_id', userId)
    .eq('category_id', categoryId)
    .is('deleted_at', null)
    .maybeSingle();
  if (profileLookupError) fail(`lookup profile ${email}`, profileLookupError);

  const profileValues = {
    talent_user_id: userId,
    category_id: categoryId,
    status: 'approved',
    is_active: true,
    is_ghost: false,
    tier: spec.tier,
    reviewed_at: new Date().toISOString(),
    field_data: {
      summary: `${spec.name} is a test creative specialist for the Group Meet workflow.`,
      _skills: [
        { skill: 'Social Media Design', level: 4 },
        { skill: 'Video Editing', level: 4 },
        { skill: 'Motion Graphics', level: 3 },
      ],
      _tools: [
        { name: 'Figma', level: 4 },
        { name: 'Adobe Premiere Pro', level: 4 },
      ],
      _ai_tools: [{ name: 'Adobe Firefly', level: 3 }],
      test_fixture: 'group-meet',
    },
  };

  let profileId = existingProfile?.id as string | undefined;
  if (profileId) {
    const { error } = await supabaseAdmin.from('talent_profiles').update(profileValues).eq('id', profileId);
    if (error) fail(`update profile ${email}`, error);
  } else {
    profileId = randomUUID();
    const { error } = await supabaseAdmin.from('talent_profiles').insert({ id: profileId, ...profileValues });
    if (error) fail(`create profile ${email}`, error);
  }

  return { ...spec, email, userId, profileId };
}

async function main() {
  const { data: business, error: businessError } = await supabaseAdmin
    .from('business_users')
    .select('id, company_name, contact_email')
    .eq('contact_email', BUSINESS_EMAIL)
    .eq('is_active', true)
    .maybeSingle();
  if (businessError) fail('find business', businessError);
  if (!business) throw new Error(`Active business not found: ${BUSINESS_EMAIL}`);

  const { data: category, error: categoryError } = await supabaseAdmin
    .from('categories')
    .select('id, name, slug')
    .eq('slug', 'designer-editor')
    .eq('is_active', true)
    .maybeSingle();
  if (categoryError) fail('find category', categoryError);
  if (!category) throw new Error('The designer-editor category is not available.');

  // Exact fixture cleanup makes the script safe to rerun without touching any
  // real cards, meetings, profiles, or talent accounts.
  const { error: cleanupError } = await supabaseAdmin
    .from('subscription_cards')
    .delete()
    .eq('external_id', EXTERNAL_ID);
  if (cleanupError) fail('replace prior test card', cleanupError);

  const talents = [];
  for (const spec of talentSpecs) talents.push(await ensureTalent(spec, category.id));

  const cardId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const { error: cardError } = await supabaseAdmin.from('subscription_cards').insert({
    id: cardId,
    external_id: EXTERNAL_ID,
    card_type: 'subscription',
    status: 'active',
    distribution: 'broadcast',
    source: 'custom',
    business_user_id: business.id,
    business_email: BUSINESS_EMAIL,
    is_secondary: false,
    content: {
      title: '[TEST] Creative Team · Group Meet',
      brand_name: business.company_name || 'Tag Connect',
      customer_company: business.company_name || 'Tag Connect',
      description: 'Test subscription card for shortlisting, bidding, and scheduling a Group Meet with multiple talents.',
      business_nature: 'Marketing & Creative Services',
      plan_name: 'Creative Squad · Monthly',
      plan_tier: 'Pro',
      subscription_name: 'Designer + Editor',
      hours_label: '4 hrs/day',
      capacity_label: '4 shortlisted talents',
      working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      customer_monthly_price: 50_000,
      partner_monthly_price: 42_000,
      margin_type: 'fixed',
      margin_value: 8_000,
      margin_amount: 8_000,
      currency: 'INR',
      price_label: '₹50,000 / month',
      target_languages: ['English', 'Hindi'],
      additional_requirements: ['Video Editing', 'Social Media Design', 'Figma'],
      test_fixture: 'group-meet',
    },
    match_rules: {
      category_ids: [category.id],
      target_tiers: ['junior', 'pro', 'Top Talents'],
    },
    published_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
  if (cardError) fail('create test card', cardError);

  for (const talent of talents) {
    const recipientId = randomUUID();
    const { error: recipientError } = await supabaseAdmin.from('subscription_card_recipients').insert({
      id: recipientId,
      card_id: cardId,
      talent_user_id: talent.userId,
      status: 'accepted',
      responded_at: now.toISOString(),
      business_review_status: 'shortlisted',
      business_reviewed_at: now.toISOString(),
    });
    if (recipientError) fail(`create recipient ${talent.email}`, recipientError);

    if (talent.amount && talent.offerStatus && talent.lastActor) {
      const offerId = randomUUID();
      const { error: offerError } = await supabaseAdmin.from('assignment_offers').insert({
        id: offerId,
        card_id: cardId,
        recipient_id: recipientId,
        talent_user_id: talent.userId,
        business_user_id: business.id,
        pricing_mode: 'priced',
        current_amount: {
          amount: talent.amount,
          currency: 'INR',
          period: 'per_month',
          side: talent.lastActor,
        },
        status: talent.offerStatus,
        opened_by: 'talent',
        last_actor_side: talent.lastActor,
        responded_at: now.toISOString(),
      });
      if (offerError) fail(`create offer ${talent.email}`, offerError);

      const { error: eventError } = await supabaseAdmin.from('assignment_offer_events').insert({
        offer_id: offerId,
        actor_type: talent.lastActor,
        actor_id: talent.lastActor === 'talent' ? talent.userId : business.id,
        action: talent.offerStatus === 'accepted' ? 'accepted' : 'countered',
        amount: { amount: talent.amount, currency: 'INR', period: 'per_month' },
        note: '[TEST] Seeded Group Meet bid state',
      });
      if (eventError) fail(`create offer event ${talent.email}`, eventError);
    }
  }

  console.log(JSON.stringify({
    cardId,
    cardTitle: '[TEST] Creative Team · Group Meet',
    businessEmail: BUSINESS_EMAIL,
    talentPassword: TEST_PASSWORD,
    talents: talents.map(({ name, email, offerStatus, amount }) => ({ name, email, offerStatus, amount })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
