'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import type {
  CategoryField,
  CategoryWithFields,
  GhostSourceProfile,
  PortfolioItem,
  Profile,
} from '@/types';
import ThreadsProfileShell from '@/components/profile/ThreadsProfileShell';
import ThreadsTopBar from '@/components/profile/ThreadsTopBar';
import ThreadsProfileHeader from '@/components/profile/ThreadsProfileHeader';
import ThreadsDetailSections from '@/components/profile/ThreadsDetailSections';
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

interface GhostProfileViewProps {
  ghostProfile: Profile | null;
  sourceProfiles: GhostSourceProfile[];
  talentUser: TalentUser;
  /** Admin previews are read-only. */
  mode: 'admin';
  isLoading: boolean;
  error?: string;
  onBack: () => void;
  onShare?: () => void;
}

/**
 * View for a ghost "Designer + Editor" profile.
 *
 * The ghost row carries no field_data of its own — it points to two source
 * profiles (Designer and Video Editor). This view shows the talent's basic
 * info once, then exposes the two source profiles via tabs so the viewer
 * can switch between them.
 */
export default function GhostProfileView({
  ghostProfile,
  sourceProfiles,
  talentUser,
  mode,
  isLoading,
  error,
  onBack,
  onShare,
}: GhostProfileViewProps) {
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [activePortfolioTab, setActivePortfolioTab] = useState('All');

  const activeSource = sourceProfiles[activeSourceIndex];

  const { data: activeFields } = useQuery<CategoryField[]>({
    queryKey: ['category-fields', activeSource?.category_id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/categories/${activeSource!.category_id}/fields`);
      return data.fields ?? data;
    },
    enabled: !!activeSource?.category_id,
  });

  const { skillGroups, toolGroups, aiToolGroups, skillGroupOrder } =
    useCategoryTemplateGroups(activeSource?.category_id);

  const fields = useMemo(
    () =>
      (activeFields ?? [])
        .filter((f) => f.is_active)
        .sort((a, b) => a.sort_order - b.sort_order),
    [activeFields]
  );

  const activeCategory: CategoryWithFields | null = useMemo(() => {
    if (!activeSource) return null;
    return {
      id: activeSource.category.id,
      name: activeSource.category.name,
      slug: activeSource.category.slug,
      is_active: true,
      created_at: '',
      updated_at: '',
      fields,
    };
  }, [activeSource, fields]);

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

  if (isLoading) {
    return (
      <div className="-m-6 min-h-full bg-white sm:bg-[#FAFAFA]">
        <ThreadsProfileSkeleton />
      </div>
    );
  }

  if (error || !ghostProfile || sourceProfiles.length === 0) {
    return (
      <div className="-m-6 min-h-full bg-white sm:bg-[#FAFAFA]">
        <ThreadsProfileShell topBar={<ThreadsTopBar displayName="" onBack={onBack} onShare={onShare} />}>
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

  const hasPortfolio = !!activeSource && activeSource.portfolio_items.length > 0;
  const worksCount = (activeSource?.portfolio_items ?? []).filter(
    (i: PortfolioItem) => i.file_type !== 'text'
  ).length;

  return (
    <div className="-m-6 min-h-full bg-white sm:bg-[#FAFAFA]">
      <ThreadsProfileShell
        topBar={
          <ThreadsTopBar
            displayName={talentUser.full_name}
            title="Profile"
            subtitle={activeCategory?.name}
            onBack={onBack}
            onShare={onShare}
          />
        }
      >
        <ThreadsProfileHeader
          profile={headerProfile}
          talentUser={talentUser}
          category={activeCategory}
          mode={mode}
          worksCount={worksCount}
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
          categorySlug={activeSource?.category.slug}
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
              authorName={talentUser.full_name}
            />
          </>
        )}

        <div className="h-4" />
      </ThreadsProfileShell>
    </div>
  );
}
