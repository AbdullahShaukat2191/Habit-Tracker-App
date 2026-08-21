// Shared currency formatting — no conversion between currencies, just proper
// labeling/formatting per context (Finance uses PKR by default, each Payment
// project has its own currency).

export type CurrencyCode = 'PKR' | 'USD' | 'EUR' | 'GBP'

export const CURRENCIES: Record<CurrencyCode, { prefix: string; label: string }> = {
  PKR: { prefix: 'Rs. ', label: 'Pakistani Rupee (PKR)' },
  USD: { prefix: '$', label: 'US Dollar (USD)' },
  EUR: { prefix: '€', label: 'Euro (EUR)' },
  GBP: { prefix: '£', label: 'British Pound (GBP)' },
}

export const DEFAULT_CURRENCY: CurrencyCode = 'PKR'

const numberFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function isCurrencyCode(value: string | undefined | null): value is CurrencyCode {
  return !!value && value in CURRENCIES
}

export function formatCurrency(code: string | undefined | null, amount: number): string {
  const currency = isCurrencyCode(code) ? code : DEFAULT_CURRENCY
  return `${CURRENCIES[currency].prefix}${numberFormat.format(amount)}`
}

export function getCurrencySymbol(code: string | undefined | null): string {
  const currency = isCurrencyCode(code) ? code : DEFAULT_CURRENCY
  return CURRENCIES[currency].prefix.trim()
}
