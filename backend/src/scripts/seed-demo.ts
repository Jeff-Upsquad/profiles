/**
 * seed-demo.ts — Populate a DEMO Supabase project with dummy data for the
 * Talent + Business web modules so the app can be explored and recorded
 * for tutorial videos.
 *
 *   ⚠️  ONLY run this against a DEDICATED demo project. It is destructive:
 *       it wipes and recreates everything tagged with the demo markers
 *       (emails @demo.squadhire.test, subscription cards `demo-*`,
 *       rows whose title/notes start with "[DEMO]").
 *
 * It talks to whatever Supabase project backend/.env points at, using the
 * service-role client (bypasses RLS) and the Auth admin API — the exact
 * same path the real app uses to create users. Integration secrets
 * (SquadHub / SquadCRM / WhatsApp / push) are left unset in the demo env,
 * so NO external side-effects fire while seeding.
 *
 * Run:  cd backend && npm run seed:demo
 */
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';

const DEMO_DOMAIN = 'demo.squadhire.test';
const DEMO_PASSWORD = 'Demo@1234';
const uuid = () => globalThis.crypto.randomUUID();
const now = () => new Date().toISOString();
const daysFromNow = (d: number) => new Date(Date.now() + d * 864e5).toISOString();

// A real, safe placeholder Loom URL. Replace with your own recordings later
// from the admin panel (Training / How-it-works).
const DEMO_LOOM = 'https://www.loom.com/share/0e9b8a2e9b9b4f3c8a1b2c3d4e5f6071';

function log(step: string) {
  // eslint-disable-next-line no-console
  console.log(`  • ${step}`);
}

// Insert helper — throws loudly on any DB error so a bad column never fails
// silently and leaves a half-seeded demo.
async function ins(table: string, rows: Record<string, unknown> | Record<string, unknown>[]) {
  const { error } = await supabaseAdmin.from(table).insert(rows as never);
  if (error) throw new Error(`insert ${table}: ${error.message}`);
}
async function ups(
  table: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
  onConflict: string,
) {
  const { error } = await supabaseAdmin.from(table).upsert(rows as never, { onConflict });
  if (error) throw new Error(`upsert ${table}: ${error.message}`);
}

