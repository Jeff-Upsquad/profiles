'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Profile, CategoryField, CategoryWithFields } from '@/types';
import TierBadge from '@/components/ui/TierBadge';
import { periodSuffix } from '@/lib/assignmentPricing';
import RequestedChangesBanner from '@/components/profile/RequestedChangesBanner';
import { isNudgedDraft, needsProfileResubmission } from '@/lib/profileChanges';

interface TalentUser {
  full_name: string;
  current_location?: string;
  profile_photo_url?: string;
  languages_spoken?: { language: string; proficiency: string }[];
  age?: number | null;
  gender?: string | null;
  country?: string | null;
  state?: string | null;
  current_district?: string | null;
  city?: string | null;
}

export interface CardEngagementDisplay {
  card_id: string;
  card_type?: string | null;
  brand_name?: string | null;
  list_price?: number | null;
  currency?: string | null;
  period?: 'per_month' | 'project' | string | null;
  unit?: 'design' | 'video' | null;
  quantity?: number | null;
  kind: 'bid' | 'accepted_list' | 'business_offer' | 'agreed' | 'none' | string;
  amount?: number | null;
  offer_status?: string | null;
  recipient_status?: string | null;
  label?: string | null;
}

interface ThreadsProfileHeaderProps {
  profile: Profile;
  talentUser: TalentUser;
  category: CategoryWithFields | null;
  mode: 'business' | 'talent';
  onShortlist?: () => void;
  onUnshortlist?: () => void;
  shortlistLoading?: boolean;
  isShortlisted?: boolean;
  onSendInterest?: () => void;
  interestLoading?: boolean;
  /** When opened from a card review, enables "Send offer". */
  onSendOffer?: () => void;
  sendOfferLoading?: boolean;
  /** When opened from a card review, rejects this talent for that card. */
  onNotAFit?: () => void;
  notAFitLoading?: boolean;
  /** Price/bid for the specific card this profile was opened from. */
  cardEngagement?: CardEngagementDisplay | null;
  /** Opens the chatroom with this talent when they are shortlisted / selected / in a job funnel. */
  onMessage?: () => void;
  messageLoading?: boolean;
  editProfileHref?: string;
  /** Number of portfolio works (text posts excluded), for the "· 9 works" line. */
  worksCount?: number;
}

export function formatEngagementAmount(
  amount: number | null | undefined,
  currency?: string | null,
  period?: string | null,
): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const cur = !currency || currency === 'INR' ? '₹' : `${currency} `;
  const suffix = periodSuffix(period);
  return `${cur}${amount.toLocaleString()}${suffix}`;
}

export function engagementKindLabel(engagement: CardEngagementDisplay): string {
  switch (engagement.kind) {
    case 'bid':
      return 'Talent bid';
    case 'accepted_list':
      return 'Accepted list price';
    case 'agreed':
      return 'Agreed price';
    case 'business_offer':
      return 'Your offer';
    default:
      return engagement.label || 'Price';
  }
}

export function hasEngagementPrice(
  mode: 'business' | 'talent',
  engagement: CardEngagementDisplay | null | undefined,
): engagement is CardEngagementDisplay {
  return mode === 'business' && !!engagement && engagement.kind !== 'none';
}

function extractBio(fields: CategoryField[], fieldData: Record<string, any>): string | null {
  const textareaField = fields
    .filter((f) => f.is_active && f.field_type === 'textarea')
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  if (!textareaField) return null;
  const val = fieldData?.[textareaField.field_key];
  return val && typeof val === 'string' ? val : null;
}

function extractWebsite(fields: CategoryField[], fieldData: Record<string, any>): string | null {
  const urlField = fields.find(
    (f) => f.is_active && (f.field_type === 'email' || f.field_key.includes('website') || f.field_key.includes('url') || f.field_key.includes('link'))
  );
  if (!urlField) return null;
  const val = fieldData?.[urlField.field_key];
  return val && typeof val === 'string' && (val.startsWith('http') || val.startsWith('www')) ? val : null;
}

function readExperience(fieldData: Record<string, any>): { years: number; months: number } | null {
  const value = fieldData?._experience;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { years, months } = value as { years?: unknown; months?: unknown };
  if (typeof years !== 'number' || typeof months !== 'number') return null;
  if (years === 0 && months === 0) return null;
  return { years, months };
}

