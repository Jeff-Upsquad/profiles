'use client';

import { useMemo, useState } from 'react';
import type { Profile, CategoryWithFields, PortfolioItem, CategoryField } from '@/types';
import ThreadsProfileShell from '@/components/profile/ThreadsProfileShell';
import ThreadsTopBar from '@/components/profile/ThreadsTopBar';
import ThreadsProfileHeader from '@/components/profile/ThreadsProfileHeader';
import ThreadsDetailSections, { summarizeDetailSections } from '@/components/profile/ThreadsDetailSections';
import ThreadsSkillsSheet from '@/components/profile/ThreadsSkillsSheet';
import ThreadsPortfolioTabBar from '@/components/profile/ThreadsPortfolioTabBar';
import ThreadsPortfolioFeed from '@/components/profile/ThreadsPortfolioFeed';
import ThreadsProfileSkeleton from '@/components/profile/ThreadsProfileSkeleton';
import { useCategoryTemplateGroups } from '@/hooks/useCategories';

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

interface ThreadsProfileViewProps {
  profile: (Profile & { rejection_reason?: string }) | null;
  talentUser: TalentUser;
  category: CategoryWithFields | null;
  portfolioItems?: PortfolioItem[];
  /** Admin previews are read-only. */
  mode: 'admin';
  isLoading: boolean;
  error?: string;
  onBack: () => void;
  onShare?: () => void;
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
  isLoading,
  error,
  onBack,
  onShare,
}: ThreadsProfileViewProps) {
  const [activeTab, setActiveTab] = useState('Feed');

  const { skillGroups, toolGroups, aiToolGroups, skillGroupOrder } =
    useCategoryTemplateGroups(category?.id);

  const portfolioTabs = useMemo(() => {
    if (!portfolioItems || portfolioItems.length === 0) return [];
    // Tabs are driven by category_name. Items with no category fall under
    // "Other" so legacy uploads stay visible.
    const named = new Set<string>();
    let hasUncategorized = false;
    for (const item of portfolioItems) {
      if (item.category_name) named.add(item.category_name);
      else hasUncategorized = true;
    }
    const tabs = ['Feed', ...Array.from(named)];
    if (hasUncategorized) tabs.push('Other');
    return tabs;
  }, [portfolioItems]);

  const groupOrder = useMemo(
    () => (skillGroupOrder ?? []).filter((g) => g !== ''),
    [skillGroupOrder]
  );

  const fields = useMemo(
    () => (category?.fields ?? []).filter((f) => f.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [category]
  );

  const bioFieldKey = useMemo(
    () => (profile ? findBioFieldKey(fields, profile.field_data) : undefined),
    [fields, profile]
  );

  const pageClass = '-m-6 min-h-full bg-white sm:bg-[#FAFAFA]';

  if (isLoading) {
    return (
      <div className={pageClass}>
        <ThreadsProfileSkeleton />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={pageClass}>
        <ThreadsProfileShell
          topBar={<ThreadsTopBar displayName="" onBack={onBack} onShare={onShare} />}
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

  const hasPortfolio = !!portfolioItems && portfolioItems.length > 0;
  const worksCount = (portfolioItems ?? []).filter((i) => i.file_type !== 'text').length;

  const detailProps = {
    fields,
    fieldData: profile.field_data,
    bioFieldKey,
    languages: talentUser.languages_spoken,
    categorySlug: category?.slug,
    groupMaps: {
      skills: skillGroups,
      tools: toolGroups,
      aiTools: aiToolGroups,
      groupOrder,
    },
  };
  const detailSummary = summarizeDetailSections(profile.field_data ?? {});
  const hasDetailSections =
    !!detailSummary || fields.length > 0 || (talentUser.languages_spoken?.length ?? 0) > 0;

  return (
    <div className={pageClass}>
      <ThreadsProfileShell
        topBar={
          <ThreadsTopBar
            displayName={talentUser.full_name}
            title="Profile"
            subtitle={category?.name}
            onBack={onBack}
            onShare={onShare}
          />
        }
        rail={hasDetailSections ? <ThreadsDetailSections {...detailProps} variant="rail" /> : undefined}
      >
        <ThreadsProfileHeader
          profile={profile}
          talentUser={talentUser}
          category={category}
          mode={mode}
          worksCount={worksCount}
        />

        {hasDetailSections && (
          <ThreadsSkillsSheet summary={detailSummary}>
            <ThreadsDetailSections {...detailProps} variant="sheet" />
          </ThreadsSkillsSheet>
        )}

        {/* Portfolio feed */}
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
              authorName={talentUser.full_name}
            />
          </>
        )}

        {!hasPortfolio && <div className="h-5" />}
      </ThreadsProfileShell>
    </div>
  );
}
