import api from '@/services/api';

/** Currencies a business can pick for budgets and quotes (mirrors the backend enum). */
export const CURRENCIES = [
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && CURRENCIES.some((c) => c.code === value);
}

/** ₹ for INR, otherwise "USD " style prefix. */
export function currencyPrefix(code: string | null | undefined): string {
  return !code || code === 'INR' ? '₹' : `${code} `;
}

/** Save the business account's default currency so later forms prefill it. */
export async function saveDefaultCurrency(code: CurrencyCode): Promise<void> {
  await api.put('/business/me', { default_currency: code });
}
