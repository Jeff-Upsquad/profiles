'use client';

interface ChipSelectProps {
  label?: string;
  options: { label: string; value: string }[];
  selected: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
  error?: string;
  helperText?: string;
  required?: boolean;
  chipClassName?: { selected: string; unselected: string };
}

export default function ChipSelect({
  label,
  options,
  selected,
  onChange,
  multi = false,
  error,
  helperText,
  required,
  chipClassName,
}: ChipSelectProps) {
  const selectedArr = Array.isArray(selected) ? selected : selected ? [selected] : [];

  const toggle = (value: string) => {
    if (multi) {
      const arr = selectedArr.includes(value)
        ? selectedArr.filter((v) => v !== value)
        : [...selectedArr, value];
      onChange(arr);
    } else {
      onChange(selectedArr.includes(value) ? '' : value);
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {helperText && !error && (
        <p className="mb-1.5 text-xs text-gray-500">{helperText}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = selectedArr.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
                isSelected
                  ? (chipClassName?.selected ?? 'border-indigo-600 bg-indigo-600 text-white shadow-sm')
                  : (chipClassName?.unselected ?? 'border-gray-300 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50')
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