// ───────────────────────────────────────────────────────────────────────────
// Safety guard — refuse to run against an obviously-production project.
// ───────────────────────────────────────────────────────────────────────────
function assertNotProd() {
  const url = env.SUPABASE_URL.toLowerCase();
  const force = process.env.SEED_DEMO_FORCE === 'true';
  if (force) return;

  // HARD GATE: this is a destructive wipe-and-seed. It may only run against the
  // explicitly-declared demo project. DEMO_REF lives in the demo worktree's
  // backend/.env but NOT in production's env, so this refuses to run on prod
  // even though the script ships in `main`.
  const demoRef = process.env.DEMO_REF?.trim().toLowerCase();
  if (!demoRef) {
    throw new Error(
      'Refusing to seed: DEMO_REF is not set. This destructive wipe/seed only ' +
        'runs against the declared demo project. Set DEMO_REF (demo project ref) ' +
        'in backend/.env, or SEED_DEMO_FORCE=true to override.',
    );
  }
  if (!url.includes(demoRef)) {
    throw new Error(
      `Refusing to seed: SUPABASE_URL (${env.SUPABASE_URL}) does not contain ` +
        `DEMO_REF (${demoRef}). Point backend/.env at the demo project.`,
    );
  }

  // Extra denylist: refuse if SUPABASE_URL matches an explicitly-named prod URL.
  const prod = process.env.PROD_SUPABASE_URL?.trim().toLowerCase();
  if (prod && url === prod) {
    throw new Error('SUPABASE_URL matches PROD_SUPABASE_URL — refusing.');
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Wipe — remove anything carrying a demo marker so re-runs are clean.
// ───────────────────────────────────────────────────────────────────────────
async function wipe() {
  log('Wiping previous demo data…');

  // 1. Delete demo auth users (talent + admin). Cascades to talent_users,
  //    talent_profiles, talent_profiles_basic, business_shared_profiles (talent
  //    side), subscription_card_recipients, notification_recipients, shortlists
  //    and interest_requests via ON DELETE CASCADE.
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const demoUsers = data.users.filter((u) => (u.email ?? '').endsWith(`@${DEMO_DOMAIN}`));
    for (const u of demoUsers) await supabaseAdmin.auth.admin.deleteUser(u.id);
    if (data.users.length < 1000) break;
    page += 1;
  }

  // 2. Demo subscription cards (cascades recipients), then businesses (cascades
  //    sessions, category subscriptions, shared-profile rows).
  await supabaseAdmin.from('subscription_cards').delete().like('external_id', 'demo-%');
  await supabaseAdmin.from('business_users').delete().like('contact_email', `%@${DEMO_DOMAIN}`);

  // 3. Remaining marker-tagged rows.
  await supabaseAdmin.from('talent_access_grants').delete().like('notes', '[DEMO]%');
  await supabaseAdmin.from('invitations').delete().like('email', `%@${DEMO_DOMAIN}`);
  await supabaseAdmin.from('notifications').delete().like('title', '[DEMO]%');
  await supabaseAdmin.from('training_chapters').delete().like('title', '[DEMO]%');
  await supabaseAdmin.from('training_courses').delete().like('title', '[DEMO]%');
}

// ───────────────────────────────────────────────────────────────────────────
// Categories + per-category profile-form templates
// ───────────────────────────────────────────────────────────────────────────
async function upsertCategory(name: string, slug: string, description: string, sort: number) {
  await ups('categories', { name, slug, description, is_active: true, sort_order: sort }, 'slug');
  const { data, error } = await supabaseAdmin.from('categories').select('id').eq('slug', slug).single();
  if (error) throw new Error(`fetch category ${slug}: ${error.message}`);
  return data.id as string;
}

async function seedTemplate(
  categoryId: string,
  skills: string[],
  tools: Array<{ name: string; group: string }>,
  aiTools: string[],
  portfolioGenres: string[] = [],
) {
  await ups(
    'template_skill_sets',
    skills.map((name, i) => ({ category_id: categoryId, name, sort_order: i * 10 })),
    'category_id,name',
  );
  await ups(
    'template_tools',
    tools.map((t, i) => ({ category_id: categoryId, name: t.name, group: t.group, sort_order: i * 10 })),
    'category_id,name',
  );
  await ups(
    'template_ai_tools',
    aiTools.map((name, i) => ({ category_id: categoryId, name, sort_order: i * 10 })),
    'category_id,name',
  );
  if (portfolioGenres.length) {
    await ups(
      'template_categories',
      portfolioGenres.map((name, i) => ({ category_id: categoryId, name, sort_order: i * 10 })),
      'category_id,name',
    );
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Talent accounts (auth user + talent_users + basic profile + talent_profile)
// ───────────────────────────────────────────────────────────────────────────
type TalentSpec = {
  slug: string; // email local-part
  fullName: string;
  gender: 'male' | 'female' | 'other';
  age: number;
  district: string;
  state: string;
  languages: Array<{ language: string; proficiency: string }>;
  categorySlug: string;
  tier: 'junior' | 'pro' | 'Top Talents';
  skills: string[];
  tools: string[];
  aiTools: string[];
  salaryFullTime: number;
  // Optional lifecycle overrides (default: a fully-approved, live profile).
  profileStatus?: 'approved' | 'pending_review' | 'draft' | 'rejected';
  talentApproval?: 'approved' | 'pending';
  rejectionReason?: string;
};

async function createTalent(spec: TalentSpec, categoryIdBySlug: Record<string, string>) {
  const email = `talent.${spec.slug}@${DEMO_DOMAIN}`;
  const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { role: 'talent', full_name: spec.fullName },
  });
  if (authErr || !created.user) throw new Error(`createUser ${email}: ${authErr?.message}`);
  const id = created.user.id;

  const talentApproval = spec.talentApproval ?? 'approved';
  const phone = `+91 9${Math.floor(100000000 + Math.random() * 899999999)}`;
  await ins('talent_users', {
    id,
    full_name: spec.fullName,
    phone,
    age: spec.age,
    gender: spec.gender,
    native_place: spec.district,
    current_location: `${spec.district}, ${spec.state}`,
    languages_spoken: spec.languages,
    approval_status: talentApproval,
    approved_at: talentApproval === 'approved' ? now() : null,
    is_active: true,
    onboarding_completed: true,
  });

  await ins('talent_profiles_basic', {
    talent_user_id: id,
    current_district: spec.district,
    city: spec.district,
    state: spec.state,
    country: 'India',
    availability: ['full_time', 'part_time'],
    job_type: ['remote', 'office'],
    expected_salary_full_time: spec.salaryFullTime,
    expected_salary_part_time: Math.round(spec.salaryFullTime * 0.6),
    employment_type: ['salary', 'freelance'],
  });

  const fieldData = {
    summary: `${spec.fullName} — ${spec.tier} ${spec.categorySlug.replace('-', ' + ')} with hands-on experience.`,
    _skills: spec.skills.map((skill, i) => ({ skill, level: 3 + (i % 3) })),
    _tools: spec.tools.map((name, i) => ({ name, level: 3 + (i % 3) })),
    _ai_tools: spec.aiTools.map((name, i) => ({ name, level: 2 + (i % 4) })),
  };

  const profileStatus = spec.profileStatus ?? 'approved';
  const reviewed = profileStatus === 'approved' || profileStatus === 'rejected';
  const profileId = uuid();
  await ins('talent_profiles', {
    id: profileId,
    talent_user_id: id,
    category_id: categoryIdBySlug[spec.categorySlug],
    status: profileStatus,
    is_active: true,
    tier: profileStatus === 'approved' ? spec.tier : null,
    reviewed_at: reviewed ? now() : null,
    rejection_reason: profileStatus === 'rejected' ? (spec.rejectionReason ?? null) : null,
    field_data: fieldData,
  });

  return { id, email, profileId, categorySlug: spec.categorySlug, fullName: spec.fullName, profileStatus };
}

// ───────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────
async function main() {
  // eslint-disable-next-line no-console
  console.log(`\n🌱 Seeding DEMO data into ${env.SUPABASE_URL}\n`);
  assertNotProd();
  await wipe();

  // Admin auth user — owns *_by references and lets you log into /admin.
  log('Creating demo admin…');
  const adminEmail = `admin@${DEMO_DOMAIN}`;
  const { data: adminCreated, error: adminErr } = await supabaseAdmin.auth.admin.createUser({
    email: adminEmail,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { role: 'admin', full_name: 'Demo Admin' },
  });
  if (adminErr || !adminCreated.user) throw new Error(`admin createUser: ${adminErr?.message}`);
  const adminId = adminCreated.user.id;

  // Make live talent signups auto-approve (smoother demos / tutorials).
  await ups('admin_settings', { key: 'auto_approve_signups', value: true }, 'key');

  // Categories + templates
  log('Seeding categories + profile-form templates…');
  const accountantId = await upsertCategory(
    'Accountant',
    'accountant',
    'Accounting, bookkeeping, tax & compliance professionals.',
    0,
  );
  const designerId = await upsertCategory(
    'Designer + Editor',
    'designer-editor',
    'Talents skilled in both graphic design and video editing.',
    10,
  );
  const categoryIdBySlug: Record<string, string> = {
    accountant: accountantId,
    'designer-editor': designerId,
  };

  await seedTemplate(
    accountantId,
    ['GST Filing', 'TDS Calculations and Filing', 'Bookkeeping', 'Bank Reconciliation', 'Payroll Processing', 'ITR Filing Business', 'Financial Statement Preparation', 'MIS Reporting'],
    [
      { name: 'Tally', group: 'Accounting Software' },
      { name: 'Zohobooks', group: 'Accounting Software' },
      { name: 'QuickBooks', group: 'Accounting Software' },
      { name: 'Microsoft Excel', group: 'Other Tools' },
      { name: 'Google Sheets', group: 'Other Tools' },
    ],
    ['ChatGPT', 'Claude', 'Microsoft Copilot', 'Dext'],
  );
  await seedTemplate(
    designerId,
    ['Video Editing', 'Color Grading', 'Motion Graphics', 'Graphic Design', 'Sound Design', 'Thumbnail Design'],
    [
      { name: 'Adobe Premiere Pro', group: 'Video' },
      { name: 'After Effects', group: 'Video' },
      { name: 'DaVinci Resolve', group: 'Video' },
      { name: 'Photoshop', group: 'Design' },
      { name: 'Figma', group: 'Design' },
      { name: 'CapCut', group: 'Video' },
    ],
    ['Runway', 'Midjourney', 'ChatGPT', 'Adobe Firefly'],
    ['Wedding', 'Shorts / Reels', 'Corporate', 'Motion Graphics'],
  );

  // Standalone Designer and Video Editor categories (mirror prod). "Designer +
  // Editor" above is the auto-generated ghost the picker hides; these two are
  // the categories a talent actually picks. Kept as flat (ungrouped) tool lists
  // to match prod. Without these, the demo picker only offers Accountant/Sales.
  const designerOnlyId = await upsertCategory(
    'Designer',
    'designer',
    'Graphic, brand, and visual design professionals.',
    20,
  );
  const videoEditorId = await upsertCategory(
    'Video Editor',
    'video-editor',
    'Video editing, color grading, and motion graphics professionals.',
    30,
  );
  categoryIdBySlug['designer'] = designerOnlyId;
  categoryIdBySlug['video-editor'] = videoEditorId;

  await seedTemplate(
    designerOnlyId,
    [],
    [
      { name: 'Adobe Photoshop', group: '' },
      { name: 'Adobe Illustrator', group: '' },
      { name: 'Affinity Designer', group: '' },
      { name: 'Canva', group: '' },
      { name: 'Procreate', group: '' },
      { name: 'After Effects', group: '' },
    ],
    ['Gemini - nana banana', 'Freepik', 'Midjourney'],
    ['Branding', 'Logo Design', 'UI Designs', 'UX Designs', 'Visual Identity Design', 'Social Media Creatives', 'Product & Print Design', 'Motion & Advanced Design'],
  );
  await seedTemplate(
    videoEditorId,
    ['Storytelling', 'Continuity awareness', 'Audio syncing & balancing', 'Color grading & correction', 'Typography & text animation basics', 'Sound Design', 'VFX', 'AI tools for editing'],
    [
      { name: 'Adobe Premiere Pro', group: '' },
      { name: 'DaVinci Resolve', group: '' },
      { name: 'Final Cut Pro (FCP)', group: '' },
      { name: 'CapCut', group: '' },
      { name: 'VN Video Editor', group: '' },
      { name: 'InShot', group: '' },
    ],
    ['Descript', 'OpusClip', 'Vizard.ai', 'Runway', 'Kling AI', 'Luma Dream Machine', 'HeyGen', 'Synthesia', 'Google Veo', 'Pika Labs', 'Seedance', 'Higgsfield AI', 'Grok'],
    ['Shorts Edits', 'Youtube Video', 'Events', 'Wedding', 'Automobile', 'Architecture', 'Landscape', 'Short Films', 'Movies', 'Music and Albums', 'AI Video', 'Motion Graphics', 'Podcasts & Interviews'],
  );

  // Talents
  log('Creating talent accounts + profiles…');
  const talentSpecs: TalentSpec[] = [
    { slug: 'priya', fullName: 'Priya Menon', gender: 'female', age: 29, district: 'Kochi', state: 'Kerala', languages: [{ language: 'English', proficiency: 'Fluent' }, { language: 'Malayalam', proficiency: 'Native' }], categorySlug: 'accountant', tier: 'Top Talents', skills: ['GST Filing', 'Bookkeeping', 'Financial Statement Preparation'], tools: ['Tally', 'Zohobooks', 'Microsoft Excel'], aiTools: ['ChatGPT', 'Dext'], salaryFullTime: 55000 },
    { slug: 'arjun', fullName: 'Arjun Nair', gender: 'male', age: 34, district: 'Bengaluru', state: 'Karnataka', languages: [{ language: 'English', proficiency: 'Fluent' }, { language: 'Hindi', proficiency: 'Fluent' }], categorySlug: 'accountant', tier: 'pro', skills: ['TDS Calculations and Filing', 'Payroll Processing', 'MIS Reporting'], tools: ['QuickBooks', 'Microsoft Excel'], aiTools: ['Microsoft Copilot'], salaryFullTime: 48000 },
    { slug: 'fatima', fullName: 'Fatima Sheikh', gender: 'female', age: 26, district: 'Hyderabad', state: 'Telangana', languages: [{ language: 'English', proficiency: 'Fluent' }, { language: 'Urdu', proficiency: 'Native' }], categorySlug: 'accountant', tier: 'junior', skills: ['Bank Reconciliation', 'Bookkeeping'], tools: ['Tally', 'Google Sheets'], aiTools: ['ChatGPT'], salaryFullTime: 32000 },
    { slug: 'rahul', fullName: 'Rahul Verma', gender: 'male', age: 31, district: 'Pune', state: 'Maharashtra', languages: [{ language: 'English', proficiency: 'Fluent' }, { language: 'Hindi', proficiency: 'Native' }], categorySlug: 'accountant', tier: 'pro', skills: ['ITR Filing Business', 'GST Filing', 'Financial Statement Preparation'], tools: ['Zohobooks', 'Microsoft Excel'], aiTools: ['Claude'], salaryFullTime: 50000 },
    { slug: 'sneha', fullName: 'Sneha Pillai', gender: 'female', age: 28, district: 'Thiruvananthapuram', state: 'Kerala', languages: [{ language: 'English', proficiency: 'Fluent' }, { language: 'Malayalam', proficiency: 'Native' }, { language: 'Tamil', proficiency: 'Intermediate' }], categorySlug: 'accountant', tier: 'Top Talents', skills: ['Payroll Processing', 'GST Filing', 'MIS Reporting'], tools: ['Tally', 'QuickBooks'], aiTools: ['ChatGPT', 'Dext'], salaryFullTime: 58000 },
    { slug: 'vikram', fullName: 'Vikram Singh', gender: 'male', age: 36, district: 'Jaipur', state: 'Rajasthan', languages: [{ language: 'English', proficiency: 'Fluent' }, { language: 'Hindi', proficiency: 'Native' }], categorySlug: 'accountant', tier: 'junior', skills: ['Bookkeeping', 'Bank Reconciliation'], tools: ['Tally', 'Microsoft Excel'], aiTools: ['ChatGPT'], salaryFullTime: 30000 },
    { slug: 'ananya', fullName: 'Ananya Das', gender: 'female', age: 27, district: 'Kolkata', state: 'West Bengal', languages: [{ language: 'English', proficiency: 'Fluent' }, { language: 'Bengali', proficiency: 'Native' }], categorySlug: 'designer-editor', tier: 'Top Talents', skills: ['Video Editing', 'Color Grading', 'Motion Graphics'], tools: ['Adobe Premiere Pro', 'After Effects', 'DaVinci Resolve'], aiTools: ['Runway', 'Midjourney'], salaryFullTime: 62000 },
    { slug: 'karthik', fullName: 'Karthik Reddy', gender: 'male', age: 30, district: 'Chennai', state: 'Tamil Nadu', languages: [{ language: 'English', proficiency: 'Fluent' }, { language: 'Tamil', proficiency: 'Native' }], categorySlug: 'designer-editor', tier: 'pro', skills: ['Graphic Design', 'Thumbnail Design', 'Motion Graphics'], tools: ['Photoshop', 'Figma', 'After Effects'], aiTools: ['Midjourney', 'Adobe Firefly'], salaryFullTime: 45000 },
    { slug: 'meera', fullName: 'Meera Joshi', gender: 'female', age: 25, district: 'Ahmedabad', state: 'Gujarat', languages: [{ language: 'English', proficiency: 'Fluent' }, { language: 'Gujarati', proficiency: 'Native' }, { language: 'Hindi', proficiency: 'Fluent' }], categorySlug: 'designer-editor', tier: 'junior', skills: ['Video Editing', 'Thumbnail Design'], tools: ['CapCut', 'Photoshop'], aiTools: ['ChatGPT'], salaryFullTime: 28000 },
    { slug: 'rohan', fullName: 'Rohan Kapoor', gender: 'male', age: 33, district: 'Mumbai', state: 'Maharashtra', languages: [{ language: 'English', proficiency: 'Fluent' }, { language: 'Hindi', proficiency: 'Native' }], categorySlug: 'designer-editor', tier: 'pro', skills: ['Motion Graphics', 'Color Grading', 'Sound Design'], tools: ['After Effects', 'DaVinci Resolve', 'Adobe Premiere Pro'], aiTools: ['Runway', 'ChatGPT'], salaryFullTime: 52000 },
    { slug: 'divya', fullName: 'Divya Krishnan', gender: 'female', age: 29, district: 'Coimbatore', state: 'Tamil Nadu', languages: [{ language: 'English', proficiency: 'Fluent' }, { language: 'Tamil', proficiency: 'Native' }], categorySlug: 'designer-editor', tier: 'Top Talents', skills: ['Graphic Design', 'Motion Graphics', 'Video Editing'], tools: ['Figma', 'Photoshop', 'After Effects'], aiTools: ['Midjourney', 'Adobe Firefly', 'ChatGPT'], salaryFullTime: 60000 },
    { slug: 'aditya', fullName: 'Aditya Rao', gender: 'male', age: 28, district: 'Mangaluru', state: 'Karnataka', languages: [{ language: 'English', proficiency: 'Fluent' }, { language: 'Kannada', proficiency: 'Native' }], categorySlug: 'designer-editor', tier: 'junior', skills: ['Video Editing', 'Thumbnail Design'], tools: ['CapCut', 'Adobe Premiere Pro'], aiTools: ['ChatGPT'], salaryFullTime: 30000 },
    // Lifecycle states (NOT shared with businesses — they only show in the
    // talent's own dashboard and the admin approval queue):
    { slug: 'newbie', fullName: 'Imran Qureshi', gender: 'male', age: 24, district: 'Lucknow', state: 'Uttar Pradesh', languages: [{ language: 'English', proficiency: 'Intermediate' }, { language: 'Hindi', proficiency: 'Native' }], categorySlug: 'accountant', tier: 'junior', skills: ['Bookkeeping'], tools: ['Tally'], aiTools: ['ChatGPT'], salaryFullTime: 25000, profileStatus: 'pending_review', talentApproval: 'pending' },
    { slug: 'draftee', fullName: 'Tara Iyer', gender: 'female', age: 26, district: 'Goa', state: 'Goa', languages: [{ language: 'English', proficiency: 'Fluent' }], categorySlug: 'designer-editor', tier: 'junior', skills: ['Video Editing'], tools: ['CapCut'], aiTools: ['ChatGPT'], salaryFullTime: 27000, profileStatus: 'draft' },
    { slug: 'rejected', fullName: 'Sahil Mehta', gender: 'male', age: 30, district: 'Indore', state: 'Madhya Pradesh', languages: [{ language: 'English', proficiency: 'Intermediate' }], categorySlug: 'accountant', tier: 'junior', skills: ['Bookkeeping'], tools: ['Tally'], aiTools: ['ChatGPT'], salaryFullTime: 26000, profileStatus: 'rejected', rejectionReason: 'Profile incomplete — please add GST/TDS experience and a resume.' },
  ];

  const talents: Array<{ id: string; email: string; profileId: string; categorySlug: string; fullName: string; profileStatus: string }> = [];
  for (const spec of talentSpecs) talents.push(await createTalent(spec, categoryIdBySlug));
  // Only fully-approved profiles are browseable by businesses.
  const approved = talents.filter((t) => t.profileStatus === 'approved');
  const accountantTalents = approved.filter((t) => t.categorySlug === 'accountant');
  const designerTalents = approved.filter((t) => t.categorySlug === 'designer-editor');

  // Businesses (passwordless — no auth user needed)
  log('Creating business accounts + subscriptions + shared profiles…');
  const businessSpecs = [
    { slug: 'acmefintech', company: 'Acme Fintech', person: 'Neha Gupta', phone: '+91 90000 11111', industry: 'Financial Services', size: '51-200', categories: ['accountant'] },
    { slug: 'pixelworks', company: 'PixelWorks Studio', person: 'Sameer Khan', phone: '+91 90000 22222', industry: 'Media & Production', size: '11-50', categories: ['designer-editor'] },
    { slug: 'brightretail', company: 'Bright Retail Co', person: 'Lakshmi Iyer', phone: '+91 90000 33333', industry: 'Retail', size: '201-500', categories: ['accountant', 'designer-editor'] },
  ];

  const businesses: Array<{ id: string; email: string; phone: string; company: string; categories: string[] }> = [];
  for (const b of businessSpecs) {
    const id = uuid();
    const email = `${b.slug}@${DEMO_DOMAIN}`;
    await ins('business_users', {
      id,
      company_name: b.company,
      contact_person_name: b.person,
      contact_email: email,
      contact_phone: b.phone,
      industry: b.industry,
      company_size: b.size,
      is_active: true,
      verified: true,
      access_expires_at: null,
    });
    for (const slug of b.categories) {
      await ins('business_category_subscriptions', {
        business_user_id: id,
        category_id: categoryIdBySlug[slug],
        assigned_by: adminId,
      });
      const pool = slug === 'accountant' ? accountantTalents : designerTalents;
      for (const t of pool) {
        await ins('business_shared_profiles', {
          business_user_id: id,
          talent_profile_id: t.profileId,
          category_id: categoryIdBySlug[slug],
          shared_by: adminId,
        });
      }
    }
    businesses.push({ id, email, phone: b.phone, company: b.company, categories: b.categories });
  }

  // Shortlists + interest requests (Acme Fintech → a couple of accountants)
  log('Seeding shortlists + interest requests…');
  const acme = businesses[0];
  for (const t of accountantTalents.slice(0, 3)) {
    await ins('shortlists', { business_user_id: acme.id, talent_profile_id: t.profileId });
  }
  await ins('interest_requests', {
    business_user_id: acme.id,
    talent_profile_id: accountantTalents[0].profileId,
    message: "Hi! We'd love to discuss a full-time bookkeeping role. Are you available this week?",
    status: 'pending',
  });
  await ins('interest_requests', {
    business_user_id: acme.id,
    talent_profile_id: accountantTalents[1].profileId,
    message: 'Interested in your profile for a payroll project.',
    status: 'accepted',
    responded_at: now(),
  });

  // Subscription cards (active) linked to a business + recipients
  log('Seeding subscription cards…');
  const card1 = uuid();
  await ins('subscription_cards', {
    id: card1,
    external_id: 'demo-card-accountant-1',
    status: 'active',
    distribution: 'broadcast',
    source: 'custom',
    business_user_id: acme.id,
    business_email: acme.email,
    content: {
      title: 'Senior Accountant — Full Time',
      brand_name: 'Acme Fintech',
      description: 'Looking for an experienced accountant to own GST, TDS and monthly MIS for a fast-growing fintech.',
      business_nature: 'Financial Services',
      plan_name: 'Dedicated — Full Time',
      subscription_name: 'Accountant (Top Talents)',
      hours_label: '8 hrs/day',
      capacity_label: '1 dedicated talent',
      working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      monthly_price: 60000,
      currency: 'INR',
      price_label: '₹60,000 / month',
      is_popular: true,
      target_languages: ['English', 'Hindi'],
      ctaLabel: 'Accept this brief',
    },
    match_rules: { category_ids: [accountantId] },
    published_at: now(),
    expires_at: daysFromNow(30),
  });
  await ins('subscription_card_recipients', {
    card_id: card1,
    talent_user_id: accountantTalents[0].id,
    status: 'accepted',
    responded_at: now(),
  });
  await ins('subscription_card_recipients', {
    card_id: card1,
    talent_user_id: accountantTalents[1].id,
    status: 'pending',
  });

  const card2 = uuid();
  await ins('subscription_cards', {
    id: card2,
    external_id: 'demo-card-designer-1',
    status: 'active',
    distribution: 'broadcast',
    source: 'custom',
    business_user_id: businesses[1].id,
    business_email: businesses[1].email,
    content: {
      title: 'Video Editor — Reels & Shorts',
      brand_name: 'PixelWorks Studio',
      description: 'High-volume short-form editing for social channels. Motion graphics a plus.',
      business_nature: 'Media & Production',
      plan_name: 'Dedicated — Part Time',
      subscription_name: 'Designer + Editor (Pro)',
      hours_label: '4 hrs/day',
      capacity_label: '1 dedicated talent',
      working_days: ['Mon', 'Wed', 'Fri'],
      monthly_price: 35000,
      currency: 'INR',
      price_label: '₹35,000 / month',
      target_languages: ['English'],
      ctaLabel: 'Accept this brief',
    },
    match_rules: { category_ids: [designerId] },
    published_at: now(),
    expires_at: daysFromNow(30),
  });
  await ins('subscription_card_recipients', {
    card_id: card2,
    talent_user_id: designerTalents[0].id,
    status: 'pending',
  });

  // Multi-tier brief — 3 sibling cards sharing one group_id collapse into a
  // single card with tier sub-tabs in the business portal (the backend builds
  // the tab list from each sibling's content.plan_tier).
  const groupId = uuid();
  const bright = businesses[2];
  const tierCards = [
    { tier: 'Junior', price: 30000, ext: 'demo-card-group-jr', hrs: '4 hrs/day' },
    { tier: 'Pro', price: 45000, ext: 'demo-card-group-pro', hrs: '6 hrs/day' },
    { tier: 'Top Talents', price: 60000, ext: 'demo-card-group-top-talents', hrs: '8 hrs/day' },
  ];
  for (const tc of tierCards) {
    await ins('subscription_cards', {
      id: uuid(),
      external_id: tc.ext,
      status: 'active',
      distribution: 'broadcast',
      source: 'custom',
      business_user_id: bright.id,
      business_email: bright.email,
      group_id: groupId,
      // All tier siblings are PRIMARY (is_secondary stays false). The business
      // portal hides is_secondary=true cards; it builds the tier tabs by
      // collapsing the primary cards that share this group_id.
      is_secondary: false,
      content: {
        title: 'Accountant — Monthly Retainer',
        brand_name: 'Bright Retail Co',
        description: 'Ongoing accounting support across GST, payroll and monthly books — pick the tier that fits.',
        business_nature: 'Retail',
        plan_name: 'Accountant Retainer',
        plan_tier: tc.tier,
        subscription_name: `Accountant (${tc.tier})`,
        hours_label: tc.hrs,
        capacity_label: '1 dedicated talent',
        monthly_price: tc.price,
        currency: 'INR',
        price_label: `₹${tc.price} / month`,
        target_languages: ['English', 'Hindi'],
      },
      match_rules: { category_ids: [accountantId] },
      published_at: now(),
      expires_at: daysFromNow(30),
    });
  }

  // Talent-access grant (email-scoped browse access) for a business viewer
  log('Seeding talent-access grant…');
  const grantId = uuid();
  await ins('talent_access_grants', {
    id: grantId,
    email: acme.email,
    expires_at: daysFromNow(30),
    created_by: adminId,
    notes: '[DEMO] 30-day browse access for Acme Fintech',
  });
  await ins('talent_access_grant_categories', { grant_id: grantId, category_id: accountantId });

  // Training (onboarding course + chapter + lesson) so the talent training page is non-empty
  log('Seeding training content…');
  const courseId = uuid();
  await ins('training_courses', {
    id: courseId,
    title: '[DEMO] Onboarding 101',
    description: 'Welcome to SquadHire! Everything you need to get started as a talent.',
    is_onboarding: true,
    is_active: true,
    available_to_all: true,
    sort_order: 0,
  });
  const chapterId = uuid();
  await ins('training_chapters', {
    id: chapterId,
    title: '[DEMO] Getting Started',
    description: 'Set up your profile and learn how briefs work.',
    course_id: courseId,
    is_onboarding: true,
    language: 'en',
    is_active: true,
    sort_order: 0,
  });
  const lessonId = uuid();
  await ins('training_lessons', {
    id: lessonId,
    chapter_id: chapterId,
    title: '[DEMO] Welcome & platform tour',
    description: 'A quick tour of the talent dashboard.',
    loom_url: DEMO_LOOM,
    is_active: true,
    sort_order: 0,
  });
  await ups('training_lesson_videos', { lesson_id: lessonId, language: 'en', loom_url: DEMO_LOOM }, 'lesson_id,language');

  // How-it-works video (language-keyed, shared by talent + business)
  await ups('how_it_works_videos', { language: 'en', loom_url: DEMO_LOOM, is_active: true }, 'language');

  // Notifications for a talent (one unread broadcast)
  log('Seeding notifications…');
  const notifId = uuid();
  await ins('notifications', {
    id: notifId,
    kind: 'broadcast',
    title: '[DEMO] Welcome to SquadHire!',
    body: 'Complete your profile to start receiving briefs from businesses.',
    media: [],
    created_by: adminId,
  });
  for (const t of talents.slice(0, 5)) {
    await ins('notification_recipients', { notification_id: notifId, talent_user_id: t.id, read_at: null });
  }

  // Pending invitations so you can also record the live signup / invite flows
  log('Seeding signup invitations…');
  await ins('invitations', {
    email: `newtalent@${DEMO_DOMAIN}`,
    role: 'talent',
    status: 'pending',
    expires_at: daysFromNow(30),
    invited_by: adminId,
  });
  await ins('invitations', {
    email: `newbiz@${DEMO_DOMAIN}`,
    role: 'business',
    status: 'pending',
    company_name: 'Newco Ventures',
    contact_person_name: 'Riya Shah',
    expires_at: daysFromNow(30),
    invited_by: adminId,
  });

  // ── Summary ────────────────────────────────────────────────────────────
  /* eslint-disable no-console */
  console.log('\n✅ Demo seed complete.\n');
  console.log('────────────────────── LOGIN CREDENTIALS ──────────────────────');
  console.log(`Password for ALL talent/admin logins: ${DEMO_PASSWORD}\n`);
  console.log('TALENT (email + password)  →  /login/talent');
  for (const t of talents) {
    const tag = t.profileStatus !== 'approved' ? `, profile: ${t.profileStatus}` : '';
    console.log(`  ${t.email}   (${t.fullName}, ${t.categorySlug}${tag})`);
  }
  console.log('\nBUSINESS (passwordless — email OR phone)  →  /login/business');
  for (const b of businesses) console.log(`  ${b.email}   /   ${b.phone}   (${b.company})`);
  console.log('\nADMIN (email + password)  →  /admin   (pending talent + multi-tier brief await you here)');
  console.log(`  ${adminEmail}`);
  console.log('\nLIVE DEMOS (pending invites):');
  console.log(`  talent signup   →  /signup/talent     newtalent@${DEMO_DOMAIN}`);
  console.log(`  business invite →  admin invites page  newbiz@${DEMO_DOMAIN}`);
  console.log('────────────────────────────────────────────────────────────────\n');
  /* eslint-enable no-console */
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('\n❌ Demo seed failed:', err?.message ?? err);
    process.exit(1);
  });
