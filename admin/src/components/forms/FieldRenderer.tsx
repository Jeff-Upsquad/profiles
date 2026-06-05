import { useRef, useState } from 'react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import Input from '@/components/ui/Input';
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

  const labelEl = field_label ? (
    <label className="mb-1 block text-sm font-medium text-gray-700">
      {field_label}
      {is_required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  ) : null;

  const errOrHelper = (
    <>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {!error && helper_text && <p className="mt-1 text-xs text-gray-500">{helper_text}</p>}
    </>
  );

  switch (field_type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'date':
      return (
        <div>
          <Input
            label={field_label}
            error={error}
            disabled={disabled}
            required={is_required}
            placeholder={placeholder || undefined}
            type={field_type === 'phone' ? 'tel' : field_type === 'email' ? 'email' : field_type === 'date' ? 'date' : 'text'}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            maxLength={validation_rules?.max_length}
          />
          {!error && helper_text && <p className="mt-1 text-xs text-gray-500">{helper_text}</p>}
        </div>
      );

    case 'textarea':
      return (
        <div className="w-full">
          {labelEl}
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
          {errOrHelper}
        </div>
      );

    case 'number':
      return (
        <div>
          <Input
            label={field_label}
            error={error}
            disabled={disabled}
            required={is_required}
            placeholder={placeholder || undefined}
            type="number"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            min={validation_rules?.min}
            max={validation_rules?.max}
          />
          {!error && helper_text && <p className="mt-1 text-xs text-gray-500">{helper_text}</p>}
        </div>
      );

    case 'currency':
      return (
        <div className="w-full">
          {labelEl}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
            <input
              type="number"
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder={placeholder || '0.00'}
              disabled={disabled}
              min={validation_rules?.min}
              max={validation_rules?.max}
              className={`block w-full rounded-lg border py-2 pl-7 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:border-indigo-500'
              }`}
            />
          </div>
          {errOrHelper}
        </div>
      );

    case 'select': {
      const sorted = (options ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
      return (
        <div className="w-full">
          {labelEl}
          <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:border-indigo-500'
            }`}
          >
            <option value="">{placeholder || 'Select an option...'}</option>
            {sorted.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {errOrHelper}
        </div>
      );
    }

    case 'multi_select': {
      const selected: string[] = Array.isArray(value) ? value : [];
      const sorted = (options ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
      return (
        <div className="w-full">
          {labelEl}
          <div className="space-y-2 rounded-lg border border-gray-300 p-3">
            {sorted.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  disabled={disabled}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...selected, opt.value]);
                    else onChange(selected.filter((v) => v !== opt.value));
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                {opt.label}
              </label>
            ))}
          </div>
          {errOrHelper}
        </div>
      );
    }

    case 'file_upload':
      return (
        <div className="w-full">
          {labelEl}
          <FileUploadField value={value} onChange={onChange} disabled={disabled} error={error} />
          {!error && helper_text && <p className="mt-1 text-xs text-gray-500">{helper_text}</p>}
        </div>
      );

    case 'experience': {
      const yearsValue = value && typeof value === 'object' ? (value as any).years : undefined;
      const monthsValue = value && typeof value === 'object' ? (value as any).months : undefined;
      const yearOptions = Array.from({ length: 51 }, (_, i) => ({
        label: i === 1 ? '1 year' : `${i} years`,
        value: String(i),
      }));
      const monthOptions = Array.from({ length: 12 }, (_, i) => ({
        label: i === 1 ? '1 month' : `${i} months`,
        value: String(i),
      }));
      const update = (key: 'years' | 'months', v: string) => {
        const num = v === '' ? 0 : Number(v);
        const next = { years: 0, months: 0, ...(value && typeof value === 'object' ? value : {}), [key]: num };
        onChange(next);
      };
      return (
        <div className="w-full">
          {labelEl}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <select
                value={yearsValue === undefined ? '' : String(yearsValue)}
                onChange={(e) => update('years', e.target.value)}
                disabled={disabled}
                aria-label={`${field_label} years`}
                className={`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:border-indigo-500'
                }`}
              >
                <option value="">Years</option>
                {yearOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={monthsValue === undefined ? '' : String(monthsValue)}
                onChange={(e) => update('months', e.target.value)}
                disabled={disabled}
                aria-label={`${field_label} months`}
                className={`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:border-indigo-500'
                }`}
              >
                <option value="">Months</option>
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          {errOrHelper}
        </div>
      );
    }

    default:
      return (
        <div>
          <Input
            label={field_label}
            error={error}
            disabled={disabled}
            required={is_required}
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
  }
}

function FileUploadField({
  value,
  onChange,
  disabled,
  error,
}: {
  value: string | undefined;
  onChange: (url: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const params = new URLSearchParams({ fileName: file.name, folder: 'admin-talent-edit' });
      const { data } = await api.post<{ fileUrl: string }>(
        `/upload/file?${params.toString()}`,
        file,
        { headers: { 'Content-Type': file.type } },
      );
      onChange(data.fileUrl);
      toast.success('File uploaded');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
      {value ? (
        <div className="flex items-center gap-2 text-sm">
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            View current file
          </a>
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Replace'}
          </button>
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => onChange('')}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className={`rounded-lg border-2 border-dashed px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 ${
            error ? 'border-red-300' : 'border-gray-300'
          }`}
        >
          {uploading ? 'Uploading…' : 'Upload file'}
        </button>
      )}
    </div>
  );
}
