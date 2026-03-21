import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useMyProfiles } from '@/hooks/useProfiles';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge, { statusToBadgeVariant } from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function TalentDashboard() {
  const { user } = useAuth();
  const { data: profiles, isLoading } = useMyProfiles();

  const stats = {
    total: profiles?.length ?? 0,
    approved: profiles?.filter((p) => p.status === 'approved').length ?? 0,
    pending: profiles?.filter((p) => p.status === 'pending_review').length ?? 0,
    draft: profiles?.filter((p) => p.status === 'draft').length ?? 0,
  };

  const recentProfiles = (profiles ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{user?.full_name ? `, ${user.full_name}` : ''}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here's an overview of your profiles and activity.
        </p>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-sm font-medium text-gray-500">Total Profiles</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{stats.total}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500">Approved</p>
            <p className="mt-1 text-3xl font-bold text-green-600">{stats.approved}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500">Pending Review</p>
            <p className="mt-1 text-3xl font-bold text-yellow-600">{stats.pending}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500">Drafts</p>
            <p className="mt-1 text-3xl font-bold text-gray-600">{stats.draft}</p>
          </Card>
        </div>
      )}

      {/* Quick actions */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/talent/profiles/new">
            <Button>Create New Profile</Button>
          </Link>
          <Link to="/talent/profiles">
            <Button variant="outline">View All Profiles</Button>
          </Link>
        </div>
      </Card>

      {/* Recent activity */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Profiles</h2>
        {recentProfiles.length === 0 ? (
          <p className="text-sm text-gray-500">
            No profiles yet.{' '}
            <Link to="/talent/profiles/new" className="text-indigo-600 hover:underline">
              Create your first profile
            </Link>
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentProfiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {profile.category?.name ?? 'Profile'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Created {new Date(profile.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusToBadgeVariant(profile.status)}>
                    {profile.status.replace('_', ' ')}
                  </Badge>
                  <Link
                    to={`/talent/profiles/${profile.id}`}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
