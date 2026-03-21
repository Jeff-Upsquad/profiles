import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDiscoverProfiles, useAddToShortlist } from '@/hooks/useBusiness';
import { useCategoryWithFields } from '@/hooks/useCategories';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function DiscoverProfiles() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState<string>('newest');

  const { data: category } = useCategoryWithFields(slug);
  const { data, isLoading } = useDiscoverProfiles({
    categorySlug: slug!,
    page,
    search,
    sort_by: sortBy as any,
  });
  const addToShortlist = useAddToShortlist();

  const profiles = data?.profiles ?? [];
  const total = data?.total ?? 0;
  const perPage = data?.per_page ?? 20;
  const totalPages = Math.ceil(total / perPage);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/business/discover" className="hover:text-indigo-600">
            Discover
          </Link>
          <span>/</span>
          <span className="text-gray-900">{category?.name ?? slug}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {category?.name ?? 'Profiles'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {total} approved profile{total !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Search & Sort */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <form onSubmit={handleSearch} className="flex flex-1 gap-2">
            <div className="flex-1">
              <Input
                placeholder="Search by name, skills, location..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
          <div>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="newest">Newest First</option>
              <option value="experience_high">Experience: High to Low</option>
              <option value="experience_low">Experience: Low to High</option>
              <option value="salary_low">Salary: Low to High</option>
              <option value="salary_high">Salary: High to Low</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Profile list */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <Card className="py-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900">No profiles found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search or filters.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <Card key={profile.id} className="flex flex-col justify-between">
                <div>
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {(profile as any).talent_user?.full_name ?? 'Talent'}
                    </h3>
                    <Badge variant="green">Approved</Badge>
                  </div>

                  {/* Show key field_data values */}
                  <div className="space-y-1 text-sm text-gray-600">
                    {profile.field_data?.years_experience !== undefined && (
                      <p>Experience: {profile.field_data.years_experience} years</p>
                    )}
                    {profile.field_data?.expected_salary !== undefined && (
                      <p>Expected Salary: ${profile.field_data.expected_salary}/mo</p>
                    )}
                    {profile.field_data?.type_of_work && (
                      <p>Type: {String(profile.field_data.type_of_work).replace(/_/g, ' ')}</p>
                    )}
                  </div>

                  {/* Skills tags */}
                  {profile.field_data?.accounting_software && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(profile.field_data.accounting_software as string[]).slice(0, 4).map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                        >
                          {s.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  <Link to={`/business/discover/${slug}/${profile.id}`}>
                    <Button variant="outline" size="sm">
                      View Profile
                    </Button>
                  </Link>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={addToShortlist.isPending}
                    onClick={() => addToShortlist.mutate(profile.id)}
                  >
                    Shortlist
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
