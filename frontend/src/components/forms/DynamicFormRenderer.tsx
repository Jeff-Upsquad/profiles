import FieldRenderer from './FieldRenderer';
import type { CategoryField } from '@/types';

interface DynamicFormRendererProps {
  fields: CategoryField[];
  values: Record<string, any>;
  onChange: (fieldKey: string, value: any) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export default function DynamicFormRenderer({
  fields,
  values,
  onChange,
  errors = {},
  disabled = false,
}: DynamicFormRendererProps) {
  const activeFields = fields
    .filter((f) => f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (activeFields.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        No fields configured for this category.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {activeFields.map((field) => (
        // id lets "request changes" deep-link straight to the field (#field-<key>)
        <div key={field.id} id={`field-${field.field_key}`} className="scroll-mt-24">
          <FieldRenderer
            field={field}
            value={values[field.field_key]}
            onChange={(val) => onChange(field.field_key, val)}
            error={errors[field.field_key]}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}
