import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/formatDate';

interface TalentUser {
  id: string;
  full_name: string;
  phone?: string;
  age?: number;
  gender?: string;
  approval_status: string;
  created_at: string;
}

interface AutoApproveSetting {
  enabled: boolean;
}

export default function UserApprovals() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<TalentUser[]>({
    queryKey: ['pendingApprovals'],
    queryFn: async () => {
      const { data } = await api.get('/admin/user-approvals');
      return data.users ?? data;
    },
  });

  const { data: autoApprove } = useQuery<AutoApproveSetting>({
    queryKey: ['autoApproveSetting'],
    queryFn: async () => {
      const { data } = await api.get('/admin/settings/auto-approve');
      return data;
    },
  });

  const autoApproveMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data } = await api.patch('/admin/settings/auto-approve', { enabled });
      return data as { enabled: boolean; approvedCount: number };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['autoApproveSetting'] });
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
      if (res.enabled) {
        toast.success(
          res.approvedCount > 0
            ? `Auto-approval enabled — ${res.approvedCount} pending user${res.approvedCount === 1 ? '' : 's'} approved`
            : 'Auto-approval enabled',
        );
      } else {
        toast.success('Auto-approval disabled');
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update setting'),
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.patch(`/admin/user-approvals/${userId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
      toast.success('User approved');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.patch(`/admin/user-approvals/${userId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
      toast.success('User rejected');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to reject'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const users = data || [];
  const autoApproveEnabled = autoApprove?.enabled === true;

  const handleToggleAutoApprove = () => {
    if (autoApproveMutation.isPending) return;
    const next = !autoApproveEnabled;
    if (next && users.length > 0) {
      const ok = confirm(
        `Enabling auto-approval will approve all ${users.length} pending user${users.length === 1 ? '' : 's'} immediately. Continue?`,
      );
      if (!ok) return;
    }
    autoApproveMutation.mutate(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Approvals</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and approve talent user accounts ({users.length} pending)
          </p>
        </div>
        <Link
          href="/approvals/preview"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Preview Signup Form
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Auto-approve new signups</h2>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                autoApproveEnabled
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {autoApproveEnabled ? 'On' : 'Off'}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            When on, new signups skip review and any pending users are approved immediately.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoApproveEnabled}
          onClick={handleToggleAutoApprove}
          disabled={autoApproveMutation.isPending}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            autoApproveEnabled ? 'bg-indigo-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              autoApproveEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500">No pending approvals</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Sign-up Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {user.phone || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => approveMutation.mutate(user.id)}
                        disabled={approveMutation.isPending}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to reject this user?')) {
                            rejectMutation.mutate(user.id);
                          }
                        }}
                        disabled={rejectMutation.isPending}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
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
