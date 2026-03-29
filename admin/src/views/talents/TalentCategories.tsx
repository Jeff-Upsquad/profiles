import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

interface CategoryWithCount {
  id: string;
  name: string;
  slug: string;
  description?: string;
  profile_count: number;
  approved_count: number;
}

export default function TalentCategories() {
  const { data: categories, isLoading } = useQuery<CategoryWithCount[]>({
    queryKey: ['talent-categories'],
    queryFn: async () => {
      const { data } = await api.get('/admin/talents/categories');
      return data.categories ?? data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Talents</h1>
        <p className="mt-1 text-sm text-gray-500">Browse talent profiles by category</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
      ) : (categories ?? []).length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          <p className="text-lg font-medium">No categories found</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(categories ?? []).map((cat) => (
            <Link key={cat.id} href={`/talents/${cat.id}`}>
              <div className="cursor-pointer rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-indigo-300 hover:shadow-md">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{cat.name}</h3>
                {cat.description && (
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">{cat.description}</p>
                )}
                <div className="mt-3 flex gap-4 text-sm">
                  <span className="text-gray-500">
                    <span className="font-semibold text-gray-900">{cat.profile_count}</span> total
                  </span>
                  <span className="text-gray-500">
                    <span className="font-semibold text-green-600">{cat.approved_count}</span> approved
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
