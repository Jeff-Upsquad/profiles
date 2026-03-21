import { Link } from 'react-router-dom';
import { useBusinessCategories } from '@/hooks/useBusiness';
import Card from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function DiscoverCategories() {
  const { data: categories, isLoading } = useBusinessCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Discover Talent</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse talent by job category
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (categories ?? []).length === 0 ? (
        <Card className="py-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900">No categories available</h3>
          <p className="mt-1 text-sm text-gray-500">Check back soon for new talent categories.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(categories ?? []).map((cat) => (
            <Link key={cat.id} to={`/business/discover/${cat.slug}`}>
              <Card className="cursor-pointer transition-all hover:border-indigo-300 hover:shadow-md">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{cat.name}</h3>
                {cat.description && (
                  <p className="mt-1 text-sm text-gray-500">{cat.description}</p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
