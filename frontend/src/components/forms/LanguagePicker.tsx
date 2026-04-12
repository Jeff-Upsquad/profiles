import { useState, useRef, useEffect } from 'react';

const LANGUAGES = [
  'Hindi',
  'Bengali',
  'Telugu',
  'Marathi',
  'Tamil',
  'Urdu',
  'Gujarati',
  'Kannada',
  'Malayalam',
  'Odia',
  'English',
];

const PROFICIENCY_LEVELS = [
  { value: 'native', label: 'Native', desc: 'Mother tongue — grew up speaking it' },
  { value: 'fluent', label: 'Fluent', desc: 'Comfortable in professional & casual settings' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Can hold conversations, limited in complex topics' },
  { value: 'basic', label: 'Basic', desc: 'Knows common phrases and simple interactions' },
];

export interface LanguageEntry {
  language: string;
  proficiency: string;
}

interface LanguagePickerProps {
  value: LanguageEntry[];
  onChange: (entries: LanguageEntry[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Generic custom dropdown                                           */
/* ------------------------------------------------------------------ */

interface DropdownOption {
  value: string;
  label: string;
  desc?: string;
}

function Dropdown({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: DropdownOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          value ? 'border-gray-300 text-gray-900' : 'border-gray-300 text-gray-400'
        }`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <svg
          className={`ml-2 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`flex w-full flex-col px-3 py-2 text-left transition-colors hover:bg-indigo-50 ${
                  opt.value === value ? 'bg-indigo-50' : ''
                }`}
              >
                <span className={`text-sm font-medium ${opt.value === value ? 'text-indigo-700' : 'text-gray-900'}`}>
                  {opt.label}
                </span>
                {opt.desc && (
                  <span className="mt-0.5 text-xs text-gray-500">{opt.desc}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LanguagePicker                                                    */
/* ------------------------------------------------------------------ */

export default function LanguagePicker({ value, onChange }: LanguagePickerProps) {
  const selectedLanguages = new Set(value.map((v) => v.language));

  const availableLanguages = LANGUAGES.filter((l) => !selectedLanguages.has(l)).map((l) => ({
    label: l,
    value: l,
  }));

  const addLanguage = () => {
    if (availableLanguages.length === 0) return;
    onChange([...value, { language: '', proficiency: 'fluent' }]);
  };

  const updateEntry = (index: number, field: keyof LanguageEntry, val: string) => {
    const next = value.map((entry, i) =>
      i === index ? { ...entry, [field]: val } : entry
    );
    onChange(next);
  };

  const removeEntry = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Languages Spoken
      </label>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((entry, i) => {
            const rowAvailable = LANGUAGES.filter(
              (l) => !selectedLanguages.has(l) || l === entry.language
            ).map((l) => ({ label: l, value: l }));

            return (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1">
                  <Dropdown
                    options={rowAvailable}
                    value={entry.language}
                    onChange={(val) => updateEntry(i, 'language', val)}
                    placeholder="Select language"
                  />
                </div>
                <div className="flex-1">
                  <Dropdown
                    options={PROFICIENCY_LEVELS}
                    value={entry.proficiency}
                    onChange={(val) => updateEntry(i, 'proficiency', val)}
                    placeholder="Proficiency"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeEntry(i)}
                  className="mt-1.5 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {availableLanguages.length > 0 && (
        <button
          type="button"
          onClick={addLanguage}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Language
        </button>
      )}
    </div>
  );
}
