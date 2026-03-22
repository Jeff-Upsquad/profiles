import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import toast from 'react-hot-toast';

interface TalentUser {
  id: string;
  full_name: string;
  phone: string;
  age: number;
  gender: string;
  current_location: string;
  created_at: string;
  email?: string;
  suspended?: boolean;
}

interface BusinessUser {
  id: string;
  company_name: string;
  industry: string;
  company_size: string;
  contact_person_name: string;
  contact_email: string;
  verified: boolean;
  created_at: string;
  email?: string;
  suspended?: boolean;
}

type Tab = 'talent' | 'business';

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('talent');
  const [search, setSearch] = useState('');

  const { data: talentUsers, isLoading: talentLoading } = useQuery<TalentUser[]>({
    queryKey: ['admin-users-talent'],
    queryFn: async () => {
      const { data } = await api.get('/admin/users/talent');
      return data.users ?? data;
    },
  });

  const { data: businessUsers, isLoading: businessLoading } = useQuery<BusinessUser[]>({
    queryKey: ['admin-users-business'],
    queryFn: async () => {
      const { data } = await api.get('/admin/users/business');
      return data.users ?? data;
    },
  });

  const suspendUser = useMutation({
    mutationFn: async ({ userId, suspend }: { userId: string; suspend: boolean }) => {
      await api.patch(`/admin/users/${userId}/suspend`, { suspend });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-talent'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-business'] });
      toast.success('User updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update user');
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-talent'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-business'] });
      toast.success('User permanently deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    },
  });

  const handleDelete = (userId: string) => {
    if (window.confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) {
      deleteUser.mutate(userId);
    }
  };

  const filteredTalent = (talentUsers ?? []).filter(
    (u) =>
      !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.includes(search) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredBusiness = (businessUsers ?? []).filter(
    (u) =>
      !search ||
      u.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.contact_person_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.contact_email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage talent and business users
        </p>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setTab('talent')}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'talent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Talent ({talentUsers?.length ?? 0})
          </button>
          <button
            onClick={() => setTab('business')}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'business' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Business ({businessUsers?.length ?? 0})
          </button>
        </div>
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Talent Tab */}
      {tab === 'talent' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {talentLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-200" />
              ))}
            </div>
          ) : filteredTalent.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No talent users found</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Joined</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTalent.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                      {user.email && <div className="text-xs text-gray-500">{user.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.phone ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.current_location ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant={user.suspended ? 'primary' : 'secondary'}
                          size="sm"
                          loading={suspendUser.isPending}
                          onClick={() =>
                            suspendUser.mutate({ userId: user.id, suspend: !user.suspended })
                          }
                        >
                          {user.suspended ? 'Unsuspend' : 'Suspend'}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          loading={deleteUser.isPending}
                          onClick={() => handleDelete(user.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Business Tab */}
      {tab === 'business' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {businessLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-200" />
              ))}
            </div>
          ) : filteredBusiness.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No business users found</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Industry</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Joined</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBusiness.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{user.company_name}</div>
                      <div className="text-xs text-gray-500">{user.company_size}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{user.contact_person_name}</div>
                      <div className="text-xs text-gray-500">{user.contact_email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.industry ?? '-'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={user.verified ? 'green' : 'yellow'}>
                        {user.verified ? 'Verified' : 'Unverified'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant={user.suspended ? 'primary' : 'secondary'}
                          size="sm"
                          loading={suspendUser.isPending}
                          onClick={() =>
                            suspendUser.mutate({ userId: user.id, suspend: !user.suspended })
                          }
                        >
                          {user.suspended ? 'Unsuspend' : 'Suspend'}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          loading={deleteUser.isPending}
                          onClick={() => handleDelete(user.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
