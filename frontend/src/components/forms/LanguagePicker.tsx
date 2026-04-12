import Select from '@/components/ui/Select';

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
  { label: 'Native', value: 'native' },
  { label: 'Fluent', value: 'fluent' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Basic', value: 'basic' },
];

export interface LanguageEntry {
  language: string;
  proficiency: string;
}

interface LanguagePickerProps {
  value: LanguageEntry[];
  onChange: (entries: LanguageEntry[]) => void;
}

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
            // For this row, available = unselected + the one currently selected in this row
            const rowAvailable = LANGUAGES.filter(
              (l) => !selectedLanguages.has(l) || l === entry.language
            ).map((l) => ({ label: l, value: l }));

            return (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1">
                  <Select
                    options={rowAvailable}
                    value={entry.language}
                    onChange={(e) => updateEntry(i, 'language', e.target.value)}
                    placeholder="Select language"
                  />
                </div>
                <div className="flex-1">
                  <Select
                    options={PROFICIENCY_LEVELS}
                    value={entry.proficiency}
                    onChange={(e) => updateEntry(i, 'proficiency', e.target.value)}
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
