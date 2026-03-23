import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
  useFieldOptions,
  useCreateOption,
  useUpdateOption,
  useDeleteOption,
  type FieldOption,
} from '@/hooks/useCategories';

interface FieldOptionManagerProps {
  fieldId: string;
}

export default function FieldOptionManager({ fieldId }: FieldOptionManagerProps) {
  const { data: options, isLoading } = useFieldOptions(fieldId);
  const createMutation = useCreateOption();
  const updateMutation = useUpdateOption();
  const deleteMutation = useDeleteOption();

  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: '', value: '', sort_order: 0 });

  const handleAdd = async () => {
    if (!newLabel.trim() || !newValue.trim()) return;
    await createMutation.mutateAsync({
      field_id: fieldId,
      label: newLabel.trim(),
      value: newValue.trim(),
      sort_order: newSortOrder,
    });
    setNewLabel('');
    setNewValue('');
    setNewSortOrder(0);
  };

  const startEdit = (opt: FieldOption) => {
    setEditingId(opt.id);
    setEditForm({ label: opt.label, value: opt.value, sort_order: opt.sort_order });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateMutation.mutateAsync({
      id: editingId,
      field_id: fieldId,
      ...editForm,
    });
    setEditingId(null);
  };

  const handleDelete = async (optionId: string) => {
    if (!confirm('Delete this option?')) return;
    await deleteMutation.mutateAsync({ id: optionId, field_id: fieldId });
  };

  if (isLoading) {
    return <div className="py-4 text-sm text-gray-500">Loading options...</div>;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Options</h4>

      {options && options.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {options.map((opt) => (
            <div key={opt.id} className="flex items-center gap-3 px-3 py-2">
              {editingId === opt.id ? (
                <>
                  <input
                    value={editForm.label}
                    onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    placeholder="Label"
                  />
                  <input
                    value={editForm.value}
                    onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    placeholder="Value"
                  />
                  <input
                    type="number"
                    value={editForm.sort_order}
                    onChange={(e) =>
                      setEditForm({ ...editForm, sort_order: Number(e.target.value) })
                    }
                    className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                  <Button size="sm" onClick={saveEdit} loading={updateMutation.isPending}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-900">{opt.label}</span>
                  <span className="flex-1 text-sm text-gray-500">{opt.value}</span>
                  <span className="w-16 text-sm text-gray-400 text-center">
                    {opt.sort_order}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(opt)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(opt.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 pt-2">
        <Input
          label="Label"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Option label"
        />
        <Input
          label="Value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="option_value"
        />
        <div className="w-24 flex-shrink-0">
          <Input
            label="Sort"
            type="number"
            value={String(newSortOrder)}
            onChange={(e) => setNewSortOrder(Number(e.target.value))}
          />
        </div>
        <Button
          onClick={handleAdd}
          size="md"
          loading={createMutation.isPending}
          className="flex-shrink-0"
        >
          Add
        </Button>
      </div>
    </div>
  );
}
