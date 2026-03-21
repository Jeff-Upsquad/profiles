import { Link } from 'react-router-dom';
import { useMyInterests } from '@/hooks/useBusiness';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/ui/Skeleton';

function statusVariant(status: string) {
  switch (status) {
    case 'accepted':
      return 'green' as const;
    case 'declined':
      return 'red' as const;
    case 'pending':
      return 'yellow' as const;
    default:
      return 'gray' as const;
  }
}

export default function Interests() {
  const { data: interests, isLoading } = useMyInterests();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Interest Requests</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track the status of your sent interest requests ({interests?.length ?? 0})
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (interests ?? []).length === 0 ? (
        <Card className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h3 className="mb-1 text-lg font-semibold text-gray-900">No interest requests yet</h3>
          <p className="mb-4 text-sm text-gray-500">
            Browse talent profiles and send interest requests to connect.
          </p>
          <Link to="/business/discover">
            <Button>Discover Talent</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {(interests ?? []).map((interest) => (
            <Card key={interest.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">
                      {(interest.profile as any)?.talent_user?.full_name ??
                        interest.profile?.category?.name ??
                        'Talent'}
                    </h3>
                    <Badge variant={statusVariant(interest.status)}>
                      {interest.status}
                    </Badge>
                  </div>
                  {interest.profile?.category?.name && (
                    <p className="text-sm text-gray-500">
                      Category: {interest.profile.category.name}
                    </p>
                  )}
                  {interest.message && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                      "{interest.message}"
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    Sent {new Date(interest.created_at).toLocaleDateString()}
                  </p>
                </div>
                {interest.profile && (
                  <Link
                    to={`/business/discover/${interest.profile.category?.slug ?? 'profile'}/${interest.talent_profile_id}`}
                  >
                    <Button variant="outline" size="sm">
                      View Profile
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
