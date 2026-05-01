'use client';

import { useState, useMemo } from 'react';
import type { Profile, CategoryWithFields, PortfolioItem, CategoryField } from '@/types';
import Modal from '@/components/ui/Modal';
import ThreadsProfileShell from '@/components/profile/ThreadsProfileShell';
import ThreadsTopBar from '@/components/profile/ThreadsTopBar';
import ThreadsProfileHeader from '@/components/profile/ThreadsProfileHeader';
import ThreadsDetailSections from '@/components/profile/ThreadsDetailSections';
import ThreadsPortfolioTabBar from '@/components/profile/ThreadsPortfolioTabBar';
import ThreadsPortfolioFeed from '@/components/profile/ThreadsPortfolioFeed';
import ThreadsProfileSkeleton from '@/components/profile/ThreadsProfileSkeleton';

interface TalentUser {
  full_name: string;
  current_location?: string;
  profile_photo_url?: string;
  languages_spoken?: { language: string; proficiency: string }[];
  age?: number | null;
  gender?: string | null;
}

interface ThreadsProfileViewProps {
  profile: (Profile & { rejection_reason?: string }) | null;
  talentUser: TalentUser;
  category: CategoryWithFields | null;
  portfolioItems?: PortfolioItem[];
  mode: 'business' | 'talent' | 'admin';
  onShortlist?: () => void;
  shortlistLoading?: boolean;
  onSendInterest?: (message: string) => void;
  interestLoading?: boolean;
  editProfileHref?: string;
  isLoading: boolean;
  error?: string;
  onBack: () => void;
}

function findBioFieldKey(fields: CategoryField[], fieldData: Record<string, any>): string | undefined {
  const textareaField = fields
    .filter((f) => f.is_active && f.field_type === 'textarea')
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  if (!textareaField) return undefined;
  const val = fieldData?.[textareaField.field_key];
  return val && typeof val === 'string' ? textareaField.field_key : undefined;
}

export default function ThreadsProfileView({
  profile,
  talentUser,
  category,
  portfolioItems,
  mode,
  onShortlist,
  shortlistLoading,
  onSendInterest,
  interestLoading,
  editProfileHref,
  isLoading,
  error,
  onBack,
}: ThreadsProfileViewProps) {
  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const [interestMessage, setInterestMessage] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  const portfolioTabs = useMemo(() => {
    if (!portfolioItems || portfolioItems.length === 0) return [];
    const skills = [...new Set(portfolioItems.map((i) => i.skill_name))];
    return ['All', ...skills];
  }, [portfolioItems]);

  const fields = useMemo(
    () => (category?.fields ?? []).filter((f) => f.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [category]
  );

  const bioFieldKey = useMemo(
    () => (profile ? findBioFieldKey(fields, profile.field_data) : undefined),
    [fields, profile]
  );

  const handleSendInterest = () => {
    if (!interestMessage.trim() || !onSendInterest) return;
    onSendInterest(interestMessage);
    setInterestModalOpen(false);
    setInterestMessage('');
  };

  if (isLoading) {
    return (
      <div className="-m-4 sm:-m-6 lg:-m-8 min-h-full bg-[#FAFAFA]">
        <ThreadsProfileSkeleton />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="-m-4 sm:-m-6 lg:-m-8 min-h-full bg-[#FAFAFA]">
        <ThreadsProfileShell
          topBar={<ThreadsTopBar displayName="" onBack={onBack} />}
        >
          <div className="flex flex-col items-center justify-center py-20 px-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="mt-4 text-[15px] font-medium text-zinc-950">
              {error || 'Profile not found'}
            </p>
            <button
              onClick={onBack}
              className="mt-3 text-[14px] font-medium text-zinc-500 hover:underline"
            >
              Go back
            </button>
          </div>
        </ThreadsProfileShell>
      </div>
    );
  }

  const hasPortfolio = portfolioItems && portfolioItems.length > 0;

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 min-h-full bg-[#FAFAFA]">
      <ThreadsProfileShell
        topBar={<ThreadsTopBar displayName={talentUser.full_name} onBack={onBack} />}
      >
        <ThreadsProfileHeader
          profile={profile}
          talentUser={talentUser}
          category={category}
          mode={mode}
          onShortlist={onShortlist}
          shortlistLoading={shortlistLoading}
          onSendInterest={() => setInterestModalOpen(true)}
          interestLoading={interestLoading}
          editProfileHref={editProfileHref}
        />

        <ThreadsDetailSections
          fields={fields}
          fieldData={profile.field_data}
          bioFieldKey={bioFieldKey}
          languages={talentUser.languages_spoken}
          categorySlug={category?.slug}
        />

        {hasPortfolio && (
          <>
            <ThreadsPortfolioTabBar
              tabs={portfolioTabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            <ThreadsPortfolioFeed
              items={portfolioItems!}
              activeTab={activeTab}
            />
          </>
        )}

        {mode === 'talent' && !hasPortfolio && (
          <>
            <div className="flex flex-col items-center justify-center py-16 px-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <p className="mt-3 text-[14px] text-zinc-500">No portfolio items yet</p>
            </div>
          </>
        )}

        <div className="h-4" />
      </ThreadsProfileShell>

      <Modal
        isOpen={interestModalOpen}
        onClose={() => setInterestModalOpen(false)}
        title="Send Interest Request"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Send a message to this talent to express your interest in hiring them.
          </p>
          <textarea
            rows={4}
            value={interestMessage}
            onChange={(e) => setInterestMessage(e.target.value)}
            placeholder="Tell the talent about the opportunity..."
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setInterestModalOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSendInterest}
              disabled={!interestMessage.trim() || interestLoading}
              className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {interestLoading ? 'Sending...' : 'Send Interest'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
