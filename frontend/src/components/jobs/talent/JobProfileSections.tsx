'use client';

import type { TalentJobProfile } from '@/hooks/useJobs';

// The job-profile body sections (About → Location), shared by the standalone
// JobProfileView page and the inline full view on JobCardDetail so both render
// identical content from the same snapshot.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border-t border-[#E7E7EA] pt-3 first:mt-0 first:border-t-0 first:pt-0">
      <h2 className="mb-1.5 font-[family-name:var(--font-jakarta)] text-[13px] font-semibold text-[#0a0a0a]">
        {title}
      </h2>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-[#525252]">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function JobProfileSections({ profile }: { profile: TalentJobProfile }) {
  const details = profile.details ?? {};
  const responsibilities = Array.isArray(details.responsibilities) ? details.responsibilities : [];
  const requirements = Array.isArray(details.requirements) ? details.requirements : [];
  const skills = Array.isArray(details.skills) ? details.skills : [];
  const benefits = Array.isArray(details.benefits) ? details.benefits : [];
  const workingDays = Array.isArray(details.working_days) ? details.working_days : [];
  const workingHours = details.working_hours
    ? [details.working_hours.start, details.working_hours.end].filter(Boolean).join(' – ')
    : null;
  const location = details.location ?? null;

  return (
    <div className="space-y-3">
      {profile.description && (
        <Section title="About the role">
          <p className="whitespace-pre-line text-sm text-[#525252]">{profile.description}</p>
        </Section>
      )}

      {responsibilities.length > 0 && (
        <Section title="Responsibilities">
          <BulletList items={responsibilities} />
        </Section>
      )}

      {requirements.length > 0 && (
        <Section title="Requirements">
          <BulletList items={requirements} />
        </Section>
      )}

      {skills.length > 0 && (
        <Section title="Skills">
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <span key={s} className="rounded-full bg-[#F1F1F3] px-2.5 py-0.5 text-[11px] font-medium text-[#0a0a0a]">
                {s}
              </span>
            ))}
          </div>
        </Section>
      )}

      {(workingDays.length > 0 || workingHours) && (
        <Section title="Working schedule">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {workingDays.length > 0 && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">Days</dt>
                <dd className="text-sm text-[#0a0a0a]">{workingDays.join(', ')}</dd>
              </div>
            )}
            {workingHours && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">Hours</dt>
                <dd className="text-sm text-[#0a0a0a]">{workingHours}</dd>
              </div>
            )}
          </dl>
        </Section>
      )}

      {details.education && (
        <Section title="Education">
          <p className="text-sm text-[#525252]">{details.education}</p>
        </Section>
      )}

      {benefits.length > 0 && (
        <Section title="Benefits">
          <BulletList items={benefits} />
        </Section>
      )}

      {details.growth_path && (
        <Section title="Growth path">
          <p className="whitespace-pre-line text-sm text-[#525252]">{details.growth_path}</p>
        </Section>
      )}

      {location && (
        <Section title="Location">
          <p className="text-sm text-[#0a0a0a]">
            {[location.label, location.address, location.city, location.region].filter(Boolean).join(', ')}
          </p>
          {location.google_maps_url && (
            <a
              href={location.google_maps_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs font-semibold text-[#0a0a0a] underline underline-offset-2"
            >
              Open in Google Maps
            </a>
          )}
        </Section>
      )}
    </div>
  );
}
