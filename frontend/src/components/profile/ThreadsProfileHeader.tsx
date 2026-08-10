'use client';

import Link from 'next/link';
import type { Profile, CategoryField, CategoryWithFields } from '@/types';
import TierBadge from '@/components/ui/TierBadge';

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
  /** When opened from a card review, enables "Send an Offer". */
  onSendOffer?: () => void;
  sendOfferLoading?: boolean;
  /** Price/bid for the specific card this profile was opened from. */
  cardEngagement?: CardEngagementDisplay | null;
  editProfileHref?: string;
}

function formatEngagementAmount(
  amount: number | null | undefined,
  currency?: string | null,
  period?: string | null,
): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const cur = !currency || currency === 'INR' ? '₹' : `${currency} `;
  const suffix = period === 'project' ? '' : '/mo';
  return `${cur}${amount.toLocaleString()}${suffix}`;
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

export default function ThreadsProfileHeader({
  profile,
  talentUser,
  category,
  mode,
  onShortlist,
  onUnshortlist,
  shortlistLoading,
  isShortlisted,
  onSendInterest,
  interestLoading,
  onSendOffer,
  sendOfferLoading,
  cardEngagement,
  editProfileHref,
}: ThreadsProfileHeaderProps) {
  const fields = (category?.fields ?? []).filter((f) => f.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const bio = extractBio(fields, profile.field_data);
  const website = extractWebsite(fields, profile.field_data);
  const isVerified = profile.status === 'approved';

  return (
    <div className="pt-6 px-6 pb-2">
      {/* Name + Avatar row */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-4 mt-1">
          <h1 className="text-[26px] sm:text-[28px] font-bold tracking-tight text-zinc-950 leading-none">
            {talentUser.full_name}
          </h1>
          {category && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-[15px] text-zinc-500">
                {category.name}
              </p>
              {profile.tier && (
                <TierBadge tier={profile.tier} tierCustom={profile.tier_custom} />
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="h-[84px] w-[84px] rounded-full overflow-hidden bg-gray-100">
            {talentUser.profile_photo_url ? (
              <img
                src={talentUser.profile_photo_url}
                alt={talentUser.full_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-200 text-2xl font-semibold text-gray-500">
                {talentUser.full_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {isVerified && (
            <div className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--threads-accent-green)] ring-2 ring-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Age & Gender — experience is shown once, in the detail section below
          (sourced from the canonical `_experience` field), so it's intentionally
          omitted here to avoid a duplicate/stale line. */}
      <div className="mt-2 flex items-center gap-1 text-[13px] text-zinc-500">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        {[
          talentUser.age != null ? `Age ${talentUser.age}` : null,
          talentUser.gender || null,
        ].filter(Boolean).join(' · ') || 'Age & gender not specified'}
      </div>

      {/* Location — prefer structured (city · district · state · country),
          fall back to free-text current_location if no structured data exists. */}
      {(() => {
        const structured = [
          talentUser.city,
          talentUser.current_district,
          talentUser.state,
          talentUser.country,
        ]
          .filter((p): p is string => !!p && p.trim().length > 0)
          .join(', ');
        const text = structured || talentUser.current_location;
        if (!text) return null;
        return (
          <div className="mt-1 flex items-center gap-1 text-[13px] text-zinc-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {text}
          </div>
        );
      })()}

      {/* Bio */}
      {bio && (
        <p className="mt-3 text-[14.5px] leading-relaxed text-zinc-800">
          {bio}
        </p>
      )}

      {/* Website */}
      {website && (
        <a
          href={website.startsWith('http') ? website : `https://${website}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[14.5px] font-semibold text-zinc-950 hover:underline"
        >
          {website.replace(/^https?:\/\//, '')}
        </a>
      )}

      {/* Card-scoped price: bid / accepted list price for the card this profile was opened from */}
      {mode === 'business' && cardEngagement && cardEngagement.kind !== 'none' && (
        <div className="mt-4 rounded-xl border border-[#E7E7EA] bg-[#FAFAFA] px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
            {cardEngagement.card_type === 'assignment' ? 'This assignment' : 'This subscription'}
            {cardEngagement.brand_name ? ` · ${cardEngagement.brand_name}` : ''}
          </p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-[family-name:var(--font-jakarta)] text-[18px] font-semibold text-[#0a0a0a]">
              {formatEngagementAmount(
                cardEngagement.amount,
                cardEngagement.currency,
                cardEngagement.period,
              ) ?? '—'}
            </span>
            <span className="text-xs font-medium text-[#525252]">
              {cardEngagement.kind === 'bid'
                ? 'Talent bid'
                : cardEngagement.kind === 'accepted_list'
                  ? 'Accepted list price'
                  : cardEngagement.kind === 'agreed'
                    ? 'Agreed price'
                    : cardEngagement.kind === 'business_offer'
                      ? 'Your offer'
                      : cardEngagement.label || 'Price'}
            </span>
          </div>
          {cardEngagement.list_price != null &&
            cardEngagement.amount != null &&
            cardEngagement.list_price !== cardEngagement.amount && (
              <p className="mt-1 text-[12px] text-[#737373]">
                Original card price{' '}
                <span className="font-semibold text-[#0a0a0a]">
                  {formatEngagementAmount(
                    cardEngagement.list_price,
                    cardEngagement.currency,
                    cardEngagement.period,
                  )}
                </span>
              </p>
            )}
          {cardEngagement.kind === 'accepted_list' && cardEngagement.list_price != null && (
            <p className="mt-1 text-[12px] text-[#737373]">
              Talent accepted the card at the set price (no bid).
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-5">
        {mode === 'business' ? (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={isShortlisted ? onUnshortlist : onShortlist}
              disabled={shortlistLoading}
              aria-pressed={isShortlisted ? true : false}
              className={`flex h-[40px] items-center justify-center gap-1.5 rounded-[10px] text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 ${
                isShortlisted
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-950 text-white'
              }`}
            >
              {shortlistLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : isShortlisted ? (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Shortlisted
                </>
              ) : (
                'Shortlist'
              )}
            </button>
            {onSendOffer ? (
              <button
                type="button"
                onClick={onSendOffer}
                disabled={sendOfferLoading}
                className="flex h-[40px] items-center justify-center gap-1.5 rounded-[10px] border border-zinc-200 bg-white text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                {sendOfferLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Send an Offer
                  </>
                )}
              </button>
            ) : (
              <button
                disabled
                className="relative flex h-[40px] items-center justify-center gap-1.5 rounded-[10px] border border-zinc-200 bg-white text-sm font-semibold text-zinc-400 cursor-not-allowed"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Coming Soon
              </button>
            )}
          </div>
        ) : (
          editProfileHref && (
            <Link
              href={editProfileHref}
              className="flex h-[40px] w-full items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-50"
            >
              Edit Profile
            </Link>
          )
        )}
      </div>

      {/* Rejection reason */}
      {mode === 'talent' && profile.rejection_reason && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-semibold text-red-800">Rejection Reason</p>
          <p className="mt-0.5 text-sm text-red-700">{profile.rejection_reason}</p>
        </div>
      )}
    </div>
  );
}
