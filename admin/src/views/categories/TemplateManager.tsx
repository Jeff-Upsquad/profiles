import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import toast from 'react-hot-toast';

interface TemplateItem {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  group?: string | null;
}

type ItemType = 'skills' | 'tools' | 'ai-tools' | 'portfolio-categories';

// The /admin route shape is mostly /admin/categories/:id/:type for list+create,
// and /admin/:singleResource/:id for update+delete. portfolio-categories breaks
// from the singular convention to avoid colliding with /admin/categories/:id.
const SINGLE_RESOURCE: Record<ItemType, string> = {
  skills: 'skills',
  tools: 'tools',
  'ai-tools': 'ai-tools',
  'portfolio-categories': 'portfolio-categories',
};

const RESPONSE_KEY: Record<ItemType, string> = {
  skills: 'skills',
  tools: 'tools',
  'ai-tools': 'ai_tools',
  'portfolio-categories': 'portfolio_categories',
};

function ItemList({
  categoryId,
  type,
  label,
}: {
  categoryId: string;
  type: ItemType;
  label: string;
}) {
  const queryClient = useQueryClient();
  const supportsGroup = type === 'tools';
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState('');

  const { data: items = [], isLoading } = useQuery<TemplateItem[]>({
    queryKey: ['template', type, categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/categories/${categoryId}/${type}`);
      return data[RESPONSE_KEY[type]] ?? data;
    },
  });

  const existingGroups = Array.from(
    new Set(items.map((i) => i.group).filter(Boolean) as string[]),
  );

  const createMutation = useMutation({
    mutationFn: async ({ name, group }: { name: string; group?: string | null }) => {
      await api.post(
        `/admin/categories/${categoryId}/${type}`,
        supportsGroup ? { name, group: group || null } : { name },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template', type, categoryId] });
      setNewName('');
      setNewGroup('');
      toast.success(`${label} added`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to add'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, group }: { id: string; name: string; group?: string | null }) => {
      await api.put(
        `/admin/${SINGLE_RESOURCE[type]}/${id}`,
        supportsGroup ? { name, group: group || null } : { name },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template', type, categoryId] });
      setEditingId(null);
      toast.success(`${label} updated`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/${SINGLE_RESOURCE[type]}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template', type, categoryId] });
      toast.success(`${label} deleted`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete'),
  });

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-gray-800">{label}s</h3>

      {/* Add new */}
      <div className="mb-4 space-y-2">
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`Add new ${label.toLowerCase()}...`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) {
                e.preventDefault();
                createMutation.mutate({ name: newName.trim(), group: supportsGroup ? newGroup.trim() : undefined });
              }
            }}
          />
          <Button
            size="sm"
            disabled={!newName.trim()}
            loading={createMutation.isPending}
            onClick={() => newName.trim() && createMutation.mutate({ name: newName.trim(), group: supportsGroup ? newGroup.trim() : undefined })}
          >
            Add
          </Button>
        </div>
        {supportsGroup && (
          <div className="flex items-center gap-2">
            <Input
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              placeholder="Group (optional, e.g. Accounting Software)"
              list={`groups-${categoryId}`}
            />
            <datalist id={`groups-${categoryId}`}>
              {existingGroups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">No {label.toLowerCase()}s yet</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50">
              {editingId === item.id ? (
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editName.trim()) {
                          updateMutation.mutate({ id: item.id, name: editName.trim(), group: supportsGroup ? editGroup.trim() : undefined });
                        }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <Button size="sm" onClick={() => editName.trim() && updateMutation.mutate({ id: item.id, name: editName.trim(), group: supportsGroup ? editGroup.trim() : undefined })}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                  {supportsGroup && (
                    <Input
                      value={editGroup}
                      onChange={(e) => setEditGroup(e.target.value)}
                      placeholder="Group (optional)"
                      list={`groups-${categoryId}`}
                    />
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{item.name}</span>
                    {supportsGroup && item.group && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {item.group}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingId(item.id); setEditName(item.name); setEditGroup(item.group ?? ''); }}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${item.name}"?`)) {
                          deleteMutation.mutate(item.id);
                        }
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TemplateManager({ categoryId }: { categoryId: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-lg font-bold text-gray-900">Template Skills & Tools</h2>
      <p className="mb-6 text-sm text-gray-500">
        Manage the categories, skill sets, and tools available for talent users when creating profiles in this category.
      </p>
      <div className="mb-8 border-b border-gray-200 pb-8">
        <ItemList categoryId={categoryId} type="portfolio-categories" label="Category" />
      </div>
      <div className="grid gap-8 lg:grid-cols-3">
        <ItemList categoryId={categoryId} type="skills" label="Skill" />
        <ItemList categoryId={categoryId} type="tools" label="Tool" />
        <ItemList categoryId={categoryId} type="ai-tools" label="AI Tool" />
      </div>
    </div>
  );
}
