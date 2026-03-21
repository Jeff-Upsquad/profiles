import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useShortlist, useMyInterests, useBusinessCategories } from '@/hooks/useBusiness';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function BusinessDashboard() {
  const { user } = useAuth();
  const { data: shortlist, isLoading: shortlistLoading } = useShortlist();
  const { data: interests, isLoading: interestsLoading } = useMyInterests();
  const { data: categories, isLoading: catLoading } = useBusinessCategories();

  const isLoading = shortlistLoading || interestsLoading || catLoading;

  const stats = {
    shortlisted: shortlist?.length ?? 0,
    interestsSent: interests?.length ?? 0,
    pending: interests?.filter((i) => i.status === 'pending').length ?? 0,
    accepted: interests?.filter((i) => i.status === 'accepted').length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome{user?.company_name ? `, ${user.company_name}` : ''}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Discover and connect with talented professionals.
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
            <p className="text-sm font-medium text-gray-500">Shortlisted</p>
            <p className="mt-1 text-3xl font-bold text-indigo-600">{stats.shortlisted}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500">Interest Requests Sent</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{stats.interestsSent}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500">Pending Responses</p>
            <p className="mt-1 text-3xl font-bold text-yellow-600">{stats.pending}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500">Accepted</p>
            <p className="mt-1 text-3xl font-bold text-green-600">{stats.accepted}</p>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/business/discover">
            <Button>Discover Talent</Button>
          </Link>
          <Link to="/business/shortlist">
            <Button variant="outline">View Shortlist</Button>
          </Link>
          <Link to="/business/interests">
            <Button variant="outline">View Requests</Button>
          </Link>
        </div>
      </Card>

      {/* Browse by Category */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Browse by Category</h2>
        {catLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(categories ?? []).map((cat) => (
              <Link
                key={cat.id}
                to={`/business/discover/${cat.slug}`}
                className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 transition-all hover:border-indigo-300 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{cat.name}</p>
                  {cat.description && (
                    <p className="text-xs text-gray-500 line-clamp-1">{cat.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
