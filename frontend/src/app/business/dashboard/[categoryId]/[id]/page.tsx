'use client';

import { use, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useSharedProfile,
  useBusinessPortfolio,
  useAddToShortlist,
  useRemoveFromShortlist,
  useShortlist,
  useSendInterest,
} from '@/hooks/useBusiness';
import { useCategoryWithFields } from '@/hooks/useCategories';
import { useBusinessSendOffer } from '@/hooks/useBusinessAssignmentOffers';
import ThreadsProfileView from '@/views/shared/ThreadsProfileView';
import GhostProfileView from '@/views/shared/GhostProfileView';
import OfferAmountStepperModal, { snapOfferAmount } from '@/components/subscriptions/OfferAmountStepper';

interface Params {
  categoryId: string;
  id: string;
}

export default function DashboardProfilePage(props: { params: Promise<Params> }) {
  const params = use(props.params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardId = searchParams.get('cardId');
  const recipientId = searchParams.get('recipientId');

  const { data: profile, isLoading: profileLoading, error: profileError } = useSharedProfile(
    params.categoryId,
    params.id,
    cardId,
  );
  const { data: portfolioItems } = useBusinessPortfolio(params.categoryId, params.id, cardId);

  const categorySlug = (profile as any)?.category?.slug;
  const { data: categoryWithFields } = useCategoryWithFields(categorySlug);

  const { data: shortlist } = useShortlist();
  const addToShortlist = useAddToShortlist();
  const removeFromShortlist = useRemoveFromShortlist();
  const sendInterest = useSendInterest();
  const sendOffer = useBusinessSendOffer(cardId || '');
  const [offerOpen, setOfferOpen] = useState(false);

  const isShortlisted = !!profile && (shortlist ?? []).some((p) => p.id === profile.id);
  const canSendOffer = !!(cardId && recipientId);

  const talentUser = {
    full_name: (profile as any)?.talent_user?.full_name ?? 'Unknown',
    current_location: (profile as any)?.talent_user?.current_location,
    profile_photo_url: (profile as any)?.talent_user?.profile_photo_url,
    languages_spoken: (profile as any)?.talent_user?.languages_spoken,
    age: (profile as any)?.talent_user?.age,
    gender: (profile as any)?.talent_user?.gender,
  };

  const isGhost = (profile as any)?.is_ghost === true;
  const sourceProfiles = (profile as any)?.source_profiles ?? [];
  const cardEngagement = (profile as any)?.card_engagement ?? null;

  // Prefer the figure this talent already accepted (bid / agreed / list price).
  const acceptedFigure = useMemo(() => {
    const eng = cardEngagement as {
      amount?: number | null;
      list_price?: number | null;
      kind?: string | null;
      currency?: string | null;
      period?: string | null;
    } | null;
    const bidOrAgreed =
      eng?.amount != null && Number.isFinite(eng.amount) && eng.amount > 0
        ? eng.amount
        : null;
    const list =
      eng?.list_price != null && Number.isFinite(eng.list_price) && eng.list_price > 0
        ? eng.list_price
        : null;
    const amount = bidOrAgreed ?? list ?? 500;
    const kind = eng?.kind ?? null;
    const referenceLabel =
      kind === 'bid'
        ? "Talent's bid"
        : kind === 'agreed'
          ? 'Agreed price'
          : kind === 'accepted_list' || (bidOrAgreed == null && list != null)
            ? 'List price'
            : kind === 'business_offer'
              ? 'Your last offer'
              : 'Original';
    return {
      amount,
      currency: eng?.currency || 'INR',
      period: (eng?.period as 'per_month' | 'project' | undefined) || 'per_month',
      referenceLabel,
    };
  }, [cardEngagement]);

  const offerModal = useMemo(
    () =>
      canSendOffer ? (
        <OfferAmountStepperModal
          open={offerOpen}
          title="Send an Offer"
          submitLabel="Send offer"
          currency={acceptedFigure.currency}
          period={acceptedFigure.period}
          initialAmount={snapOfferAmount(acceptedFigure.amount)}
          referenceAmount={acceptedFigure.amount}
          referenceLabel={acceptedFigure.referenceLabel}
          pending={sendOffer.isPending}
          onClose={() => setOfferOpen(false)}
          onSubmit={(amount, note) => {
            if (!recipientId) return;
            sendOffer.mutate(
              { recipientId, amount, ...(note ? { note } : {}) },
              { onSuccess: () => setOfferOpen(false) },
            );
          }}
          hint="Starts at this talent's accepted price. Increase or decrease in steps of ₹500. They will be shortlisted automatically."
        />
      ) : null,
    [canSendOffer, offerOpen, recipientId, sendOffer, acceptedFigure],
  );

  if (isGhost) {
    return (
      <>
        <GhostProfileView
          ghostProfile={profile ?? null}
          sourceProfiles={sourceProfiles}
          talentUser={talentUser}
          mode="business"
          onShortlist={() => profile && addToShortlist.mutate(profile.id)}
          onUnshortlist={() => profile && removeFromShortlist.mutate(profile.id)}
          shortlistLoading={addToShortlist.isPending || removeFromShortlist.isPending}
          isShortlisted={isShortlisted}
          onSendInterest={(message) => profile && sendInterest.mutate({ profileId: profile.id, message })}
          interestLoading={sendInterest.isPending}
          isLoading={profileLoading}
          error={profileError ? 'Failed to load profile' : undefined}
          onBack={() => router.push(`/business/dashboard/${params.categoryId}`)}
        />
        {offerModal}
      </>
    );
  }

  return (
    <>
      <ThreadsProfileView
        profile={profile ?? null}
        talentUser={talentUser}
        category={categoryWithFields ?? null}
        portfolioItems={portfolioItems}
        mode="business"
        onShortlist={() => profile && addToShortlist.mutate(profile.id)}
        onUnshortlist={() => profile && removeFromShortlist.mutate(profile.id)}
        shortlistLoading={addToShortlist.isPending || removeFromShortlist.isPending}
        isShortlisted={isShortlisted}
        onSendInterest={(message) => profile && sendInterest.mutate({ profileId: profile.id, message })}
        interestLoading={sendInterest.isPending}
        onSendOffer={canSendOffer ? () => setOfferOpen(true) : undefined}
        sendOfferLoading={sendOffer.isPending}
        cardEngagement={cardEngagement}
        isLoading={profileLoading}
        error={profileError ? 'Failed to load profile' : undefined}
        onBack={() =>
          cardId
            ? router.push(`/business/dashboard/cards/${cardId}`)
            : router.push(`/business/dashboard/${params.categoryId}`)
        }
      />
      {offerModal}
    </>
  );
}
