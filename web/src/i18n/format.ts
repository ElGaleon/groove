import { getLanguage, LOCALES } from './index'

/** Dates, numbers and money in the active language; the stored values never change. */
export const locale = () => LOCALES[getLanguage()]

export const formatDate = (iso: string | Date, options: Intl.DateTimeFormatOptions = { dateStyle: 'long' }) =>
  new Intl.DateTimeFormat(locale(), options).format(typeof iso === 'string' ? new Date(iso) : iso)

export const formatNumber = (n: number) => n.toLocaleString(locale())
