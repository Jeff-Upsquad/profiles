interface ChipOption {
  value: string;
  label: string;
}

interface ChipGroupProps {
  label?: string;
  options: ChipOption[];
  value: string[];
  onChange: (next: string[]) => void;
  multi?: boolean;
}

export default function ChipGroup({
  label,
  options,
  value,
  onChange,
  multi = true,
}: ChipGroupProps) {
  const toggle = (val: string) => {
    if (multi) {
      onChange(value.includes(val) ? value.filter((v) => v !== val) : [...value, val]);
    } else {
      onChange(value.includes(val) ? [] : [val]);
    }
  };

  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selected
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
