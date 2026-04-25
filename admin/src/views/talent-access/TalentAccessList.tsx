'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import {
  useTalentAccessGrants,
  useRevokeTalentAccessGrant,
  useDeleteTalentAccessGrant,
  useExtendTalentAccessGrant,
  type AccessGrant,
  type GrantStatusFilter,
} from '@/hooks/useTalentAccess';
import TalentAccessForm from './TalentAccessForm';

const TABS: GrantStatusFilter[] = ['active', 'expired', 'revoked'];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusVariant(
  status?: 'active' | 'expired' | 'revoked',
): 'green' | 'yellow' | 'red' {
  if (status === 'active') return 'green';
  if (status === 'expired') return 'yellow';
  return 'red';
}

export default function TalentAccessList() {
  const [tab, setTab] = useState<GrantStatusFilter>('active');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AccessGrant | null>(null);

  const { data: grants, isLoading } = useTalentAccessGrants(tab, search.trim() || undefined);
  const revokeMutation = useRevokeTalentAccessGrant();
  const deleteMutation = useDeleteTalentAccessGrant();
  const extendMutation = useExtendTalentAccessGrant();

  function handleRevoke(grant: AccessGrant) {
    if (!confirm(`Revoke access for ${grant.email}? They'll be signed out on their next request.`)) return;
    revokeMutation.mutate(grant.id);
  }

  function handleDelete(grant: AccessGrant) {
    if (!confirm(`Permanently delete the grant for ${grant.email}? This cannot be undone.`)) return;
    deleteMutation.mutate(grant.id);
  }

  function handleExtend(grant: AccessGrant) {
    const raw = prompt('Extend by how many days?', '5');
    if (!raw) return;
    const days = parseInt(raw, 10);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      alert('Please enter a number between 1 and 365.');
      return;
    }
    extendMutation.mutate({ id: grant.id, days });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Talent Access</h1>
          <p className="mt-1 text-sm text-gray-500">
            Email-gated public access to talent profiles. Share the link
            <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">/talent-access</code>
            with the grantee — they enter their email and browse the categories you select.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Create Grant</Button>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search by email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : !grants?.length ? (
          <div className="py-12 text-center text-sm text-gray-500">
            {tab === 'active'
              ? 'No active grants. Click "Create Grant" to invite someone.'
              : `No ${tab} grants.`}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Categories</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Expires</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {grants.map((grant) => (
                <tr key={grant.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{grant.email}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {grant.categories.length === 0 ? (
                        <span className="text-xs text-gray-400">No categories</span>
                      ) : (
                        grant.categories.map((c) => (
                          <span
                            key={c.id}
                            className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                          >
                            {c.name}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusVariant(grant.status)}>
                      {grant.status ?? 'active'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{formatDate(grant.expires_at)}</td>
                  <td className="px-6 py-4 text-gray-500">{formatDate(grant.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-3 text-sm font-medium">
                      {grant.status === 'active' && (
                        <>
                          <button
                            onClick={() => setEditing(grant)}
                            className="text-indigo-600 hover:text-indigo-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleExtend(grant)}
                            className="text-gray-700 hover:text-gray-900"
                          >
                            Extend
                          </button>
                          <button
                            onClick={() => handleRevoke(grant)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                      {grant.status === 'expired' && (
                        <button
                          onClick={() => handleExtend(grant)}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          Extend
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(grant)}
                        className="text-gray-400 hover:text-red-600"
                        title="Delete permanently"
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

      {/* Create modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Talent Access Grant"
      >
        <TalentAccessForm
          onSuccess={() => setShowCreate(false)}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title="Edit Talent Access Grant"
      >
        {editing && (
          <TalentAccessForm
            grant={editing}
            onSuccess={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}
