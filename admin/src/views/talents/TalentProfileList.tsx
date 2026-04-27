import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import TierBadge from '@/components/ui/TierBadge';

interface TalentProfile {
  id: string;
  status: string;
  is_active: boolean;
  created_at: string;
  talent_users?: {
    full_name: string;
    profile_photo_url?: string;
    current_location?: string;
    is_active?: boolean;
  };
  categories?: { name: string };
  tier: 'junior' | 'pro' | 'elite' | 'custom' | null;
  tier_custom: string | null;
}

const statusVariant: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  approved: 'green',
  pending_review: 'yellow',
  rejected: 'red',
  draft: 'gray',
  inactive: 'gray',
};

export default function TalentProfileList({ categoryId }: { categoryId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: profiles, isLoading } = useQuery<TalentProfile[]>({
    queryKey: ['talent-profiles', categoryId, search],
    queryFn: async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const { data } = await api.get(`/admin/talents/categories/${categoryId}/profiles${params}`);
      return data.profiles ?? data;
    },
  });

  const deleteProfile = useMutation({
    mutationFn: async (profileId: string) => {
      await api.delete(`/admin/talents/profiles/${profileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-profiles', categoryId] });
      queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
      toast.success('Profile moved to recycle bin');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete profile');
    },
  });

  const categoryName = profiles?.[0]?.categories?.name ?? 'Category';

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => router.push('/talents')}
          className="mb-2 text-sm text-gray-500 hover:text-indigo-600"
        >
          &larr; Back to Categories
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{categoryName} Profiles</h1>
        <p className="mt-1 text-sm text-gray-500">{profiles?.length ?? 0} profiles</p>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      ) : (profiles ?? []).length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          <p className="text-lg font-medium">No profiles found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(profiles ?? []).map((profile) => (
                <tr key={profile.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {profile.talent_users?.profile_photo_url ? (
                        <img
                          src={profile.talent_users.profile_photo_url}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-600">
                          {profile.talent_users?.full_name?.charAt(0) ?? '?'}
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {profile.talent_users?.full_name ?? 'Unknown'}
                      </span>
                      <TierBadge tier={profile.tier} tierCustom={profile.tier_custom} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {profile.talent_users?.current_location ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={statusVariant[profile.status] ?? 'gray'}>
                        {profile.status.replace('_', ' ')}
                      </Badge>
                      {!profile.is_active && <Badge variant="gray">Hidden</Badge>}
                      {profile.talent_users?.is_active === false && (
                        <Badge variant="gray">Talent hidden</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link href={`/talents/${categoryId}/${profile.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        loading={deleteProfile.isPending && deleteProfile.variables === profile.id}
                        onClick={() => {
                          if (
                            confirm(
                              'Delete this profile? It will be moved to the recycle bin and can be restored later.'
                            )
                          ) {
                            deleteProfile.mutate(profile.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
