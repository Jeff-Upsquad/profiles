import Link from 'next/link';

type PreviewArea = 'requirements' | 'profile';

export default function AdSpecialistPreviewShell({
  active,
  children,
}: {
  active: PreviewArea;
  children: React.ReactNode;
}) {
  const links: Array<{ id: PreviewArea; label: string; href: string }> = [
    {
      id: 'requirements',
      label: 'Requirement cards',
      href: '/preview/ad-specialist-requirements',
    },
    {
      id: 'profile',
      label: 'Talent job profile',
      href: '/preview/ad-specialist-profile',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F6]">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 border-r border-[#E7E7EA] bg-white md:flex md:flex-col">
          <div className="flex items-center gap-2.5 border-b border-[#F1F1F3] px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0a0a0a] text-[11px] font-bold text-white">
              SH
            </div>
            <div className="leading-tight">
              <p className="font-[family-name:var(--font-jakarta)] text-[15px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">
                SquadHire
              </p>
              <p className="text-[10px] text-[#737373]">Ad specialist preview</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1 p-3">
            {links.map((item) => {
              const selected = item.id === active;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    selected
                      ? 'bg-[#FFFAC2] text-[#0a0a0a]'
                      : 'text-[#737373] hover:bg-[#F5F5F6] hover:text-[#0a0a0a]'
                  }`}
                >
                  {item.id === 'requirements' ? <BriefcaseIcon /> : <ProfileIcon />}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-[#F1F1F3] p-4">
            <p className="text-sm font-semibold text-[#0a0a0a]">Northstar Learning</p>
            <p className="mt-0.5 text-[11px] text-[#737373]">Sample data · no login</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-[#E7E7EA] bg-white/90 px-4 py-3 backdrop-blur md:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0a0a0a]">Ad specialist preview</p>
                <p className="text-[10px] text-[#737373]">Sample data · no login</p>
              </div>
              <Link
                href={active === 'requirements' ? links[1].href : links[0].href}
                className="rounded-lg bg-[#0a0a0a] px-3 py-2 text-xs font-semibold text-white"
              >
                {active === 'requirements' ? 'View profile' : 'View cards'}
              </Link>
            </div>
          </header>
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function BriefcaseIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2m4 4v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9m16 0a2 2 0 00-2-2H5a2 2 0 00-2 2m16 0v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2m5 3h4" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21a8 8 0 0116 0M19 4v4m2-2h-4" />
    </svg>
  );
}
