import { Link } from 'react-router-dom';
import {
  useMyProfiles,
  useDeactivateProfile,
  useReactivateProfile,
  useDeleteProfile,
} from '@/hooks/useProfiles';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge, { statusToBadgeVariant } from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function ProfileList() {
  const { data: profiles, isLoading } = useMyProfiles();
  const deactivate = useDeactivateProfile();
  const reactivate = useReactivateProfile();
  const deleteProfile = useDeleteProfile();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">My Profiles</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Profiles</h1>
        <Link to="/talent/profiles/new">
          <Button>Create New Profile</Button>
        </Link>
      </div>

      {profiles?.length === 0 ? (
        <Card className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="mb-1 text-lg font-semibold text-gray-900">No profiles yet</h3>
          <p className="mb-4 text-sm text-gray-500">
            Create your first profile to get discovered by businesses.
          </p>
          <Link to="/talent/profiles/new">
            <Button>Create Your First Profile</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles?.map((profile) => (
            <Card key={profile.id} className="flex flex-col justify-between">
              <div>
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {profile.category?.name ?? 'Profile'}
                  </h3>
                  <Badge variant={statusToBadgeVariant(profile.status)}>
                    {profile.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">
                  Created {new Date(profile.created_at).toLocaleDateString()}
                </p>
                {profile.rejection_reason && (
                  <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                    Rejection reason: {profile.rejection_reason}
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/talent/profiles/${profile.id}`}>
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </Link>
                {(profile.status === 'draft' || profile.status === 'rejected') && (
                  <Link to={`/talent/profiles/${profile.id}/edit`}>
                    <Button variant="secondary" size="sm">
                      Edit
                    </Button>
                  </Link>
                )}
                {profile.status === 'approved' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={deactivate.isPending}
                    onClick={() => deactivate.mutate(profile.id)}
                  >
                    Deactivate
                  </Button>
                )}
                {profile.status === 'inactive' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={reactivate.isPending}
                    onClick={() => reactivate.mutate(profile.id)}
                  >
                    Reactivate
                  </Button>
                )}
                {(profile.status === 'draft' || profile.status === 'inactive') && (
                  <Button
                    variant="danger"
                    size="sm"
                    loading={deleteProfile.isPending}
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this profile?')) {
                        deleteProfile.mutate(profile.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
