import { locale as activeLocale } from '@/i18n/format'

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF'] as const
export type Money = { amountMinor: number; currency: string }

export const fractionDigits = (cur: string) => new Intl.NumberFormat('en', { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits ?? 2

/** "24,90" / "24.90" → unità minori intere (2490). null se non valido o negativo. */
export function parseAmount(input: string, currency: string): number | null {
  const s = input.trim().replace(/\s/g, '')
  if (!s) return null
  const norm = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  if (!/^\d+(\.\d+)?$/.test(norm)) return null
  return Math.round(Number(norm) * 10 ** fractionDigits(currency))
}

/** unità minori → stringa per i campi di input ("24,90"). */
export function amountToInput(minor: number | undefined, currency: string): string {
  if (minor == null) return ''
  return (minor / 10 ** fractionDigits(currency)).toFixed(fractionDigits(currency)).replace('.', ',')
}

export function formatMoney(minor: number, currency: string, locale = activeLocale()): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 10 ** fractionDigits(currency))
}

export type Delta = { abs: number; pct: number | null; currency: string }

/** Differenza valore − acquisto; null (= "n/d") se manca un dato o le valute differiscono. */
export function delta(purchase?: Partial<Money>, value?: Partial<Money>): Delta | null {
  if (purchase?.amountMinor == null || value?.amountMinor == null) return null
  if (!purchase.currency || purchase.currency !== value.currency) return null
  const abs = value.amountMinor - purchase.amountMinor
  return { abs, pct: purchase.amountMinor === 0 ? null : (abs / purchase.amountMinor) * 100, currency: purchase.currency }
}

export function formatDelta(d: Delta | null): string {
  if (!d) return 'n/d'
  const sign = d.abs > 0 ? '+' : d.abs < 0 ? '−' : ''
  const abs = formatMoney(Math.abs(d.abs), d.currency)
  const pct = d.pct == null ? '' : ` (${sign}${Math.abs(Math.round(d.pct))}%)`
  return `${sign}${abs}${pct}`
}
