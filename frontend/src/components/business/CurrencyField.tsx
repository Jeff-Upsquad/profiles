'use client';

import { CURRENCIES, type CurrencyCode } from '@/lib/currency';

/**
 * Currency picker for business amount fields, with an opt-in "save as my
 * default" tick. The caller persists the default (see saveDefaultCurrency)
 * once its form submits, so an abandoned form never changes the account.
 */
export default function CurrencyField({
  value,
  onChange,
  accountDefault,
  saveDefault,
  onSaveDefaultChange,
  label = 'Currency',
  className = 'shb-input',
  compact = false,
}: {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
  /** The account's saved default, if any. */
  accountDefault?: string | null;
  saveDefault: boolean;
  onSaveDefaultChange: (next: boolean) => void;
  label?: string;
  className?: string;
  /** Short option labels (code only) for tight rows. */
  compact?: boolean;
}) {
  const isDefault = !!accountDefault && accountDefault === value;
  return (
    <div>
      <select
        aria-label={label}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value as CurrencyCode)}
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {compact ? c.code : c.label}
          </option>
        ))}
      </select>
      {isDefault ? (
        <p className="mt-1.5 text-xs text-[#7A7568]">Your default currency.</p>
      ) : (
        <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs text-[#525252]">
          <input
            type="checkbox"
            checked={saveDefault}
            onChange={(e) => onSaveDefaultChange(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#0a0a0a]"
          />
          Save {value} as my default currency
        </label>
      )}
    </div>
  );
}
