'use client';

import { useState, useMemo } from 'react';
import type { CategoryField, CategoryWithFields, PortfolioItem, Profile } from '@/types';
import Modal from '@/components/ui/Modal';
import ThreadsProfileShell from '@/components/profile/ThreadsProfileShell';
import ThreadsTopBar from '@/components/profile/ThreadsTopBar';
import ThreadsProfileHeader from '@/components/profile/ThreadsProfileHeader';
import ThreadsDetailSections from '@/components/profile/ThreadsDetailSections';
import ThreadsPortfolioTabBar from '@/components/profile/ThreadsPortfolioTabBar';
import ThreadsPortfolioFeed from '@/components/profile/ThreadsPortfolioFeed';
import ThreadsProfileSkeleton from '@/components/profile/ThreadsProfileSkeleton';
import { useCategoryWithFields, useCategoryTemplateGroups } from '@/hooks/useCategories';

interface TalentUser {
  full_name: string;
  current_location?: string;
  profile_photo_url?: string;
  languages_spoken?: { language: string; proficiency: string }[];
  age?: number | null;
  gender?: string | null;
}

interface GhostSourceProfile {
  id: string;
  category_id: string;
  category: { id: string; name: string; slug: string };
  status: string;
  field_data: Record<string, any>;
  portfolio_items: PortfolioItem[];
}

interface GhostProfileViewProps {
  /** The ghost profile row itself (carries id, talent_user_id, etc.). */
  ghostProfile: Profile | null;
  /** Source profiles (Designer + Video Editor) with their portfolios. */
  sourceProfiles: GhostSourceProfile[];
  talentUser: TalentUser;
  mode: 'business' | 'talent';
  onShortlist?: () => void;
  onUnshortlist?: () => void;
  shortlistLoading?: boolean;
  isShortlisted?: boolean;
  onSendInterest?: (message: string) => void;
  interestLoading?: boolean;
  isLoading: boolean;
  error?: string;
  onBack: () => void;
}

/**
 * View for a ghost "Designer + Editor" profile.
 *
 * The ghost row carries no field_data of its own — it points to two source
 * profiles (Designer and Video Editor). This view shows the talent's basic
 * info once, then exposes the two source profiles via tabs so the viewer
 * can switch between them. Each tab reuses the existing Threads sub-
 * components (`ThreadsProfileHeader`, `ThreadsDetailSections`, portfolio)
 * so the rendering is consistent with non-ghost profile views.
 */
export default function GhostProfileView({
  ghostProfile,
  sourceProfiles,
  talentUser,
  mode,
  onShortlist,
  onUnshortlist,
  shortlistLoading,
  isShortlisted,
  onSendInterest,
  interestLoading,
  isLoading,
  error,
  onBack,
}: GhostProfileViewProps) {
  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const [interestMessage, setInterestMessage] = useState('');
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [activePortfolioTab, setActivePortfolioTab] = useState('All');

  const activeSource = sourceProfiles[activeSourceIndex];
  const { data: activeCategoryWithFields } = useCategoryWithFields(activeSource?.category.slug);
  const { skillGroups, toolGroups, aiToolGroups, skillGroupOrder } =
    useCategoryTemplateGroups(activeCategoryWithFields?.id);

  const fields = useMemo(
    () =>
      (activeCategoryWithFields?.fields ?? [])
        .filter((f: CategoryField) => f.is_active)
        .sort((a: CategoryField, b: CategoryField) => a.sort_order - b.sort_order),
    [activeCategoryWithFields]
  );

  const bioFieldKey = useMemo(() => {
    if (!activeSource) return undefined;
    const textareaField = fields
      .filter((f) => f.is_active && f.field_type === 'textarea')
      .sort((a, b) => a.sort_order - b.sort_order)[0];
    if (!textareaField) return undefined;
    const val = activeSource.field_data?.[textareaField.field_key];
    return val && typeof val === 'string' ? textareaField.field_key : undefined;
  }, [fields, activeSource]);

  const groupOrder = useMemo(
    () => (skillGroupOrder ?? []).filter((g) => g !== ''),
    [skillGroupOrder]
  );

  const portfolioTabs = useMemo(() => {
    if (!activeSource || activeSource.portfolio_items.length === 0) return [];
    const named = new Set<string>();
    let hasUncategorized = false;
    for (const item of activeSource.portfolio_items) {
      if (item.category_name) named.add(item.category_name);
      else hasUncategorized = true;
    }
    const tabs = ['All', ...Array.from(named)];
    if (hasUncategorized) tabs.push('Other');
    return tabs;
  }, [activeSource]);

  // Reset portfolio sub-tab when switching source.
  const handleSourceChange = (idx: number) => {
    setActiveSourceIndex(idx);
    setActivePortfolioTab('All');
  };

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

  if (error || !ghostProfile || sourceProfiles.length === 0) {
    return (
      <div className="-m-4 sm:-m-6 lg:-m-8 min-h-full bg-[#FAFAFA]">
        <ThreadsProfileShell topBar={<ThreadsTopBar displayName="" onBack={onBack} />}>
          <div className="flex flex-col items-center justify-center py-20 px-5">
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

  // Build a synthetic profile object that ThreadsProfileHeader can render.
  // Header shows the active source's field_data so bio + website pull from
  // the currently-selected source.
  const headerProfile: Profile = {
    ...ghostProfile,
    field_data: activeSource?.field_data ?? {},
  };

  const hasPortfolio = activeSource && activeSource.portfolio_items.length > 0;

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 min-h-full bg-[#FAFAFA]">
      <ThreadsProfileShell
        topBar={<ThreadsTopBar displayName={talentUser.full_name} onBack={onBack} />}
      >
        <ThreadsProfileHeader
          profile={headerProfile}
          talentUser={talentUser}
          category={activeCategoryWithFields ?? null}
          mode={mode}
          onShortlist={onShortlist}
          onUnshortlist={onUnshortlist}
          shortlistLoading={shortlistLoading}
          isShortlisted={isShortlisted}
          onSendInterest={() => setInterestModalOpen(true)}
          interestLoading={interestLoading}
        />

        {/* Source switcher: lets the viewer flip between Designer and
            Video Editor sub-profiles for the same talent. */}
        <div className="border-b border-zinc-200 bg-white px-5">
          <div className="flex gap-1">
            {sourceProfiles.map((sp, i) => (
              <button
                key={sp.id}
                onClick={() => handleSourceChange(i)}
                className={
                  i === activeSourceIndex
                    ? 'border-b-2 border-zinc-950 px-3 py-3 text-[14px] font-semibold text-zinc-950'
                    : 'border-b-2 border-transparent px-3 py-3 text-[14px] font-medium text-zinc-500 hover:text-zinc-900'
                }
              >
                {sp.category.name}
              </button>
            ))}
          </div>
        </div>

        <ThreadsDetailSections
          fields={fields}
          fieldData={activeSource?.field_data ?? {}}
          bioFieldKey={bioFieldKey}
          languages={talentUser.languages_spoken}
          groupMaps={{
            skills: skillGroups,
            tools: toolGroups,
            aiTools: aiToolGroups,
            groupOrder,
          }}
        />

        {hasPortfolio && (
          <>
            <ThreadsPortfolioTabBar
              tabs={portfolioTabs}
              activeTab={activePortfolioTab}
              onTabChange={setActivePortfolioTab}
            />
            <ThreadsPortfolioFeed
              items={activeSource!.portfolio_items}
              activeTab={activePortfolioTab}
            />
          </>
        )}

        <div className="h-4" />
      </ThreadsProfileShell>

      <Modal
        open={interestModalOpen}
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
