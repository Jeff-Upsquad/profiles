'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';

interface Question {
  id: string;
  form_type: string;
  question_text: string;
  helper_text: string | null;
  field_type: 'textarea' | 'text' | 'yes_no' | 'acknowledge';
  is_required: boolean;
  display_order: number;
  is_active: boolean;
}

const FIELD_TYPE_OPTIONS: { value: Question['field_type']; label: string }[] = [
  { value: 'textarea', label: 'Long text' },
  { value: 'text', label: 'Short text' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'acknowledge', label: 'Acknowledgement (checkbox)' },
];

const FORM_TYPE_OPTIONS = [
  { value: 'creative', label: 'Creative' },
  { value: 'accountant', label: 'Accountant' },
];

interface FormState {
  question_text: string;
  helper_text: string;
  field_type: Question['field_type'];
  is_required: boolean;
}

const emptyForm: FormState = {
  question_text: '',
  helper_text: '',
  field_type: 'textarea',
  is_required: true,
};

export default function InterviewQuestionsManager() {
  const queryClient = useQueryClient();
  const [formType, setFormType] = useState('creative');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: questions, isLoading } = useQuery<Question[]>({
    queryKey: ['admin-interview-questions', formType],
    queryFn: async () => {
      const { data } = await api.get('/admin/interview-questions', {
        params: { form_type: formType },
      });
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      await api.post('/admin/interview-questions', {
        form_type: formType,
        question_text: payload.question_text,
        helper_text: payload.helper_text || null,
        field_type: payload.field_type,
        is_required: payload.is_required,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-interview-questions', formType] });
      queryClient.invalidateQueries({ queryKey: ['interview-questions', formType] });
      toast.success('Question added');
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add question'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Question> }) => {
      await api.patch(`/admin/interview-questions/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-interview-questions', formType] });
      queryClient.invalidateQueries({ queryKey: ['interview-questions', formType] });
      toast.success('Saved');
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/interview-questions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-interview-questions', formType] });
      queryClient.invalidateQueries({ queryKey: ['interview-questions', formType] });
      toast.success('Question removed');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to remove'),
  });

  const reorderMutation = useMutation({
    mutationFn: async (order: string[]) => {
      await api.patch('/admin/interview-questions/reorder', {
        form_type: formType,
        order,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-interview-questions', formType] });
      queryClient.invalidateQueries({ queryKey: ['interview-questions', formType] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to reorder'),
  });

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (q: Question) => {
    setEditingId(q.id);
    setForm({
      question_text: q.question_text,
      helper_text: q.helper_text ?? '',
      field_type: q.field_type,
      is_required: q.is_required,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.question_text.trim()) {
      toast.error('Question text is required');
      return;
    }
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        payload: {
          question_text: form.question_text,
          helper_text: form.helper_text || null,
          field_type: form.field_type,
          is_required: form.is_required,
        },
      });
    } else {
      createMutation.mutate(form);
    }
  };

  const move = (id: string, direction: -1 | 1) => {
    const list = (questions ?? []).slice().sort((a, b) => a.display_order - b.display_order);
    const idx = list.findIndex((q) => q.id === id);
    const newIdx = idx + direction;
    if (idx < 0 || newIdx < 0 || newIdx >= list.length) return;
    const next = list.slice();
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    reorderMutation.mutate(next.map((q) => q.id));
  };

  const sorted = (questions ?? []).slice().sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Interview Questions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Define the first-level screening questions shown to candidates after they apply. Questions
          are configured per form type.
        </p>
      </div>

      {/* Form type toggle */}
      <div className="flex flex-wrap gap-2">
        {FORM_TYPE_OPTIONS.map((ft) => (
          <button
            key={ft.value}
            type="button"
            onClick={() => setFormType(ft.value)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              formType === ft.value
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {ft.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {sorted.filter((q) => q.is_active).length} active question
          {sorted.filter((q) => q.is_active).length === 1 ? '' : 's'}
        </div>
        <Button onClick={openAddModal}>Add question</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-gray-500">
          No questions yet. Click “Add question” to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((q, idx) => (
            <div
              key={q.id}
              className={`rounded-lg border p-4 ${
                q.is_active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-75'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => move(q.id, -1)}
                    disabled={idx === 0 || reorderMutation.isPending}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <span className="text-xs font-medium text-gray-500">{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => move(q.id, 1)}
                    disabled={idx === sorted.length - 1 || reorderMutation.isPending}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{q.question_text}</p>
                    <div className="flex flex-wrap items-center gap-1">
                      {!q.is_active && <Badge variant="gray">Hidden</Badge>}
                      {q.is_required && <Badge variant="indigo">Required</Badge>}
                      <Badge variant="blue">
                        {FIELD_TYPE_OPTIONS.find((t) => t.value === q.field_type)?.label ||
                          q.field_type}
                      </Badge>
                    </div>
                  </div>
                  {q.helper_text && (
                    <p className="mt-1 text-xs text-gray-500">{q.helper_text}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openEditModal(q)}>
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        updateMutation.mutate({
                          id: q.id,
                          payload: { is_active: !q.is_active },
                        })
                      }
                    >
                      {q.is_active ? 'Hide' : 'Activate'}
                    </Button>
                    {q.is_active && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (confirm('Remove this question? Historical responses are preserved.')) {
                            deleteMutation.mutate(q.id);
                          }
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit Question' : 'Add Question'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Question <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.question_text}
              onChange={(e) => setForm((p) => ({ ...p, question_text: e.target.value }))}
              rows={3}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter the question the candidate will see"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Helper text <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={form.helper_text}
              onChange={(e) => setForm((p) => ({ ...p, helper_text: e.target.value }))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Clarifying note shown under the question"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Answer type</label>
            <select
              value={form.field_type}
              onChange={(e) =>
                setForm((p) => ({ ...p, field_type: e.target.value as Question['field_type'] }))
              }
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {FIELD_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_required}
              onChange={(e) => setForm((p) => ({ ...p, is_required: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Required</span>
          </label>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button variant="secondary" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? 'Save changes' : 'Add question'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
