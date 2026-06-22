import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

export interface ExperienceEntry {
  from_year: number | '';
  from_month: number | '';
  to_year: number | '';
  to_month: number | '';
  company_name: string;
  designation: string;
}

const currentYear = new Date().getFullYear();

const YEAR_OPTIONS = Array.from({ length: currentYear - 1980 + 1 }, (_, i) => {
  const y = String(currentYear - i);
  return { label: y, value: y };
});

const MONTH_OPTIONS = [
  { label: 'January', value: '1' },
  { label: 'February', value: '2' },
  { label: 'March', value: '3' },
  { label: 'April', value: '4' },
  { label: 'May', value: '5' },
  { label: 'June', value: '6' },
  { label: 'July', value: '7' },
  { label: 'August', value: '8' },
  { label: 'September', value: '9' },
  { label: 'October', value: '10' },
  { label: 'November', value: '11' },
  { label: 'December', value: '12' },
];

interface ExperiencePickerProps {
  value: ExperienceEntry[];
  onChange: (entries: ExperienceEntry[]) => void;
}

export default function ExperiencePicker({ value, onChange }: ExperiencePickerProps) {
  const addEntry = () => {
    onChange([...value, { from_year: '', from_month: '', to_year: '', to_month: '', company_name: '', designation: '' }]);
  };

  const updateEntry = (index: number, field: keyof ExperienceEntry, val: string) => {
    const next = value.map((entry, i) => {
      if (i !== index) return entry;
      if (field === 'company_name' || field === 'designation') {
        return { ...entry, [field]: val };
      }
      return { ...entry, [field]: val ? Number(val) : '' };
    });
    onChange(next);
  };

  const removeEntry = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div>
      {value.length > 0 && (
        <div className="space-y-4">
          {value.map((entry, i) => (
            <div key={i} className="relative rounded-xl border border-[#E7E7EA] bg-[#F5F5F6] p-5">
              <button
                type="button"
                onClick={() => removeEntry(i)}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-[#a3a3a3] hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-[#3F3F46]">From</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        placeholder="Year"
                        options={YEAR_OPTIONS}
                        value={String(entry.from_year)}
                        onChange={(e) => updateEntry(i, 'from_year', e.target.value)}
                      />
                      <Select
                        placeholder="Month"
                        options={MONTH_OPTIONS}
                        value={String(entry.from_month)}
                        onChange={(e) => updateEntry(i, 'from_month', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-[#3F3F46]">To</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        placeholder="Year"
                        options={YEAR_OPTIONS}
                        value={String(entry.to_year)}
                        onChange={(e) => updateEntry(i, 'to_year', e.target.value)}
                      />
                      <Select
                        placeholder="Month"
                        options={MONTH_OPTIONS}
                        value={String(entry.to_month)}
                        onChange={(e) => updateEntry(i, 'to_month', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Company Name"
                    value={entry.company_name}
                    onChange={(e) => updateEntry(i, 'company_name', e.target.value)}
                    placeholder="e.g. Acme Corp, Infosys"
                  />
                  <Input
                    label="Designation"
                    value={entry.designation}
                    onChange={(e) => updateEntry(i, 'designation', e.target.value)}
                    placeholder="e.g. Senior Accountant"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addEntry}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#0a0a0a] hover:bg-[#F5F5F6] transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Experience
      </button>
    </div>
  );
}
