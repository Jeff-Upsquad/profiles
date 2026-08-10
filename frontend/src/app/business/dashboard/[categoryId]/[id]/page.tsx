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

  const offerModal = useMemo(
    () =>
      canSendOffer ? (
        <OfferAmountStepperModal
          open={offerOpen}
          title="Send an Offer"
          submitLabel="Send offer"
          currency="INR"
          period="per_month"
          initialAmount={snapOfferAmount(500)}
          pending={sendOffer.isPending}
          onClose={() => setOfferOpen(false)}
          onSubmit={(amount, note) => {
            if (!recipientId) return;
            sendOffer.mutate(
              { recipientId, amount, ...(note ? { note } : {}) },
              { onSuccess: () => setOfferOpen(false) },
            );
          }}
          hint="Increase or decrease in steps of ₹500. This talent will be shortlisted automatically."
        />
      ) : null,
    [canSendOffer, offerOpen, recipientId, sendOffer],
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
