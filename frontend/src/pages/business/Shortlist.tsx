import { Link } from 'react-router-dom';
import { useShortlist, useRemoveFromShortlist } from '@/hooks/useBusiness';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function Shortlist() {
  const { data: profiles, isLoading } = useShortlist();
  const removeFromShortlist = useRemoveFromShortlist();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shortlist</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your saved talent profiles ({profiles?.length ?? 0})
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (profiles ?? []).length === 0 ? (
        <Card className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>
          <h3 className="mb-1 text-lg font-semibold text-gray-900">No shortlisted profiles</h3>
          <p className="mb-4 text-sm text-gray-500">
            Browse talent and save profiles to your shortlist.
          </p>
          <Link to="/business/discover">
            <Button>Discover Talent</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(profiles ?? []).map((profile) => (
            <Card key={profile.id} className="flex flex-col justify-between">
              <div>
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {(profile as any).talent_user?.full_name ?? 'Talent'}
                  </h3>
                  <Badge variant="green">{profile.category?.name ?? 'Profile'}</Badge>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  {profile.field_data?.years_experience !== undefined && (
                    <p>Experience: {profile.field_data.years_experience} years</p>
                  )}
                  {profile.field_data?.expected_salary !== undefined && (
                    <p>Expected: ${profile.field_data.expected_salary}/mo</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                <Link to={`/business/discover/${profile.category?.slug ?? 'profile'}/${profile.id}`}>
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </Link>
                <Button
                  variant="danger"
                  size="sm"
                  loading={removeFromShortlist.isPending}
                  onClick={() => removeFromShortlist.mutate(profile.id)}
                >
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
