'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';

interface BusinessUser {
  id: string;
  company_name: string;
  contact_person_name: string;
  contact_email: string;
  access_expires_at?: string;
  is_active: boolean;
  created_at: string;
}

export default function BusinessList() {
  const router = useRouter();

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
                    {isExpired(user.access_expires_at) ? (
                      <Badge variant="red">Expired</Badge>
                    ) : user.is_active ? (
                      <Badge variant="green">Active</Badge>
                    ) : (
                      <Badge variant="gray">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {user.access_expires_at
                      ? new Date(user.access_expires_at).toLocaleDateString()
                      : 'No expiry'}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
