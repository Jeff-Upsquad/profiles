'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';

const OPTIONS: { value: string | null; label: string }[] = [
  { value: null, label: 'None' },
  { value: 'junior', label: 'Junior' },
  { value: 'pro', label: 'Pro' },
  { value: 'Top Talents', label: 'Top Talents' },
  { value: 'custom', label: 'Custom' },
];

interface Props {
  leadId: string;
  currentType: string | null;
  currentCustom: string | null;
}

export default function ProfileTypeTabs({ leadId, currentType, currentCustom }: Props) {
  const queryClient = useQueryClient();
  const [customValue, setCustomValue] = useState(currentCustom ?? '');
  const [editingCustom, setEditingCustom] = useState(currentType === 'custom' && !currentCustom);

  useEffect(() => {
    setCustomValue(currentCustom ?? '');
    setEditingCustom(currentType === 'custom' && !currentCustom);
  }, [currentType, currentCustom]);

  const update = useMutation({
    mutationFn: async (payload: { profile_type: string | null; profile_type_custom?: string | null }) => {
      await api.patch(`/admin/leads/${leadId}/profile-type`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      toast.success('Profile type updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update profile type');
    },
  });

  const handleTabClick = (value: string | null) => {
    if (value === currentType && value !== 'custom') return;
    if (value === 'custom') {
      setEditingCustom(true);
      // Don't save yet — wait for user to fill custom text and blur/enter.
      return;
    }
    setEditingCustom(false);
    update.mutate({ profile_type: value, profile_type_custom: null });
  };

  const saveCustom = () => {
    const trimmed = customValue.trim();
    if (!trimmed) {
      toast.error('Enter a custom label');
      return;
    }
    update.mutate({ profile_type: 'custom', profile_type_custom: trimmed });
    setEditingCustom(false);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {OPTIONS.map((opt) => {
          const active =
            opt.value === currentType ||
            (opt.value === 'custom' && editingCustom);
          return (
            <button
              key={opt.value ?? 'none'}
              type="button"
              onClick={() => handleTabClick(opt.value)}
              disabled={update.isPending}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                active
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200 ring-offset-1'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {opt.label}
              {opt.value === 'custom' && currentType === 'custom' && currentCustom && (
                <span className="ml-1 text-indigo-500">· {currentCustom}</span>
              )}
            </button>
          );
        })}
      </div>

      {editingCustom && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveCustom();
              }
            }}
            placeholder="e.g. Specialist"
            maxLength={100}
            autoFocus
            className="block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={saveCustom}
            disabled={update.isPending}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingCustom(false);
              setCustomValue(currentCustom ?? '');
            }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
