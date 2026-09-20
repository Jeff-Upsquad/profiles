'use client';

import { useMemo, useState } from 'react';

type Talent = {
  id: string;
  name: string;
  tier: 'Junior' | 'Pro' | 'Top Talents';
  city: string;
  region: string;
  country: string;
  languages: string[];
  skills: string[];
  price: number;
  minutesAgo: number;
  new: boolean;
};

type ChipStyle = 'whisper' | 'pip' | 'borderless' | 'hairline';

const requiredCategory = 'Video Editor';
const requestedCountry = 'India';
const requestedRegion = 'Kerala';
const requestedLanguages = ['English', 'Tamil', 'Malayalam'];
const additionalRequirements = ['Premiere Pro', 'After Effects'];

// Fictional people. The Designer is included in the source pool to show that
// category remains a hard gate, even when location and language match.
const sourceTalents: Array<Talent & { category: string }> = [
  { id: 'aarav', name: 'Aarav Menon', category: 'Video Editor', tier: 'Pro', city: 'Kochi', region: 'Kerala', country: 'India', languages: ['Malayalam', 'English'], skills: ['Premiere Pro', 'After Effects'], price: 45000, minutesAgo: 12, new: true },
  { id: 'nila', name: 'Nila Krishnan', category: 'Video Editor', tier: 'Top Talents', city: 'Thiruvananthapuram', region: 'Kerala', country: 'India', languages: ['Tamil', 'Malayalam'], skills: ['Premiere Pro', 'After Effects'], price: 52000, minutesAgo: 24, new: true },
  { id: 'rohan', name: 'Rohan Nair', category: 'Video Editor', tier: 'Pro', city: 'Kozhikode', region: 'Kerala', country: 'India', languages: ['English'], skills: ['Premiere Pro', 'After Effects'], price: 44000, minutesAgo: 68, new: false },
  { id: 'farah', name: 'Farah Ali', category: 'Video Editor', tier: 'Pro', city: 'Mumbai', region: 'Maharashtra', country: 'India', languages: ['English', 'Hindi'], skills: ['Premiere Pro'], price: 43000, minutesAgo: 8, new: true },
  { id: 'vishnu', name: 'Vishnu Raj', category: 'Video Editor', tier: 'Junior', city: 'Kochi', region: 'Kerala', country: 'India', languages: ['Hindi'], skills: ['Premiere Pro', 'After Effects'], price: 32000, minutesAgo: 31, new: false },
  { id: 'meera', name: 'Meera Thomas', category: 'Video Editor', tier: 'Pro', city: 'Bengaluru', region: 'Karnataka', country: 'India', languages: ['Malayalam', 'English'], skills: ['After Effects'], price: 47000, minutesAgo: 140, new: false },
  { id: 'zoya', name: 'Zoya Sheikh', category: 'Video Editor', tier: 'Top Talents', city: 'Dubai', region: 'Dubai', country: 'UAE', languages: ['English'], skills: ['Premiere Pro', 'After Effects'], price: 56000, minutesAgo: 181, new: false },
  { id: 'dev', name: 'Dev Shah', category: 'Designer', tier: 'Pro', city: 'Kochi', region: 'Kerala', country: 'India', languages: ['English'], skills: ['Premiere Pro', 'After Effects'], price: 42000, minutesAgo: 20, new: true },
];

type Match = {
  key: string;
  category: 'Role' | 'Location' | 'Language' | 'Tool';
  label: string;
  detail?: string;
  matches: boolean;
  optional?: boolean;
};

