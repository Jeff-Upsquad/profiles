import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';

interface ReviewProfile {
  id: string;
  talent_user_id: string;
  category_id: string;
  status: string;
  field_data: Record<string, any>;
  created_at: string;
  updated_at: string;
  talent_users?: { full_name: string };
  categories?: { name: string; slug: string };
}

export default function ReviewQueue() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data: profiles, isLoading } = useQuery<ReviewProfile[]>({
    queryKey: ['reviews', categoryFilter],
    queryFn: async () => {
      const params = categoryFilter ? `?category_id=${categoryFilter}` : '';
      const { data } = await api.get(`/admin/reviews${params}`);
      return data.profiles ?? data;
    },
  });

  const { data: categories } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['admin-categories-list'],
    queryFn: async () => {
      const { data } = await api.get('/admin/categories');
      return data.categories ?? data;
    },
  });

  const bulkApprove = useMutation({
    mutationFn: async (ids: string[]) => {
      await api.patch('/admin/reviews/bulk-approve', { profile_ids: ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      setSelectedIds(new Set());
      toast.success('Profiles approved');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Bulk approve failed');
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === (profiles?.length ?? 0)) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set((profiles ?? []).map((p) => p.id)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
          <p className="mt-1 text-sm text-gray-500">
            {profiles?.length ?? 0} profiles pending review
          </p>
        </div>
        {selectedIds.size > 0 && (
          <Button
            loading={bulkApprove.isPending}
            onClick={() => bulkApprove.mutate(Array.from(selectedIds))}
          >
            Approve Selected ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          {(categories ?? []).map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      ) : (profiles ?? []).length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          <p className="text-lg font-medium">No profiles pending review</p>
          <p className="mt-1 text-sm">All caught up!</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === (profiles?.length ?? 0) && (profiles?.length ?? 0) > 0}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Talent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Submitted
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(profiles ?? []).map((profile) => (
                <tr key={profile.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(profile.id)}
                      onChange={() => toggleSelect(profile.id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {profile.talent_users?.full_name ?? 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {profile.categories?.name ?? 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(profile.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="yellow">Pending</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/reviews/${profile.id}`}>
                      <Button variant="ghost" size="sm">
                        Review
                      </Button>
                    </Link>
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
