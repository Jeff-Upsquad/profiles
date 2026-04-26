'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface LeadNote {
  id: string;
  lead_id: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function NotesSection({ leadId }: { leadId: string }) {
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const queryKey = ['admin-lead-notes', leadId];

  const { data: notes = [], isLoading } = useQuery<LeadNote[]>({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get(`/admin/leads/${leadId}/notes`);
      return data.notes;
    },
    enabled: !!leadId,
  });

  const createMutation = useMutation({
    mutationFn: async (content: string) => {
      await api.post(`/admin/leads/${leadId}/notes`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setNewNote('');
      toast.success('Note added');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to add note');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      await api.patch(`/admin/leads/notes/${id}`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingId(null);
      setEditingContent('');
      toast.success('Note updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to update note');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/leads/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Note deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete note');
    },
  });

  const handleAdd = () => {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  };

  const handleStartEdit = (note: LeadNote) => {
    setEditingId(note.id);
    setEditingContent(note.content);
  };

  const handleSaveEdit = () => {
    const trimmed = editingContent.trim();
    if (!trimmed || !editingId) return;
    updateMutation.mutate({ id: editingId, content: trimmed });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingContent('');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this note? This cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note…"
          rows={3}
          className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newNote.trim() || createMutation.isPending}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {createMutation.isPending ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-500">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-xs text-gray-500">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => {
            const edited = note.updated_at && note.updated_at !== note.created_at;
            const isEditing = editingId === note.id;
            return (
              <li key={note.id} className="rounded-lg bg-gray-50 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-gray-500">
                    {formatTimestamp(note.created_at)}
                    {edited && <span className="ml-1 italic">(edited)</span>}
                  </div>
                  {!isEditing && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(note)}
                        className="rounded px-1.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        disabled={deleteMutation.isPending}
                        className="rounded px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="mt-2">
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      rows={3}
                      className="w-full resize-y rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={!editingContent.trim() || updateMutation.isPending}
                        className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        {updateMutation.isPending ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{note.content}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
