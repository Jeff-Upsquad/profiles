'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import {
  useStaffList,
  useUpdateStaff,
  useDeleteStaff,
  type StaffSummary,
} from '@/hooks/useTeamAccess';
import StaffForm from './StaffForm';
import GrantMatrix from './GrantMatrix';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function TeamAccessList() {
  const { data: staff, isLoading } = useStaffList();
  const updateMutation = useUpdateStaff();
  const deleteMutation = useDeleteStaff();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<StaffSummary | null>(null);
  const [managing, setManaging] = useState<StaffSummary | null>(null);

  function toggleActive(s: StaffSummary) {
    const verb = s.is_active ? 'Deactivate' : 'Reactivate';
    if (!confirm(`${verb} ${s.name}? ${s.is_active ? 'They will be signed out immediately.' : ''}`)) return;
    updateMutation.mutate({ id: s.id, is_active: !s.is_active });
  }

  function handleDelete(s: StaffSummary) {
    if (!confirm(`Permanently delete ${s.name}? This removes their login and all grants.`)) return;
    deleteMutation.mutate(s.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team &amp; Access</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Create staff logins and grant them per-module access. Staff sign in at the separate
            <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">/staff</code>
            portal and see only the modules you allow, at the tier you choose
            (View / Edit / Full / Admin).
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Add staff user</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : !staff?.length ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No staff users yet. Click &ldquo;Add staff user&rdquo; to create one.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Modules</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{s.name}</td>
                  <td className="px-6 py-4 text-gray-600">{s.email}</td>
                  <td className="px-6 py-4">
                    <Badge variant={s.is_active ? 'green' : 'red'}>
                      {s.is_active ? 'active' : 'inactive'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {s.grants?.length
                      ? `${s.grants.length} module${s.grants.length === 1 ? '' : 's'}`
                      : <span className="text-gray-400">none</span>}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{formatDate(s.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-3 text-sm font-medium">
                      <button
                        onClick={() => setManaging(s)}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        Manage access
                      </button>
                      <button
                        onClick={() => setEditing(s)}
                        className="text-gray-700 hover:text-gray-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(s)}
                        className="text-gray-700 hover:text-gray-900"
                      >
                        {s.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add staff user">
        <StaffForm onSuccess={() => setShowCreate(false)} onCancel={() => setShowCreate(false)} />
      </Modal>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Edit staff user">
        {editing && (
          <StaffForm
            staff={editing}
            onSuccess={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal
        isOpen={!!managing}
        onClose={() => setManaging(null)}
        title={managing ? `Manage access — ${managing.name}` : 'Manage access'}
        size="lg"
      >
        {managing && <GrantMatrix staff={managing} onClose={() => setManaging(null)} />}
      </Modal>
    </div>
  );
}
