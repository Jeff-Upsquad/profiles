'use client';

import MultiSelect from '@/components/ui/MultiSelect';
import TagInput from '@/components/ui/TagInput';
import { COUNTRIES, INDIAN_STATES, DISTRICTS_BY_STATE } from '@/constants/india-locations';
import type { PreferredLocation, PreferredLocationState } from '@/hooks/useJobs';

// Nested locations editor: country → states → { districts, cities }.
// India uses curated dropdowns (INDIAN_STATES / DISTRICTS_BY_STATE); every other
// country is free-text at each level, since we don't ship their subdivisions.

const INDIA = 'India';

function emptyState(name: string): PreferredLocationState {
  return { state: name, districts: [], cities: [] };
}

export default function PreferredLocationsEditor({
  value,
  onChange,
}: {
  value: PreferredLocation[];
  onChange: (next: PreferredLocation[]) => void;
}) {
  // Reconcile the country list, preserving existing country blocks.
  const setCountries = (nextCountries: string[]) => {
    const existing = new Map(value.map((b) => [b.country, b]));
    onChange(nextCountries.map((c) => existing.get(c) ?? { country: c, states: [] }));
  };

  const updateCountry = (idx: number, next: PreferredLocation) =>
    onChange(value.map((c, i) => (i === idx ? next : c)));

  // Reconcile the state list within a country, preserving existing state blocks.
  const setStates = (countryIdx: number, nextStateNames: string[]) => {
    const block = value[countryIdx];
    const existing = new Map(block.states.map((s) => [s.state, s]));
    updateCountry(countryIdx, {
      ...block,
      states: nextStateNames.map((n) => existing.get(n) ?? emptyState(n)),
    });
  };

  const updateState = (countryIdx: number, stateIdx: number, next: PreferredLocationState) => {
    const block = value[countryIdx];
    updateCountry(countryIdx, {
      ...block,
      states: block.states.map((s, i) => (i === stateIdx ? next : s)),
    });
  };

  const selectedCountries = value.map((b) => b.country);

  return (
    <div className="space-y-4">
      <MultiSelect
        label="Countries"
        placeholder="Select countries"
        searchPlaceholder="Search countries"
        options={COUNTRIES}
        values={selectedCountries}
        onChange={setCountries}
      />

      {value.map((block, ci) => {
        const isIndia = block.country === INDIA;
        const stateNames = block.states.map((s) => s.state);
        return (
          <div key={block.country} className="rounded-xl border border-[#E7E7EA] bg-[#FAFAFA] p-3.5">
            <div className="mb-3 flex items-center gap-2">
              <svg className="h-4 w-4 text-[#737373]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="text-sm font-semibold text-[#0a0a0a]">{block.country}</span>
              <button
                type="button"
                onClick={() => setCountries(selectedCountries.filter((c) => c !== block.country))}
                className="ml-auto text-xs font-medium text-[#737373] hover:text-red-600"
              >
                Remove
              </button>
            </div>

            {isIndia ? (
              <MultiSelect
                label="States"
                placeholder="Select states"
                searchPlaceholder="Search states"
                options={INDIAN_STATES}
                values={stateNames}
                onChange={(next) => setStates(ci, next)}
              />
            ) : (
              <TagInput
                label="States / regions"
                placeholder="Type a state and press Enter"
                values={stateNames}
                onChange={(next) => setStates(ci, next)}
              />
            )}

            {block.states.length > 0 && (
              <div className="mt-3 space-y-3 border-l-2 border-[#E7E7EA] pl-3">
                {block.states.map((st, si) => {
                  const districtOptions = (DISTRICTS_BY_STATE[st.state] ?? []).map((d) => ({
                    label: d,
                    value: d,
                  }));
                  return (
                    <div key={st.state} className="rounded-lg bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                      <p className="mb-2.5 text-[13px] font-semibold text-[#0a0a0a]">{st.state}</p>
                      <div className="space-y-3">
                        {isIndia ? (
                          <MultiSelect
                            label="Districts"
                            placeholder="Select districts"
                            searchPlaceholder="Search districts"
                            options={districtOptions}
                            values={st.districts}
                            onChange={(next) => updateState(ci, si, { ...st, districts: next })}
                            emptyHint="No districts listed for this state."
                          />
                        ) : (
                          <TagInput
                            label="Districts"
                            placeholder="Type a district and press Enter"
                            values={st.districts}
                            onChange={(next) => updateState(ci, si, { ...st, districts: next })}
                          />
                        )}
                        <TagInput
                          label="Cities"
                          placeholder="Type a city and press Enter"
                          values={st.cities}
                          onChange={(next) => updateState(ci, si, { ...st, cities: next })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
