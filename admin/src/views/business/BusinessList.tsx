'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';

interface BusinessUser {
  id: string;
  company_name: string;
  contact_person_name: string;
  contact_email: string;
  access_expires_at?: string;
  access_requested_at?: string;
  is_active: boolean;
  created_at: string;
}

export default function BusinessList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [extendModal, setExtendModal] = useState<BusinessUser | null>(null);
  const [extendDays, setExtendDays] = useState(30);

  const { data: businessUsers, isLoading } = useQuery<BusinessUser[]>({
    queryKey: ['admin-business-users'],
    queryFn: async () => {
      const { data } = await api.get('/admin/users/business');
      return data.users ?? data;
    },
  });

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const extendAccess = useMutation({
    mutationFn: async ({ businessId, days }: { businessId: string; days: number }) => {
      await api.patch(`/admin/business/${businessId}/extend-access`, { days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-business-users'] });
      toast.success('Access extended successfully');
      setExtendModal(null);
      setExtendDays(30);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to extend access');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Business Users</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage business user subscriptions and profile sharing.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : !businessUsers?.length ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No business users found. Invite business users from the Invitations page.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-6 py-3">Company</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Expires</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {businessUsers.map((user) => (
                <tr
                  key={user.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/business/${user.id}`)}
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {user.company_name}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {user.contact_person_name}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {user.contact_email}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {isExpired(user.access_expires_at) ? (
                        <Badge variant="red">Expired</Badge>
                      ) : user.is_active ? (
                        <Badge variant="green">Active</Badge>
                      ) : (
                        <Badge variant="gray">Inactive</Badge>
                      )}
                      {user.access_requested_at && isExpired(user.access_expires_at) && (
                        <Badge variant="yellow">Requested</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {user.access_expires_at
                      ? new Date(user.access_expires_at).toLocaleDateString()
                      : 'No expiry'}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    {isExpired(user.access_expires_at) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExtendModal(user);
                        }}
                      >
                        Extend Access
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={!!extendModal}
        onClose={() => { setExtendModal(null); setExtendDays(30); }}
        title="Extend Access"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Extend access for <strong>{extendModal?.company_name}</strong> ({extendModal?.contact_email})
          </p>
          <Input
            label="Number of days"
            type="number"
            min={1}
            max={365}
            value={extendDays}
            onChange={(e) => setExtendDays(Number(e.target.value))}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => { setExtendModal(null); setExtendDays(30); }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => extendModal && extendAccess.mutate({
                businessId: extendModal.id,
                days: extendDays,
              })}
              loading={extendAccess.isPending}
              disabled={extendDays < 1 || extendDays > 365}
            >
              Extend
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
