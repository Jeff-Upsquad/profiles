'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import { groupItemsByBucket } from '@/lib/groupLeadsByBucket';

interface Invitation {
  id: string;
  email: string;
  phone?: string;
  role: 'talent' | 'business';
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  company_name?: string;
  contact_person_name?: string;
  expires_at?: string;
  created_at: string;
}

export default function InvitationList() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'pending' | 'accepted' | 'expired' | 'revoked'>('pending');

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<'talent' | 'business'>('talent');
  const [formCompanyName, setFormCompanyName] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formExpiresAt, setFormExpiresAt] = useState('');

  const { data: invitations, isLoading } = useQuery<Invitation[]>({
    queryKey: ['admin-invitations', filterRole, activeTab],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterRole) params.set('role', filterRole);
      params.set('status', activeTab);
      const qs = params.toString();
      const { data } = await api.get(`/admin/invitations?${qs}`);
      return data.invitations ?? data;
    },
  });

  const buckets = useMemo(
    () => groupItemsByBucket(invitations ?? []),
    [invitations]
  );

  const createInvitation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post('/admin/invitations', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
      toast.success('Invitation sent successfully');
      resetForm();
      setShowModal(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to send invitation');
    },
  });

  const revokeInvitation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/admin/invitations/${id}/revoke`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
      toast.success('Invitation revoked');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to revoke invitation');
    },
  });

  function resetForm() {
    setFormEmail('');
    setFormRole('talent');
    setFormCompanyName('');
    setFormContactPerson('');
    setFormPhone('');
    setFormExpiresAt('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      email: formEmail,
      role: formRole,
    };
    if (formRole === 'business') {
      payload.company_name = formCompanyName;
      payload.contact_person_name = formContactPerson;
      if (formPhone.trim()) {
        payload.phone = formPhone.trim();
      }
      if (formExpiresAt) {
        payload.expires_at = new Date(formExpiresAt).toISOString();
      }
    }
    createInvitation.mutate(payload);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invitations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Invite talent and business users to the platform.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>Invite User</Button>
      </div>

      {/* Tabs + Role Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(['pending', 'accepted', 'expired', 'revoked'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === status
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Roles</option>
          <option value="talent">Talent</option>
          <option value="business">Business</option>
        </select>
      </div>

      {/* Grouped buckets */}
      {isLoading ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        </div>
      ) : !invitations?.length ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="py-12 text-center text-sm text-gray-500">
            No invitations found. Click "Invite User" to get started.
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {buckets.map((bucket) => (
            <section key={bucket.key}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {bucket.label}
                </h2>
                <span className="text-xs text-gray-400">{bucket.items.length}</span>
                <div className="ml-2 h-px flex-1 bg-gray-200" />
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Phone</th>
                      <th className="px-6 py-3">Role</th>
                      <th className="px-6 py-3">Company</th>
                      <th className="px-6 py-3">Expires</th>
                      <th className="px-6 py-3">Created</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {bucket.items.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{inv.email}</td>
                        <td className="px-6 py-4 text-gray-500">{inv.phone || '-'}</td>
                        <td className="px-6 py-4">
                          <Badge variant={inv.role === 'talent' ? 'green' : 'yellow'}>
                            {inv.role}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {inv.company_name || '-'}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {inv.expires_at
                            ? new Date(inv.expires_at).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          {inv.status === 'pending' && (
                            <button
                              onClick={() => revokeInvitation.mutate(inv.id)}
                              className="text-sm font-medium text-red-600 hover:text-red-800"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Invite Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        title="Invite User"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            placeholder="user@example.com"
            required
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Role
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="role"
                  value="talent"
                  checked={formRole === 'talent'}
                  onChange={() => setFormRole('talent')}
                  className="text-indigo-600"
                />
                <span className="text-sm text-gray-700">Talent</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="role"
                  value="business"
                  checked={formRole === 'business'}
                  onChange={() => setFormRole('business')}
                  className="text-indigo-600"
                />
                <span className="text-sm text-gray-700">Business</span>
              </label>
            </div>
          </div>

          {formRole === 'business' && (
            <>
              <Input
                label="Company Name"
                value={formCompanyName}
                onChange={(e) => setFormCompanyName(e.target.value)}
                placeholder="Acme Inc."
                required
              />
              <Input
                label="Contact Person Name"
                value={formContactPerson}
                onChange={(e) => setFormContactPerson(e.target.value)}
                placeholder="John Doe"
              />
              <Input
                label="Phone (optional)"
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+91 98765 43210"
                helperText="Lets the user log in with phone instead of email."
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Access Expiration Date
                </label>
                <input
                  type="date"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowModal(false); resetForm(); }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={createInvitation.isPending}>
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
