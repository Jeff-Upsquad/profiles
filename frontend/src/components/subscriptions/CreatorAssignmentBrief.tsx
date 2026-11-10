'use client';

import LinkifiedText from '@/components/LinkifiedText';
import { ASAP_LABEL, ASAP_DESCRIPTION, isAsSoonAsPossible } from '@/lib/creatorTimeline';
import { cardBusinessLinks } from '../../../../shared/src/businessLinks';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useMyProfiles } from '@/hooks/useProfiles';
import { coerceCreatorPlatforms } from '@/constants/creator-profile';
import { matchCreatorRates, type CreatorAccount } from '@/lib/creatorAssignmentRates';
import type { SubscriptionCardContentShape } from '@/hooks/useSubscriptionCards';

const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export function isCreatorAssignment(content: SubscriptionCardContentShape) {
  const role = text(content.subscription_name).toLowerCase();
  const groups = content.additional_requirements;
  return content.card_type === 'assignment' && (role.includes('social media creator') || Boolean(groups?.creator_levels || groups?.creator_services || groups?.creator_audience));
}

export default function CreatorAssignmentBrief({ content, previewAccounts }: { content: SubscriptionCardContentShape; previewAccounts?: CreatorAccount[] }) {
  const { user } = useAuth();
  const { data: profiles, isLoading: profilesLoading } = useMyProfiles({ enabled: previewAccounts === undefined && user?.role === 'talent' });
  const accounts = previewAccounts ?? (profiles ?? []).filter(profile => profile.status === 'approved').flatMap(profile => coerceCreatorPlatforms(profile.field_data?.creator_platforms));
  const groups = content.additional_requirements ?? {};
  const matched = content.viewer_match?.additional ?? [];
  const values = (key: string) => strings(groups[key]).length ? strings(groups[key]) : matched.filter(item => item.group === key).map(item => item.label);
  const channels = values('channels');
  const formats = values('creator_formats');
  const audience = values('creator_audience').join(' ');
  const age = values('desired_age').join(', ') || audience.match(/Desired age:\s*([^.]*)/i)?.[1] || '';
  const niche = values('creator_niches').join(', ') || audience.match(/Creator niches:\s*([^.]*)/i)?.[1] || '';
  const audienceLocation = values('audience_location').join(', ') || audience.match(/Audience location:\s*([^.]*)/i)?.[1] || '';
  const services = values('service_count').length ? values('service_count') : values('creator_services');
  const platformRates = matchCreatorRates(channels, accounts, values('creator_levels'));
  const hasMatchedRate = platformRates.some(platform => platform.rate !== null);
  const languages = strings(content.target_languages).length ? strings(content.target_languages) : (content.viewer_match?.languages ?? []).map(item => item.label);
  const timeline = (content.assignment_details ?? {}) as Record<string, unknown>;
  const note = text(content.deliverables_label) || text(content.requirement_note);
  const usage = values('usage_rights').filter(item => !/^not specified$/i.test(item));
  const asap = isAsSoonAsPossible(groups);
  const deadline = text(timeline.deadline);
  const extras = Object.keys(groups).filter(key => !['channels', 'creator_formats', 'creator_services', 'service_count', 'creator_levels', 'creator_niches', 'creator_audience', 'audience_location', 'desired_age', 'deliverables', 'usage_rights', 'reference_links', 'client_links', 'delivery_timing'].includes(key));
  const references = values('reference_links');
  const clientLinks = cardBusinessLinks(content);
  const missing = [!asap && !deadline && 'Publishing deadline', !usage.length && 'Usage rights & paid ads', !hasMatchedRate && 'Payment amount'].filter(Boolean);
  return (
    <div className="space-y-6 text-[#24252a]">
      <section className="rounded-2xl border border-[#e4e0f4] bg-[#f8f6ff] p-4 sm:p-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#756299]"><Icon name="spark" /> Your assignment at a glance</div>
        <h2 className="mt-3 font-[family-name:var(--font-jakarta)] text-xl font-bold tracking-[-0.025em]">{services[0] || 'Creator collaboration'}</h2>
        <p className="mt-1 text-sm leading-6 text-[#706b7d]">{channels.length ? `Create content for ${channels.join(' & ')}.` : 'Publishing platform to be confirmed.'} {formats.length && !formats.includes('Any') ? formats.join(' · ') : 'Choose the content format that works for you.'}</p>
        <div className="mt-4 flex flex-wrap gap-2">{channels.map(channel => <Pill key={channel}><Icon name="camera" />{channel}</Pill>)}{languages.map(language => <Pill key={language}><Icon name="globe" />{language}</Pill>)}</div>
      </section>

      <Section number="01" title="Your platforms, services & rates" hint="Matched to your followers">
        <div className="space-y-3">
          {platformRates.map((platform, index) => (
            <div key={`${platform.platform}-${index}`} className="overflow-hidden rounded-2xl border border-[#e4dfed]">
              <div className="flex items-center justify-between gap-3 bg-[#f8f6fc] px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e5deee] bg-white text-[#806595]"><Icon name="camera" /></span><div><h3 className="text-sm font-semibold">{platform.platform}</h3>{platform.account && <p className="max-w-40 truncate text-[10px] text-[#9b8da7]">{platform.account}</p>}</div></div>
                <div className="shrink-0 text-right"><p className="text-[9px] font-medium uppercase tracking-wider text-[#a293ae]">Your rate</p><p className="mt-0.5 text-lg font-bold tracking-tight text-[#624579]">{profilesLoading && previewAccounts === undefined ? 'Loading…' : platform.rate || 'To be confirmed'}</p></div>
              </div>
              <div className="px-4 py-3.5">
                <dl className="mb-3 grid grid-cols-2 gap-3 border-b border-[#eeebf2] pb-3"><div><dt className="text-[10px] text-[#9a90a3]">Your followers</dt><dd className="mt-1 text-xs font-semibold">{platform.followers === null ? 'Not available' : platform.followers.toLocaleString('en-IN')}</dd></div><div><dt className="text-[10px] text-[#9a90a3]">Matched follower range</dt><dd className="mt-1 text-xs font-semibold">{platform.range || (platform.followers === null ? 'Add your follower count' : 'No matching range')}</dd></div></dl>
                <p className="text-[10px] text-[#9a90a3]">Service type & quantity</p>
                <p className="mt-1 text-sm font-semibold">{services.join(' · ') || 'To be confirmed'}</p>
                <p className="mt-1 text-xs text-[#8c8195]">{formats.length ? formats.join(' · ').replace(/^Any$/, 'Any content format') : 'Content format to be confirmed'}</p>
                {platform.rate && <p className="mt-3 flex items-center gap-1.5 text-[10px] text-[#7e688e]"><span aria-hidden="true">✓</span> Rate matched to your {platform.platform} followers</p>}
              </div>
            </div>
          ))}
          {!channels.length && <p className="text-sm text-[#777380]">Platform and rate to be confirmed with the client.</p>}
        </div>
        {note && <div className="mt-3 rounded-xl bg-[#faf9f6] px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#929087]">Client’s brief</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6"><LinkifiedText text={note} /></p></div>}
        {strings(content.custom_deliverables).map(item => <p key={item} className="mt-2 text-sm"><LinkifiedText text={item} /></p>)}
        {content.custom_deliverables?.map((item, index) => typeof item === 'object' && item.kind !== 'hours' ? <p key={index} className="mt-2 text-sm"><LinkifiedText text={`${item.label || item.name || item.title || ''}${item.description ? ` — ${item.description}` : ''}`} /></p> : null)}
        {!services.length && values('deliverables').map(item => <p key={item} className="mt-2 text-sm leading-6"><LinkifiedText text={item} /></p>)}
        {text(content.requirement_voice_url) && <audio controls preload="none" aria-label="Client’s recorded brief" className="mt-3 w-full" src={text(content.requirement_voice_url)} />}
      </Section>

      <Section number="02" title="Who the client is looking for" hint="Creator & audience preferences">
        <p className="mb-3 text-xs leading-5 text-[#82808b]">These are client preferences. Missing profile details don’t prevent you from responding.</p>
        <dl className="grid grid-cols-2 gap-3"><Detail label="Creator niche" value={niche.replace(/^Any$/i, 'Open to all niches') || 'Not specified'} /><Detail label="Audience location" value={audienceLocation || 'Not specified'} /><Detail label="Audience age" value={age.replace(/^Any$/i, 'All age groups') || 'Not specified'} /><Detail label="Content format" value={formats.join(', ').replace(/^Any$/, 'Your choice') || 'Not specified'} /></dl>

        {(content.viewer_match?.countries.length || content.viewer_match?.regions.length || strings(content.target_country_names).length) ? <p className="mt-3 text-xs text-[#777380]">Creator location: {[...strings(content.target_country_names), ...(content.viewer_match?.countries ?? []).map(item => item.label), ...(content.viewer_match?.regions ?? []).map(item => item.label)].filter((value, index, all) => all.indexOf(value) === index).join(', ')}</p> : null}
        {extras.map(key => <p key={key} className="mt-3 text-xs text-[#777380]">{key.replace(/_/g, ' ')}: {values(key).join(', ')}</p>)}
      </Section>

      <Section number="03" title="Timeline & usage rights">
        <dl className="grid grid-cols-2 gap-3"><Detail label="Publish by" value={asap ? ASAP_LABEL : deadline || 'To be confirmed'} /><Detail label="Campaign duration" value={text(timeline.duration) || 'To be confirmed'} />{!asap && text(timeline.start_date) && <Detail label="Start date" value={text(timeline.start_date)} />}</dl>
        {asap && <p className="mt-3 text-sm leading-6">{ASAP_DESCRIPTION}</p>}
        {usage.length > 0 && <p className="mt-3 text-sm leading-6"><span className="font-semibold">Usage rights: </span>{usage.join(' ')}</p>}
        {missing.length > 0 && <div className="mt-3 flex gap-2.5 rounded-xl border border-[#f0e4c8] bg-[#fffbf2] p-3.5 text-[#8b6b32]"><Icon name="info" /><div><p className="text-xs font-semibold">A few details to clarify</p><p className="mt-1 text-xs leading-5">{missing.join(' · ')}. Ask the client before you accept.</p></div></div>}
      </Section>

      {references.length > 0 && <Section title="Reference & inspiration">{references.map((reference, index) => /^https?:\/\//i.test(reference) ? <a key={reference} href={reference} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-[#eae8ee] px-4 py-3 text-sm font-medium transition hover:bg-[#f8f6ff]"><span className="min-w-0"><span className="block">View client reference{references.length > 1 ? ` ${index + 1}` : ''}</span><span className="mt-0.5 block truncate text-xs font-normal text-[#8a8693]">{reference}</span></span><Icon name="arrow" /></a> : <p key={reference} className="break-words text-sm">{reference}</p>)}</Section>}

      <section className="border-t border-[#eceaf0] pt-4"><h2 className="text-sm font-semibold">About the client</h2><div className="mt-3 rounded-xl bg-[#f8f8fa] p-4 text-sm leading-6"><p className="font-semibold">{text(content.brand_name) || 'Client'}</p>{text(content.business_nature) && <p>{text(content.business_nature)}</p>}<p className="text-[#777380]"><LinkifiedText text={text(content.notes) || 'No additional client information provided.'} /></p>{text(content.customer_location) && <p>{text(content.customer_location)}</p>}<div className="mt-4 border-t border-[#e9e5ee] pt-4"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#a092aa]">Website & social media</p>{clientLinks.length ? <div className="grid gap-2 sm:grid-cols-2">{clientLinks.map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-[#e7dfed] bg-white px-3 py-2.5 text-[#725486] hover:bg-[#f4eef9]"><span className="min-w-0"><span className="block text-xs font-semibold">{link.label}</span><span className="block truncate text-[10px] text-[#a495ad]">{link.url.replace(/^https?:\/\/(www\.)?/, '')}</span></span><Icon name="arrow" /></a>)}</div> : <p className="text-xs text-[#9a8ba5]">The client hasn’t added any public links yet.</p>}</div></div></section>
      {text(content.expiresAt) && <p className="text-xs text-[#82808b]">Offer expires: {text(content.expiresAt)}</p>}
    </div>
  );
}

function Section({ number, title, hint, children }: { number?: string; title: string; hint?: string; children: ReactNode }) {
  return <section><div className="mb-3 flex items-center gap-2.5">{number && <span className="text-[10px] font-semibold text-[#a19aa9]">{number}</span>}<h2 className="text-sm font-semibold tracking-[-0.01em]">{title}</h2>{hint && <span className="ml-auto hidden text-[10px] text-[#a19aa9] sm:block">{hint}</span>}</div>{children}</section>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#f8f8fa] px-3.5 py-3"><dt className="text-[10px] text-[#8a8693]">{label}</dt><dd className="mt-1 text-xs font-medium leading-5">{value}</dd></div>; }
function Pill({ children }: { children: ReactNode }) { return <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5dff0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#716080]">{children}</span>; }
export function Icon({ name }: { name: 'spark' | 'camera' | 'globe' | 'info' | 'arrow' }) {
  const paths = { spark: 'm12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Z', camera: 'M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8Zm8 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM17.5 6.5h.01', globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c4 4 4 14 0 18-4-4-4-14 0-18Z', info: 'M12 8h.01M12 11v5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', arrow: 'M7 17 17 7M7 7h10v10' };
  return <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
