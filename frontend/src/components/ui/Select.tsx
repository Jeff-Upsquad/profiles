import { type SelectHTMLAttributes } from 'react';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export default function Select({
  label,
  error,
  options,
  placeholder,
  id,
  className = '',
  ...rest
}: SelectProps) {
  const selectId = id || rest.name;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1.5 block text-[13px] font-medium text-[#3F3F46]"
        >
          {label}
          {rest.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={`block w-full rounded-lg border px-3 py-2.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-200 focus:outline-none ${
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/15'
            : 'border-[#E7E7EA] focus:border-[#0a0a0a] focus:ring-2 focus:ring-[#0a0a0a]/12'
        } ${rest.disabled ? 'bg-[#F5F5F6] text-[#a3a3a3]' : 'bg-white text-[#0a0a0a]'} ${className}`}
        {...rest}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
