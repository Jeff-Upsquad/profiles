import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useMyCategories, useSharedProfiles } from '@/hooks/useBusiness';
import Card from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function BusinessDashboard() {
  const { user } = useAuth();
  const { data: categories, isLoading: catLoading } = useMyCategories();
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);

  // Set first category as active once loaded
  const activeCatId = activeCategory ?? categories?.[0]?.id;

  const { data: profiles, isLoading: profilesLoading } = useSharedProfiles(activeCatId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome{user?.company_name ? `, ${user.company_name}` : ''}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse profiles shared with you across your subscribed categories.
        </p>
      </div>

      {/* Category Tabs */}
      {catLoading ? (
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-28 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      ) : !categories?.length ? (
        <Card>
          <div className="py-8 text-center">
            <p className="text-gray-500">No categories have been assigned to your account yet.</p>
            <p className="mt-1 text-sm text-gray-400">
              Please contact the administrator for access.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeCatId === cat.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Profiles Grid */}
          {profilesLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : !profiles?.length ? (
            <Card>
              <div className="py-8 text-center">
                <p className="text-gray-500">No profiles have been shared in this category yet.</p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile: any) => (
                <Link
                  key={profile.id}
                  href={`/business/discover/${profile.category?.slug ?? activeCatId}/${profile.id}`}
                >
                  <Card className="cursor-pointer transition-shadow hover:shadow-md">
                    <div className="flex items-start gap-3">
                      {profile.talent_user?.profile_photo_url ? (
                        <img
                          src={profile.talent_user.profile_photo_url}
                          alt=""
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-semibold">
                          {(profile.talent_user?.full_name ?? '?')[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {profile.talent_user?.full_name ?? 'Unknown'}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">
                          {profile.talent_user?.current_location ?? 'No location'}
                        </p>
                        {profile.field_data?.designation && (
                          <p className="mt-1 text-xs text-indigo-600 font-medium">
                            {profile.field_data.designation}
                          </p>
                        )}
                      </div>
                    </div>

                    {profile.talent_user?.languages_spoken?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {profile.talent_user.languages_spoken.slice(0, 3).map((lang: string) => (
                          <span
                            key={lang}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                          >
                            {lang}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
