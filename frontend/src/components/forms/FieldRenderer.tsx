import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import FileUploadField from './FileUploadField';
import type { CategoryField } from '@/types';

interface FieldRendererProps {
  field: CategoryField;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

export default function FieldRenderer({
  field,
  value,
  onChange,
  error,
  disabled = false,
}: FieldRendererProps) {
  const { field_type, field_label, placeholder, helper_text, is_required, validation_rules, options } = field;

  const commonProps = {
    label: field_label,
    error,
    disabled,
    required: is_required,
    placeholder: placeholder || undefined,
  };

  switch (field_type) {
    case 'text':
      return (
        <div>
          <Input
            {...commonProps}
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            maxLength={validation_rules?.max_length}
          />
          {helper_text && !error && (
            <p className="mt-1 text-xs text-gray-500">{helper_text}</p>
          )}
        </div>
      );

    case 'textarea':
      return (
        <div className="w-full">
          {field_label && (
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {field_label}
              {is_required && <span className="ml-0.5 text-red-500">*</span>}
            </label>
          )}
          <textarea
            rows={4}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || undefined}
            disabled={disabled}
            maxLength={validation_rules?.max_length}
            className={`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:border-indigo-500'
            }`}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          {helper_text && !error && (
            <p className="mt-1 text-xs text-gray-500">{helper_text}</p>
          )}
        </div>
      );

    case 'number':
      return (
        <div>
          <Input
            {...commonProps}
            type="number"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
            min={validation_rules?.min}
            max={validation_rules?.max}
          />
          {helper_text && !error && (
            <p className="mt-1 text-xs text-gray-500">{helper_text}</p>
          )}
        </div>
      );

    case 'currency':
      return (
        <div className="w-full">
          {field_label && (
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {field_label}
              {is_required && <span className="ml-0.5 text-red-500">*</span>}
            </label>
          )}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
              $
            </span>
            <input
              type="number"
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
              placeholder={placeholder || '0.00'}
              disabled={disabled}
              min={validation_rules?.min}
              max={validation_rules?.max}
              className={`block w-full rounded-lg border py-2 pl-7 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:border-indigo-500'
              }`}
            />
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          {helper_text && !error && (
            <p className="mt-1 text-xs text-gray-500">{helper_text}</p>
          )}
        </div>
      );

    case 'email':
      return (
        <div>
          <Input
            {...commonProps}
            type="email"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
          {helper_text && !error && (
            <p className="mt-1 text-xs text-gray-500">{helper_text}</p>
          )}
        </div>
      );

    case 'phone':
      return (
        <div>
          <Input
            {...commonProps}
            type="tel"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
          {helper_text && !error && (
            <p className="mt-1 text-xs text-gray-500">{helper_text}</p>
          )}
        </div>
      );

    case 'select':
      return (
        <div>
          <Select
            {...commonProps}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            options={
              (options ?? [])
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((opt) => ({ label: opt.label, value: opt.value }))
            }
            placeholder="Select an option..."
          />
          {helper_text && !error && (
            <p className="mt-1 text-xs text-gray-500">{helper_text}</p>
          )}
        </div>
      );

    case 'multi_select': {
      const selected: string[] = Array.isArray(value) ? value : [];
      const sortedOptions = (options ?? []).sort((a, b) => a.sort_order - b.sort_order);
      return (
        <div className="w-full">
          {field_label && (
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {field_label}
              {is_required && <span className="ml-0.5 text-red-500">*</span>}
            </label>
          )}
          <div className="space-y-2 rounded-lg border border-gray-300 p-3">
            {sortedOptions.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  disabled={disabled}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...selected, opt.value]);
                    } else {
                      onChange(selected.filter((v) => v !== opt.value));
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                {opt.label}
              </label>
            ))}
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          {helper_text && !error && (
            <p className="mt-1 text-xs text-gray-500">{helper_text}</p>
          )}
        </div>
      );
    }

    case 'file_upload':
      return (
        <div className="w-full">
          {field_label && (
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {field_label}
              {is_required && <span className="ml-0.5 text-red-500">*</span>}
            </label>
          )}
          <FileUploadField
            value={value}
            onChange={(url) => onChange(url)}
            disabled={disabled}
            error={error}
          />
          {helper_text && !error && (
            <p className="mt-1 text-xs text-gray-500">{helper_text}</p>
          )}
        </div>
      );

    case 'date':
      return (
        <div>
          <Input
            {...commonProps}
            type="date"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
          {helper_text && !error && (
            <p className="mt-1 text-xs text-gray-500">{helper_text}</p>
          )}
        </div>
      );

    default:
      return (
        <div>
          <Input
            {...commonProps}
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
  }
}