/** Highest-level names first, ties kept in their saved order. */
function topNames(list: unknown, nameKeys: string[], take: number, minLevel = 0): string[] {
  if (!Array.isArray(list)) return [];
  const rows = list
    .map((entry: any, index) => {
      if (typeof entry === 'string') return { name: entry, level: 3, index };
      const name = nameKeys.map((k) => entry?.[k]).find((v) => typeof v === 'string' && v);
      return { name: name as string | undefined, level: Number(entry?.level ?? 3), index };
    })
    .filter((r): r is { name: string; level: number; index: number } => !!r.name && r.level >= minLevel)
    .sort((a, b) => b.level - a.level || a.index - b.index);
  return rows.slice(0, take).map((r) => r.name);
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function FactChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="shrink-0 rounded-[14px] border border-zinc-200 px-3 py-[9px] sm:min-w-[120px] sm:py-2.5">
      <p className="text-[12px] text-zinc-500">{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-[14px] font-semibold text-zinc-950 sm:text-[15px]">{value}</p>
    </div>
  );
}

const Spinner = ({ light }: { light?: boolean }) => (
  <div
    className={`h-4 w-4 animate-spin rounded-full border-2 border-t-transparent ${light ? 'border-white' : 'border-zinc-400'}`}
  />
);

const secondaryButton =
  'flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-zinc-300 bg-white text-[15px] font-semibold text-zinc-950 transition-colors hover:bg-zinc-50 disabled:opacity-50 sm:h-10';