function matchesFor(talent: Talent): Match[] {
  const spoken = requestedLanguages.filter((language) => talent.languages.includes(language));
  const countryMatches = talent.country === requestedCountry;
  const regionMatches = countryMatches && talent.region === requestedRegion;

  return [
    {
      key: 'category',
      category: 'Role',
      label: requiredCategory,
      matches: true,
    },
    {
      key: 'location',
      category: 'Location',
      label: regionMatches
        ? `${talent.region}, ${talent.country}`
        : `${talent.region || talent.city}`,
      detail: regionMatches ? undefined : `req. ${requestedRegion}`,
      matches: regionMatches,
    },
    {
      key: 'language',
      category: 'Language',
      label: spoken.length > 0 ? spoken.join(', ') : talent.languages.slice(0, 2).join(', '),
      detail: spoken.length > 0 ? undefined : `req. ${requestedLanguages.slice(0, 2).join('/')}`,
      matches: spoken.length > 0,
    },
    ...additionalRequirements.map((skill) => ({
      key: skill,
      category: 'Tool' as const,
      label: skill,
      matches: talent.skills.includes(skill),
      optional: true,
    })),
  ];
}

function isEligible(talent: Talent & { category: string }): boolean {
  return (
    talent.category === requiredCategory &&
    (talent.country === requestedCountry ||
      requestedLanguages.some((language) => talent.languages.includes(language)))
  );
}

function shuffle<T>(list: T[], seed: number): T[] {
  const result = [...list];
  let state = seed;
  for (let index = result.length - 1; index > 0; index--) {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    const chosen = (state >>> 0) % (index + 1);
    [result[index], result[chosen]] = [result[chosen], result[index]];
  }
  return result;
}

const eligibleTalents = sourceTalents.filter(isEligible);
const allMatching = eligibleTalents.filter((talent) => matchesFor(talent).every((item) => item.matches));
const partialMatching = eligibleTalents.filter((talent) => matchesFor(talent).some((item) => !item.matches));
const tiers: Array<'All' | Talent['tier']> = ['All', 'Top Talents', 'Pro', 'Junior'];

function shuffledRound<T>(list: T[], baseSeed: number, round: number): T[] {
  let previous = shuffle(list, baseSeed);
  for (let step = 1; step <= round; step++) {
    const next = shuffle(list, baseSeed + step * 59);
    previous =
      next.length > 1 && next.every((item, index) => item === previous[index])
        ? [...next.slice(1), next[0]]
        : next;
  }
  return previous;
}

