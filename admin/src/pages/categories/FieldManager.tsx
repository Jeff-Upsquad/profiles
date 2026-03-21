import { useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import FieldOptionManager from './FieldOptionManager';
import {
  useCategoryFields,
  useCreateField,
  useUpdateField,
  useDeleteField,
  type CategoryField,
} from '@/hooks/useCategories';

const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'email',
  'url',
  'phone',
  'date',
  'select',
  'multi_select',
  'checkbox',
  'radio',
  'file',
  'image',
  'video_url',
  'color',
  'range',
  'tags',
  'rich_text',
  'json',
];

function FieldForm({
  field,
  categoryId,
  onClose,
}: {
  field?: CategoryField | null;
  categoryId: string;
  onClose: () => void;
}) {
  const [fieldKey, setFieldKey] = useState(field?.field_key ?? '');
  const [fieldLabel, setFieldLabel] = useState(field?.field_label ?? '');
  const [fieldType, setFieldType] = useState(field?.field_type ?? 'text');
  const [isRequired, setIsRequired] = useState(field?.is_required ?? false);
  const [placeholder, setPlaceholder] = useState(field?.placeholder ?? '');
  const [helperText, setHelperText] = useState(field?.helper_text ?? '');
  const [sortOrder, setSortOrder] = useState(field?.sort_order ?? 0);
  const [validationRulesJson, setValidationRulesJson] = useState(
    field?.validation_rules ? JSON.stringify(field.validation_rules, null, 2) : '',
  );

  const createMutation = useCreateField();
  const updateMutation = useUpdateField();
  const isEditing = !!field;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    let validation_rules: Record<string, unknown> | undefined;
    if (validationRulesJson.trim()) {
      try {
        validation_rules = JSON.parse(validationRulesJson);
      } catch {
        return; // Invalid JSON, user should fix
      }
    }

    const payload = {
      category_id: categoryId,
      field_key: fieldKey,
      field_label: fieldLabel,
      field_type: fieldType,
      is_required: isRequired,
      placeholder: placeholder || undefined,
      helper_text: helperText || undefined,
      sort_order: sortOrder,
      validation_rules,
    };

    try {
      if (isEditing && field) {
        await updateMutation.mutateAsync({ id: field.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch {
      // Handled by mutation onError
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Field Key"
          value={fieldKey}
          onChange={(e) => setFieldKey(e.target.value)}
          placeholder="e.g. years_experience"
          required
          helperText="Unique identifier (snake_case)"
        />
        <Input
          label="Field Label"
          value={fieldLabel}
          onChange={(e) => setFieldLabel(e.target.value)}
          placeholder="e.g. Years of Experience"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Field Type
        </label>
        <select
          value={fieldType}
          onChange={(e) => setFieldType(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Placeholder"
        value={placeholder}
        onChange={(e) => setPlaceholder(e.target.value)}
        placeholder="Input placeholder text"
      />

      <Input
        label="Helper Text"
        value={helperText}
        onChange={(e) => setHelperText(e.target.value)}
        placeholder="Text shown below the field"
      />

      <Input
        label="Sort Order"
        type="number"
        value={String(sortOrder)}
        onChange={(e) => setSortOrder(Number(e.target.value))}
      />

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is-required"
          checked={isRequired}
          onChange={(e) => setIsRequired(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="is-required" className="text-sm text-gray-700">
          Required
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Validation Rules (JSON)
        </label>
        <textarea
          value={validationRulesJson}
          onChange={(e) => setValidationRulesJson(e.target.value)}
          rows={3}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder='{"min": 0, "max": 100}'
        />
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {isEditing ? 'Update' : 'Create'} Field
        </Button>
      </div>
    </form>
  );
}

export default function FieldManager() {
  const { id: categoryId } = useParams<{ id: string }>();
  const { data: fields, isLoading } = useCategoryFields(categoryId);
  const deleteMutation = useDeleteField();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<CategoryField | null>(null);
  const [expandedOptions, setExpandedOptions] = useState<string | null>(null);

  if (!categoryId) return null;

  const openCreate = () => {
    setEditingField(null);
    setModalOpen(true);
  };

  const openEdit = (field: CategoryField) => {
    setEditingField(field);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingField(null);
  };

  const handleDelete = (field: CategoryField) => {
    if (!confirm(`Delete field "${field.field_label}"?`)) return;
    deleteMutation.mutate({ id: field.id, category_id: categoryId });
  };

  const toggleOptions = (fieldId: string) => {
    setExpandedOptions((prev) => (prev === fieldId ? null : fieldId));
  };

  const hasOptions = (type: string) =>
    type === 'select' || type === 'multi_select' || type === 'radio';

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/admin/categories"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; Back to Categories
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Manage Fields</h1>
        <Button onClick={openCreate}>Add Field</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : !fields?.length ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg font-medium">No fields yet</p>
            <p className="text-sm mt-1">Add fields to define what data this category collects.</p>
          </div>
        ) : (
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Label</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Key</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Required</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Sort</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fields.map((field) => (
                  <>
                    <tr key={field.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {field.field_label}
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                        {field.field_key}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="indigo">{field.field_type}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        {field.is_required ? (
                          <Badge variant="yellow">Required</Badge>
                        ) : (
                          <span className="text-gray-400">Optional</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500">{field.sort_order}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(field)}>
                            Edit
                          </Button>
                          {hasOptions(field.field_type) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleOptions(field.id)}
                            >
                              Options
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(field)}
                            disabled={deleteMutation.isPending}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedOptions === field.id && (
                      <tr key={`${field.id}-options`}>
                        <td colSpan={6} className="px-6 py-4 bg-gray-50">
                          <FieldOptionManager fieldId={field.id} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingField ? 'Edit Field' : 'Add Field'}
        size="lg"
      >
        <FieldForm
          field={editingField}
          categoryId={categoryId}
          onClose={closeModal}
        />
      </Modal>
    </div>
  );
}
