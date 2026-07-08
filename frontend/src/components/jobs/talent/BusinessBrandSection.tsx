'use client';

import type { BrandProfileSnapshot, BusinessProfileSnapshot } from '@/components/jobs/shared';

// "About the business" (+ optional brand) block on the talent job-profile
// view — the candidate should understand who's hiring without asking.

function SnapshotBlock({
  heading,
  snapshot,
}: {
  heading: string;
  snapshot: BusinessProfileSnapshot | BrandProfileSnapshot;
}) {
  const name = typeof snapshot.name === 'string' ? snapshot.name : null;
  const logo = typeof snapshot.logo_url === 'string' ? snapshot.logo_url : null;
  const photos = Array.isArray(snapshot.photos) ? snapshot.photos.filter((p) => typeof p === 'string') : [];
  const perks =
    'perks' in snapshot && Array.isArray((snapshot as BusinessProfileSnapshot).perks)
      ? ((snapshot as BusinessProfileSnapshot).perks as string[])
      : [];
  const culture =
    'culture' in snapshot && typeof (snapshot as BusinessProfileSnapshot).culture === 'string'
      ? ((snapshot as BusinessProfileSnapshot).culture as string)
      : null;
  const companySize =
    'company_size' in snapshot ? ((snapshot as BusinessProfileSnapshot).company_size ?? null) : null;
  const foundedYear =
    'founded_year' in snapshot ? ((snapshot as BusinessProfileSnapshot).founded_year ?? null) : null;

  return (
    <div>
      <h3 className="mb-2 font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
        {heading}
      </h3>
      <div className="flex items-start gap-3">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={name ?? ''} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
        )}
        <div className="min-w-0">
          {name && (
            <p className="font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
              {name}
            </p>
          )}
          <p className="mt-0.5 text-xs text-[#737373]">
            {[
              snapshot.industry,
              companySize ? `${companySize} people` : null,
              foundedYear ? `Since ${foundedYear}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {typeof snapshot.website === 'string' && snapshot.website && (
            <a
              href={snapshot.website}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 inline-block text-xs font-medium text-[#0a0a0a] underline underline-offset-2"
            >
              {snapshot.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      </div>

      {typeof snapshot.about === 'string' && snapshot.about && (
        <p className="mt-3 whitespace-pre-line text-sm text-[#525252]">{snapshot.about}</p>
      )}

      {culture && (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">Culture</p>
          <p className="mt-1 whitespace-pre-line text-sm text-[#525252]">{culture}</p>
        </div>
      )}

      {perks.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">Perks</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {perks.map((p) => (
              <span key={p} className="rounded-full bg-[#F1F1F3] px-2.5 py-0.5 text-[11px] font-medium text-[#0a0a0a]">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {photos.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={p as string}
              alt=""
              className="h-24 w-36 shrink-0 rounded-xl object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BusinessBrandSection({
  business,
  brand,
}: {
  business: BusinessProfileSnapshot | null | undefined;
  brand: BrandProfileSnapshot | Record<string, never> | null | undefined;
}) {
  const hasBusiness = business && Object.keys(business).length > 0;
  const hasBrand = brand && Object.keys(brand).length > 0;
  if (!hasBusiness && !hasBrand) return null;

  return (
    <div className="rounded-2xl border border-[#E7E7EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <h2 className="mb-4 font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
        About the business
      </h2>
      <div className="space-y-6">
        {hasBusiness && <SnapshotBlock heading="Company" snapshot={business!} />}
        {hasBrand && <SnapshotBlock heading="Brand you'll work on" snapshot={brand as BrandProfileSnapshot} />}
      </div>
    </div>
  );
}