export default function MatchingPreviewPage() {
  const [activeTier, setActiveTier] = useState<(typeof tiers)[number]>('All');
  const [shuffleCount, setShuffleCount] = useState(0);
  const [chipStyle, setChipStyle] = useState<ChipStyle>('whisper');
  const [profile, setProfile] = useState<Talent | null>(null);
  const [message, setMessage] = useState('');

  const filterTier = (talent: Talent) => activeTier === 'All' || talent.tier === activeTier;
  const allVisible = useMemo(
    () => shuffledRound(allMatching.filter(filterTier), 427, shuffleCount),
    [activeTier, shuffleCount], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const partialVisible = useMemo(
    () => shuffledRound(partialMatching.filter(filterTier), 907, shuffleCount),
    [activeTier, shuffleCount], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function demoAction(action: string, talent: Talent) {
    setMessage(`${action} preview for ${talent.name}. No changes were saved.`);
    window.setTimeout(() => setMessage(''), 3500);
  }

  return (
    <div className="flex h-screen flex-col bg-[#F5F5F6] text-[#0a0a0a]">
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
          <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0a0a0a] text-[11px] font-bold text-white">SH</div>
            <div className="flex flex-col leading-tight">
              <span className="font-[family-name:var(--font-jakarta)] text-[15px] font-semibold tracking-[-0.02em]">SquadHire</span>
              <span className="text-[10px] text-[#737373]">Powered by UpSquad</span>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Business navigation preview">
            <NavItem icon="▣" label="Find talent" active />
            <NavItem icon="▤" label="My Cards" />
            <NavItem icon="♧" label="All profiles" />
            <NavItem icon="▢" label="Chatroom" />
            <NavItem icon="♢" label="Notifications" />
            <NavItem icon="ⓘ" label="How it works" />
          </nav>
          <div className="border-t border-gray-100 p-4">
            <p className="text-sm font-semibold">Brandilo Creative</p>
            <p className="text-[11px] text-zinc-500">Business user · sample account</p>
            <div className="mt-4 text-sm font-medium text-gray-600">↪ &nbsp; Logout</div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto bg-[#F5F5F6] p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl space-y-4 pb-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1 text-sm font-medium text-[#737373]">
                <span aria-hidden="true">‹</span> Back to Find talent
              </span>
              <span className="rounded-full bg-[#FFFAC2] px-3 py-1 text-[10px] font-bold uppercase tracking-wide">
                Sample UI preview · no live actions
              </span>
            </div>

            {/* Minimal & Light Shade Switcher Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[#E7E7EA] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-xs text-emerald-700 font-bold border border-emerald-100">🌿</span>
                <div>
                  <p className="text-xs font-semibold text-[#0a0a0a]">Minimal & Light Color Shades</p>
                  <p className="text-[11px] text-[#737373]">Switch between subtle, lightweight chip aesthetics:</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'whisper', label: 'Soft Mint & Blush' },
                  { id: 'pip', label: 'Paper + Pastel Pip' },
                  { id: 'borderless', label: 'Borderless Wash' },
                  { id: 'hairline', label: 'Hairline Ring' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setChipStyle(s.id as ChipStyle)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                      chipStyle === s.id
                        ? 'bg-[#0a0a0a] text-white shadow-xs'
                        : 'bg-[#F5F5F6] text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Card Details Overview */}
            <div className="rounded-2xl border border-[#E7E7EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
                    Brandilo Creative · Video Editor
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-[#737373]">Monthly subscription</span>
                    <span className="rounded-full bg-[#F1F1F3] px-2.5 py-0.5 text-[11px] font-medium text-[#525252]">Video Editor</span>
                  </div>
                </div>
                <span className="rounded-full bg-[#ecfdf5] px-3 py-1 text-xs font-semibold text-emerald-700">Active</span>
              </div>
              <CardSection title="Plan & levels">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-[#525252]">Pro</span>
                  <span className="font-semibold text-[#0a0a0a]">₹45,000/mo</span>
                </div>
              </CardSection>
              <CardSection title="Details">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                  <Detail label="Region">Kerala, India</Detail>
                  <Detail label="Languages">English, Tamil, Malayalam</Detail>
                  <Detail label="Availability">Full-time</Detail>
                  <Detail label="Working days">Monday to Friday</Detail>
                </dl>
              </CardSection>
              <CardSection title="Additional requirements">
                <p className="text-sm text-[#525252]">
                  Premiere Pro · After Effects <span className="ml-1 text-xs text-[#a3a3a3]">(shown for comparison)</span>
                </p>
              </CardSection>
            </div>

            {/* Shortlisted Section */}
            <div className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="border-b border-[#E7E7EA] px-4 py-3 sm:px-6 sm:py-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">Shortlisted</h2>
                  <span className="text-xs text-[#a3a3a3]">0 total</span>
                </div>
              </div>
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-[#737373]">No shortlisted talents yet. Review talents below to add them here.</p>
              </div>
            </div>

            {/* New Talents for Review Section */}
            <section className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]" aria-labelledby="review-heading">
              <div className="border-b border-[#E7E7EA] px-4 py-3.5 sm:px-6 sm:py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 id="review-heading" className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
                      New talents for review
                    </h2>
                    <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">3 new</span>
                  </div>
                  <span className="text-xs text-[#a3a3a3]">{eligibleTalents.length} total</span>
                </div>
                <p className="mt-0.5 text-xs text-[#737373]">
                  Video Editors who accepted your card. Category is required; a location or requested language brings them into review.
                </p>
              </div>

              {/* Filtering and Shuffle Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7E7EA] bg-[#FCFCFD] px-4 py-2.5 sm:px-6">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[11px] font-medium text-[#a3a3a3]">Filter:</span>
                  {tiers.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setActiveTier(tier)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        activeTier === tier
                          ? 'bg-[#0a0a0a] text-white'
                          : 'bg-white text-[#525252] border border-[#E7E7EA] hover:border-[#0a0a0a] hover:text-[#0a0a0a]'
                      }`}
                    >
                      {tier}{' '}
                      <span className={activeTier === tier ? 'opacity-80' : 'text-[#a3a3a3]'}>
                        {tier === 'All'
                          ? eligibleTalents.length
                          : eligibleTalents.filter((talent) => talent.tier === tier).length}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShuffleCount((count) => count + 1)}
                  className="rounded-lg border border-[#E7E7EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#525252] shadow-xs transition-colors hover:bg-[#F5F5F6]"
                >
                  ⤨ &nbsp; Shuffle order
                </button>
              </div>

              <ReviewGroup
                title="All Matching Talents"
                description="Meet all listed card preferences and criteria."
                count={allVisible.length}
                talents={allVisible}
                chipStyle={chipStyle}
                onProfile={setProfile}
                onAction={demoAction}
              />
              <ReviewGroup
                title="Partially Matching"
                description="Match category and location or language; review missing preferences below."
                count={partialVisible.length}
                talents={partialVisible}
                chipStyle={chipStyle}
                onProfile={setProfile}
                onAction={demoAction}
                partial
              />
            </section>
            <p className="px-1 text-xs leading-5 text-[#a3a3a3]">
              This sample uses the SquadHire business review layout. A Designer with matching location and language is excluded because the card category is Video Editor.
            </p>
          </div>
        </main>
      </div>

      {message && (
        <div role="status" className="fixed bottom-5 right-5 z-40 rounded-xl bg-[#0a0a0a] px-4 py-3 text-xs font-semibold text-white shadow-xl">
          {message}
        </div>
      )}

      {profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setProfile(null)} />
          <div role="dialog" aria-modal="true" aria-label={`${profile.name} sample profile`} className="relative w-full max-w-md rounded-2xl border border-[#E7E7EA] bg-white p-6 shadow-2xl">
            <button type="button" onClick={() => setProfile(null)} className="absolute right-4 top-3 text-2xl text-[#737373]" aria-label="Close profile">
              ×
            </button>
            <div className="flex items-center gap-3">
              <Avatar talent={profile} />
              <div>
                <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">{profile.name}</h2>
                <p className="text-xs text-[#a3a3a3]">Video Editor · {profile.tier}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3 border-t border-[#E7E7EA] pt-4 text-sm">
              <p><span className="text-[#737373]">Location:</span> {profile.city}, {profile.region}, {profile.country}</p>
              <p><span className="text-[#737373]">Languages:</span> {profile.languages.join(', ')}</p>
              <p><span className="text-[#737373]">Tools:</span> {profile.skills.join(', ')}</p>
              <p><span className="text-[#737373]">Monthly List Price:</span> ₹{profile.price.toLocaleString()}/mo</p>
            </div>
            <p className="mt-5 rounded-lg bg-[#F5F5F6] p-3 text-xs text-[#737373]">
              Sample profile for layout review. No live profile or action is connected.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: string; label: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${active ? 'bg-[#F5F5F6] text-[#0a0a0a]' : 'text-gray-600'}`}>
      <NavIcon name={label} fallback={icon} />
      {label}
    </div>
  );
}

function NavIcon({ name, fallback }: { name: string; fallback: string }) {
  const paths: Record<string, string[]> = {
    'Find talent': ['M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745', 'M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'],
    'My Cards': ['M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'],
    'All profiles': ['M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'],
    Chatroom: ['M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z'],
    Notifications: ['M15 17h5l-1.405-1.405A2 2 0 0118 14.17V11a6 6 0 00-4-5.659V4a2 2 0 10-4 0v1.341A6 6 0 006 11v3.17a2 2 0 01-.595 1.425L4 17h5m6 0H9m6 0a3 3 0 11-6 0'],
    'How it works': ['M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'],
  };
  if (!paths[name]) return <span className="w-5 text-center" aria-hidden="true">{fallback}</span>;
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      {paths[name].map((path) => (
        <path key={path} strokeLinecap="round" strokeLinejoin="round" d={path} />
      ))}
    </svg>
  );
}

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border-t border-[#E7E7EA] pt-3">
      <h2 className="mb-1.5 font-[family-name:var(--font-jakarta)] text-[13px] font-semibold text-[#0a0a0a]">{title}</h2>
      {children}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 sm:block">
      <dt className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">{label}</dt>
      <dd className="text-sm text-[#171717]">{children}</dd>
    </div>
  );
}

function ReviewGroup({
  title,
  description,
  count,
  talents,
  chipStyle,
  onProfile,
  onAction,
  partial = false,
}: {
  title: string;
  description: string;
  count: number;
  talents: Talent[];
  chipStyle: ChipStyle;
  onProfile: (talent: Talent) => void;
  onAction: (action: string, talent: Talent) => void;
  partial?: boolean;
}) {
  return (
    <div className={partial ? 'border-t border-[#E7E7EA]' : ''}>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FAFAF8] px-4 py-3 sm:px-6 border-b border-[#E7E7EA]">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
              partial
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800 font-bold'
            }`}
          >
            {partial ? '≈' : '✓'}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-[family-name:var(--font-jakarta)] text-[13.5px] font-semibold text-[#0a0a0a]">
                {title}
              </h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#525252] ring-1 ring-[#E7E7EA]">
                {count} {count === 1 ? 'talent' : 'talents'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#737373]">{description}</p>
          </div>
        </div>
      </div>
      {count === 0 ? (
        <p className="px-6 py-8 text-sm text-[#a3a3a3]">No talents in this tier.</p>
      ) : (
        <ul className="divide-y divide-[#E7E7EA]">
          {talents.map((talent) => (
            <TalentRow
              key={talent.id}
              talent={talent}
              chipStyle={chipStyle}
              onProfile={onProfile}
              onAction={onAction}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Avatar({ talent }: { talent: Talent }) {
  const initials = talent.name.split(' ').slice(0, 2).map((part) => part[0]).join('');
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-100/70 text-purple-800 font-[family-name:var(--font-jakarta)] text-sm font-semibold border border-purple-200/50 shadow-xs">
      {initials}
    </div>
  );
}

function MatchChip({ match, style }: { match: Match; style: ChipStyle }) {
  const isPos = match.matches;

  // Style 2: Clean paper with delicate pastel pip dot
  if (style === 'pip') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
          isPos
            ? 'border-emerald-200/60 bg-white text-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
            : 'border-rose-200/50 bg-rose-50/20 text-zinc-600'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            isPos ? 'bg-emerald-400 ring-2 ring-emerald-100' : 'bg-rose-400 ring-2 ring-rose-100'
          }`}
        />
        <span className={isPos ? 'font-medium text-zinc-800' : 'text-zinc-600'}>
          {match.label}
        </span>
        {match.detail && (
          <span className="text-[10px] text-zinc-400">({match.detail})</span>
        )}
        {match.optional && (
          <span className="text-[9.5px] text-zinc-400">· optional</span>
        )}
      </span>
    );
  }

  // Style 3: Borderless soft tint wash (Notion style)
  if (style === 'borderless') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs transition-colors ${
          isPos
            ? 'bg-emerald-50/70 text-emerald-800'
            : 'bg-rose-50/60 text-rose-800'
        }`}
      >
        <svg
          className={`h-3 w-3 shrink-0 ${isPos ? 'text-emerald-600' : 'text-rose-500'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {isPos ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          )}
        </svg>
        <span className="font-medium">{match.label}</span>
        {match.detail && <span className="text-[10.5px] opacity-70">({match.detail})</span>}
        {match.optional && (
          <span className="text-[9.5px] opacity-60">· optional</span>
        )}
      </span>
    );
  }

  // Style 4: Hairline ring with light tint
  if (style === 'hairline') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset transition-colors ${
          isPos
            ? 'bg-emerald-50/30 text-emerald-900 ring-emerald-200/70'
            : 'bg-rose-50/25 text-rose-900 ring-rose-200/60'
        }`}
      >
        <svg
          className={`h-3 w-3 shrink-0 ${isPos ? 'text-emerald-500' : 'text-rose-400'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {isPos ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          )}
        </svg>
        <span className="font-medium">{match.label}</span>
        {match.detail && <span className="text-[10.5px] opacity-70">({match.detail})</span>}
        {match.optional && (
          <span className="text-[9.5px] opacity-60">· optional</span>
        )}
      </span>
    );
  }

  // Default / Style 1: Whisper Mint & Blush (Ultra-light, airy, clean)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
        isPos
          ? 'border-emerald-100 bg-[#f4fbf6] text-emerald-900 hover:bg-[#eaf8ee]'
          : 'border-rose-100 bg-[#fef5f5] text-rose-900 hover:bg-[#fdeeed]'
      }`}
    >
      <svg
        className={`h-3 w-3 shrink-0 ${isPos ? 'text-emerald-600' : 'text-rose-500'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        {isPos ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        )}
      </svg>
      <span className="font-medium">{match.label}</span>
      {match.detail && (
        <span className={`text-[10.5px] ${isPos ? 'text-emerald-700/70' : 'text-rose-700/70'}`}>
          ({match.detail})
        </span>
      )}
      {match.optional && (
        <span
          className={`rounded-full px-1.5 py-0.2 text-[9px] font-medium ${
            isPos
              ? 'bg-emerald-100/70 text-emerald-800'
              : 'bg-rose-100/70 text-rose-800'
          }`}
        >
          optional
        </span>
      )}
    </span>
  );
}

function TalentRow({
  talent,
  chipStyle,
  onProfile,
  onAction,
}: {
  talent: Talent;
  chipStyle: ChipStyle;
  onProfile: (talent: Talent) => void;
  onAction: (action: string, talent: Talent) => void;
}) {
  const matches = matchesFor(talent);
  const yes = matches.filter((match) => match.matches);
  const no = matches.filter((match) => !match.matches);

  return (
    <li className={`relative px-4 py-4 sm:px-6 sm:py-5 transition-colors hover:bg-[#fafafa]/80 ${talent.new ? 'bg-red-50/30' : ''}`}>
      {/* Top Header Row: Left = Profile, Right = Price + Actions */}
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Left Side: Avatar & Candidate Identity */}
        <button
          type="button"
          className="flex min-w-0 items-center gap-3.5 text-left transition-opacity hover:opacity-80"
          onClick={() => onProfile(talent)}
        >
          <Avatar talent={talent} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
                {talent.name}
              </span>
              {talent.new && (
                <span className="shrink-0 rounded-full bg-rose-50 border border-rose-200/70 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                  New
                </span>
              )}
              <span className="shrink-0 rounded-full bg-[#F1F1F3] px-2 py-0.5 text-[10px] font-semibold text-[#525252]">
                {talent.tier}
              </span>
            </div>
            <p className="mt-0.5 truncate font-[family-name:var(--font-inter)] text-xs text-[#737373]">
              Video Editor · {talent.city}, {talent.country}
              <span className="ml-2 text-[#a3a3a3]">· Applied {talent.minutesAgo}m ago</span>
            </p>
          </div>
        </button>

        {/* Right Side: List Price & Action Buttons */}
        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 shrink-0 pt-1 sm:pt-0">
          <div className="text-left sm:text-right">
            <div className="flex items-baseline gap-1 sm:justify-end">
              <span className="font-[family-name:var(--font-jakarta)] text-base sm:text-lg font-bold tabular-nums tracking-tight text-[#0a0a0a]">
                ₹{talent.price.toLocaleString()}
              </span>
              <span className="text-xs font-medium text-[#737373]">/mo</span>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
              List price
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onAction('Reject', talent)}
              className="rounded-lg border border-[#E7E7EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#737373] shadow-xs transition-colors hover:border-red-200 hover:bg-rose-50/40 hover:text-red-600"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => onAction('Shortlist', talent)}
              className="rounded-lg bg-[#0a0a0a] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-zinc-800"
            >
              Shortlist
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Clean Organized Criteria Match Breakdown */}
      <div className="mt-3.5 pt-3 border-t border-[#f0f0f3] sm:ml-[58px] space-y-2">
        {yes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Matches
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {yes.map((match) => (
                <MatchChip key={match.key} match={match} style={chipStyle} />
              ))}
            </div>
          </div>
        )}
        {no.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              Missing
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {no.map((match) => (
                <MatchChip key={match.key} match={match} style={chipStyle} />
              ))}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