export default function ThreadsProfileHeader({
  profile,
  talentUser,
  category,
  mode,
  onShortlist,
  onUnshortlist,
  shortlistLoading,
  isShortlisted,
  onSendOffer,
  sendOfferLoading,
  onNotAFit,
  notAFitLoading,
  cardEngagement,
  onMessage,
  messageLoading,
  editProfileHref,
  worksCount,
}: ThreadsProfileHeaderProps) {
  const [bioExpanded, setBioExpanded] = useState(false);
  const fields = (category?.fields ?? []).filter((f) => f.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const fieldData = profile.field_data ?? {};
  const bio = extractBio(fields, fieldData);
  const website = extractWebsite(fields, fieldData);
  const isVerified = profile.status === 'approved';
  const showPrice = hasEngagementPrice(mode, cardEngagement);

  const location =
    [talentUser.city, talentUser.current_district, talentUser.state, talentUser.country]
      .filter((p): p is string => !!p && p.trim().length > 0)
      .join(', ') || talentUser.current_location;

  // ---- Summary line + fact strip ----
  const experience = readExperience(fieldData);
  const experienceShort = experience
    ? `${experience.years + (experience.months >= 6 ? 0.5 : 0)} yrs experience`
    : null;
  const metaLine = [
    experienceShort,
    worksCount ? `${worksCount} ${worksCount === 1 ? 'work' : 'works'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const expertOn = topNames(fieldData._categories, ['category', 'skill'], 2, 5);
  const bestAt = topNames(fieldData._skills, ['skill'], 1);
  const languageCodes = (talentUser.languages_spoken ?? [])
    .map((l) => l.language?.trim().slice(0, 2).toUpperCase())
    .filter(Boolean);
  const ageGender = [
    talentUser.age != null ? String(talentUser.age) : null,
    talentUser.gender ? capitalize(talentUser.gender) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const facts: { label: string; value: string }[] = [];
  if (experience) {
    facts.push({
      label: 'Experience',
      value: [experience.years ? `${experience.years} yrs` : null, experience.months ? `${experience.months} mo` : null]
        .filter(Boolean)
        .join(' '),
    });
  }
  if (expertOn.length) facts.push({ label: 'Expert on', value: expertOn.join(', ') });
  if (bestAt.length) facts.push({ label: 'Best at', value: bestAt[0] });
  if (languageCodes.length) facts.push({ label: 'Languages', value: languageCodes.join(' · ') });
  if (ageGender) facts.push({ label: 'Age', value: ageGender });

  // ---- Business actions ----
  // With a card price box the offer lives there, so the header's second
  // button is always the chatroom (disabled until the talent is shortlisted).
  const offerInHeader = !!onSendOffer && !showPrice;

  return (
    <div className="pt-2 sm:pt-6">
      <div className="px-4 sm:px-6">
        {/* Name + Avatar row */}
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 pt-1.5">
            <h1 className="text-[24px] font-bold leading-[1.1] tracking-tight text-zinc-950 sm:text-[28px]">
              {talentUser.full_name}
            </h1>
            {category && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-[14px] text-zinc-950 sm:text-[15px]">{category.name}</span>
                {profile.tier && <TierBadge tier={profile.tier} tierCustom={profile.tier_custom} />}
              </div>
            )}
            {location && (
              <p className="mt-1.5 flex items-center gap-1 text-[13px] text-zinc-500 sm:text-[14px]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {location}
              </p>
            )}
          </div>

          <div className="relative shrink-0">
            <div className="h-[72px] w-[72px] overflow-hidden rounded-full bg-zinc-100 sm:h-[84px] sm:w-[84px]">
              {talentUser.profile_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={talentUser.profile_photo_url}
                  alt={talentUser.full_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-200 text-2xl font-semibold text-zinc-500 sm:text-[28px]">
                  {talentUser.full_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {isVerified && (
              <svg width="24" height="24" viewBox="0 0 24 24" role="img" aria-label="Verified" className="absolute -bottom-0.5 -left-0.5">
                <circle cx="12" cy="12" r="11" fill="#1A66D9" stroke="#fff" strokeWidth="2" />
                <path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>

        {/* Bio — clamped on phones with a "more" toggle */}
        {bio && (
          <div className="mt-3 sm:mt-3.5">
            <p
              className={`whitespace-pre-line text-[15px] leading-[1.45] text-zinc-950 sm:leading-normal ${
                bioExpanded ? '' : 'line-clamp-3 sm:line-clamp-none'
              }`}
            >
              {bio}
            </p>
            {!bioExpanded && bio.length > 140 && (
              <button
                type="button"
                onClick={() => setBioExpanded(true)}
                className="text-[15px] text-zinc-500 hover:text-zinc-700 sm:hidden"
              >
                more
              </button>
            )}
          </div>
        )}

        {website && (
          <a
            href={website.startsWith('http') ? website : `https://${website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[14.5px] font-semibold text-[#1A66D9] hover:text-[#124CA6]"
          >
            {website.replace(/^https?:\/\//, '')}
          </a>
        )}

        {metaLine && <p className="mt-2 text-[14px] text-zinc-500 sm:mt-2.5">{metaLine}</p>}

        {/* Action buttons */}
        {mode === 'business' ? (
          <div className="mt-3.5 grid grid-cols-2 gap-2 sm:mt-4">
            <button
              type="button"
              onClick={isShortlisted ? onUnshortlist : onShortlist}
              disabled={shortlistLoading}
              aria-pressed={isShortlisted ? true : false}
              className={`flex h-11 items-center justify-center gap-1.5 rounded-[10px] text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:h-10 ${
                isShortlisted ? 'bg-emerald-700' : 'bg-zinc-950'
              }`}
            >
              {shortlistLoading ? (
                <Spinner light />
              ) : isShortlisted ? (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Shortlisted
                </>
              ) : (
                'Shortlist'
              )}
            </button>
            {onMessage ? (
              <button type="button" onClick={onMessage} disabled={messageLoading} className={secondaryButton}>
                {messageLoading ? <Spinner /> : 'Chatroom'}
              </button>
            ) : offerInHeader ? (
              <button type="button" onClick={onSendOffer} disabled={sendOfferLoading} className={secondaryButton}>
                {sendOfferLoading ? <Spinner /> : 'Send offer'}
              </button>
            ) : showPrice ? (
              <button
                type="button"
                disabled
                title="Shortlist this talent to open a chat"
                className={`${secondaryButton} cursor-not-allowed text-zinc-400`}
              >
                Chatroom
              </button>
            ) : (
              <button type="button" disabled className={`${secondaryButton} cursor-not-allowed text-zinc-400`}>
                Coming soon
              </button>
            )}
          </div>
        ) : (
          editProfileHref && (
            <Link
              href={editProfileHref}
              className={`${secondaryButton} mt-4 w-full`}
            >
              Edit profile
            </Link>
          )
        )}
      </div>

      {/* Fact strip — scrolls sideways */}
      {facts.length > 0 && (
        <div className="mt-3.5 flex gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-hide sm:mt-4 sm:px-6">
          {facts.map((f) => (
            <FactChip key={f.label} label={f.label} value={f.value} />
          ))}
        </div>
      )}

      <div className="px-4 sm:px-6">
        {/* Card price — phones get the sticky hire bar instead */}
        {showPrice && (
          <div className="mt-4 hidden rounded-[18px] bg-zinc-100 px-4 py-3.5 sm:block">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-[13px] text-zinc-500">
                {cardEngagement.card_type === 'assignment' ? 'This assignment' : 'This subscription'}
                {cardEngagement.brand_name ? ` · ${cardEngagement.brand_name}` : ''}
              </p>
              {cardEngagement.list_price != null && (
                <p className="text-[13px] text-zinc-500">
                  Card price{' '}
                  {formatEngagementAmount(cardEngagement.list_price, cardEngagement.currency, cardEngagement.period)}
                </p>
              )}
            </div>
            <p className="mt-1.5 text-[20px] font-bold tracking-tight text-zinc-950">
              {formatEngagementAmount(cardEngagement.amount, cardEngagement.currency, cardEngagement.period) ?? '—'}{' '}
              <span className="text-[14px] font-medium text-zinc-500">{engagementKindLabel(cardEngagement).toLowerCase()}</span>
            </p>
            {cardEngagement.kind === 'accepted_list' && (
              <p className="mt-1 text-[12px] text-zinc-500">Talent accepted the card at the set price (no bid).</p>
            )}
            {(onSendOffer || onNotAFit) && (
              <div className={`mt-3 grid gap-2 ${onSendOffer && onNotAFit ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {onSendOffer && (
                  <button type="button" onClick={onSendOffer} disabled={sendOfferLoading} className={`${secondaryButton} text-[14px]`}>
                    {sendOfferLoading ? <Spinner /> : 'Send offer'}
                  </button>
                )}
                {onNotAFit && (
                  <button type="button" onClick={onNotAFit} disabled={notAFitLoading} className={`${secondaryButton} text-[14px]`}>
                    {notAFitLoading ? <Spinner /> : 'Not a fit'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Reviewer asked for changes */}
        {mode === 'talent' && needsProfileResubmission(profile) && (
          <div className="mt-4">
            <RequestedChangesBanner
              profileId={profile.id}
              changes={profile.requested_changes ?? []}
              requestedAt={profile.changes_requested_at}
              staysLive={profile.status === 'approved'}
              isDraft={isNudgedDraft(profile)}
            />
          </div>
        )}

        {/* Rejection reason */}
        {mode === 'talent' && profile.status !== 'changes_requested' && profile.rejection_reason && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-800">Rejection Reason</p>
            <p className="mt-0.5 text-sm text-red-700">{profile.rejection_reason}</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ThreadsHireBarProps {
  engagement: CardEngagementDisplay;
  onSendOffer?: () => void;
  sendOfferLoading?: boolean;
}

/**
 * Phone-only bottom bar with the card price and "Send offer". Sits above the
 * business bottom nav (64px). Pair it with a spacer at the end of the page.
 */
export function ThreadsHireBar({ engagement, onSendOffer, sendOfferLoading }: ThreadsHireBarProps) {
  const listPrice = formatEngagementAmount(engagement.list_price, engagement.currency, engagement.period);
  return (
    <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 border-t border-zinc-200 bg-white px-4 py-2.5 sm:hidden">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-bold text-zinc-950">
          {formatEngagementAmount(engagement.amount, engagement.currency, engagement.period) ?? '—'}
        </p>
        <p className="mt-px truncate text-[12px] text-zinc-500">
          {engagementKindLabel(engagement)}
          {listPrice ? ` · card ${listPrice}` : ''}
        </p>
      </div>
      {onSendOffer && (
        <button
          type="button"
          onClick={onSendOffer}
          disabled={sendOfferLoading}
          className="flex h-11 shrink-0 items-center justify-center rounded-[10px] bg-zinc-950 px-5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {sendOfferLoading ? <Spinner light /> : 'Send offer'}
        </button>
      )}
    </div>
  );
}
