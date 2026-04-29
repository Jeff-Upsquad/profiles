import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';

interface DeletedProfile {
  id: string;
  talent_user_id: string;
  category_id: string;
  status: string;
  field_data: Record<string, any>;
  deleted_at: string;
  created_at: string;
  talent_users?: { full_name: string };
  categories?: { name: string };
}

interface ConflictState {
  profileId: string;
  archived: DeletedProfile;
  existing: DeletedProfile;
}

export default function RecycleBin() {
  const queryClient = useQueryClient();
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  const { data: profiles, isLoading } = useQuery<DeletedProfile[]>({
    queryKey: ['recycle-bin'],
    queryFn: async () => {
      const { data } = await api.get('/admin/recycle-bin');
      return data.profiles ?? data;
    },
  });

  const restoreProfile = useMutation({
    mutationFn: async ({
      profileId,
      replaceProfileId,
    }: {
      profileId: string;
      replaceProfileId?: string;
    }) => {
      const { data } = await api.patch(`/admin/recycle-bin/${profileId}/restore`, {
        replace_profile_id: replaceProfileId,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
      setConflict(null);
      toast.success('Profile restored and set to pending review');
    },
    onError: (err: any) => {
      if (err.response?.status === 409 && err.response?.data?.conflict) {
        const { archived, existing } = err.response.data;
        setConflict({ profileId: archived.id, archived, existing });
        return;
      }
      toast.error(err.response?.data?.message || 'Failed to restore profile');
    },
  });

  const permanentDelete = useMutation({
    mutationFn: async (profileId: string) => {
      await api.delete(`/admin/recycle-bin/${profileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
      toast.success('Profile permanently deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete profile');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Archive</h1>
        <p className="mt-1 text-sm text-gray-500">
          {profiles?.length ?? 0} archived profiles. Restore or permanently delete.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      ) : (profiles ?? []).length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          <p className="text-lg font-medium">Archive is empty</p>
          <p className="mt-1 text-sm">No archived profiles to show.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Talent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Deleted At
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Original Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(profiles ?? []).map((profile) => (
                <tr key={profile.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {profile.talent_users?.full_name ?? 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {profile.categories?.name ?? 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {profile.deleted_at ? new Date(profile.deleted_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="gray">{profile.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        loading={restoreProfile.isPending}
                        onClick={() =>
                          restoreProfile.mutate({ profileId: profile.id })
                        }
                      >
                        Restore
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={permanentDelete.isPending}
                        onClick={() => {
                          if (
                            confirm(
                              'This will permanently delete this profile and all associated files. This action cannot be undone. Continue?'
                            )
                          ) {
                            permanentDelete.mutate(profile.id);
                          }
                        }}
                      >
                        Delete Forever
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Conflict resolution modal */}
      {conflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Profile Conflict</h2>
            <p className="mt-1 text-sm text-gray-600">
              {conflict.archived.talent_users?.full_name ?? 'This talent'} already has
              a live <strong>{conflict.archived.categories?.name}</strong> profile.
              Only one can be active at a time. Which one should stay live?
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {/* Archived profile */}
              <div className="rounded-lg border-2 border-indigo-200 bg-indigo-50 p-4">
                <p className="text-xs font-semibold uppercase text-indigo-600">Archived Profile</p>
                <p className="mt-1 text-sm text-gray-700">
                  Created {new Date(conflict.archived.created_at).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-500">
                  Deleted {conflict.archived.deleted_at ? new Date(conflict.archived.deleted_at).toLocaleDateString() : '-'}
                </p>
                <Button
                  size="sm"
                  className="mt-3 w-full"
                  loading={restoreProfile.isPending}
                  onClick={() =>
                    restoreProfile.mutate({
                      profileId: conflict.profileId,
                      replaceProfileId: conflict.existing.id,
                    })
                  }
                >
                  Make this one live
                </Button>
              </div>

              {/* Existing profile */}
              <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase text-gray-600">Current Profile</p>
                <p className="mt-1 text-sm text-gray-700">
                  Created {new Date(conflict.existing.created_at).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-500">
                  Status: {conflict.existing.status.replace('_', ' ')}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => setConflict(null)}
                >
                  Keep this one
                </Button>
              </div>
            </div>

            <button
              onClick={() => setConflict(null)}
              className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
