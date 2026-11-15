import { api } from '@/shared/lib/api'
import { RecordSchema, type VinylRecord } from '@/shared/schemas'
import { delta, type Delta } from '@/shared/lib/money'

export type { Purchase, RecordList, RecordValue, VinylRecord } from '@/shared/schemas'

export interface PurchaseInput {
  amount_minor: number | null
  currency: string
  date: string | null
  location_id: string | null
  channel: 'physical' | 'online' | null
}

export interface ValueInput {
  amount_minor: number
  currency: string
  source: 'manual' | 'discogs'
  measure: string | null
  num_for_sale: number | null
}

export interface RecordInput {
  title: string
  artist: string
  year: number | null
  label: string | null
  genres: string[]
  format: string | null
  note: string | null
  catalog_no: string | null
  country: string | null
  purchase: PurchaseInput | null
  value: ValueInput | null
  owner_id: string | null
}

export const coverUrl = (r: Pick<VinylRecord, 'id' | 'cover_version'>) =>
  `/api/records/${r.id}/cover?v=${r.cover_version ?? 0}`

export const backCoverUrl = (r: Pick<VinylRecord, 'id' | 'cover_version'>) =>
  `/api/records/${r.id}/back-cover?v=${r.cover_version ?? 0}`

export function uploadBackCover(id: string, file: File): Promise<VinylRecord> {
  const form = new FormData()
  form.append('file', file)
  return api(`/api/records/${id}/back-cover`, { method: 'POST', body: form, schema: RecordSchema })
}

export function uploadCover(id: string, file: File): Promise<VinylRecord> {
  const form = new FormData()
  form.append('file', file)
  return api(`/api/records/${id}/cover`, { method: 'POST', body: form, schema: RecordSchema })
}

/** "Apple · UK 1969 · LP": the version at a glance. */
export const versionSummary = (r: Pick<VinylRecord, 'label' | 'country' | 'year' | 'format' | 'catalog_no'>) =>
  [r.label, [r.country, r.year].filter(Boolean).join(' '), r.format].filter(Boolean).join(' · ')

/** A version is incomplete when label, year, country or format is missing. */
export const isIncompleteVersion = (r: Pick<VinylRecord, 'label' | 'country' | 'year' | 'format'>) =>
  !(r.label && r.year && r.country && r.format)

/** Value minus purchase price, only when both exist in the same currency; null means "n/d". */
export const recordDelta = (r: Pick<VinylRecord, 'purchase' | 'value'>): Delta | null =>
  delta(
    { amountMinor: r.purchase?.amount_minor ?? undefined, currency: r.purchase?.currency },
    { amountMinor: r.value?.amount_minor, currency: r.value?.currency },
  )

/** Discogs describes a format as "Vinyl, LP, Album": keep the one that matters, the shape of the disc. */
export function mainFormat(format: string | null): string {
  if (!format) return ''
  const parts = format.split(',').map((p) => p.trim())
  const known = ['LP', '12"', '10"', '7"', 'EP']
  const hit = parts.find((p) => known.includes(p))
  if (hit) return hit
  if (parts.some((p) => /^box set$/i.test(p))) return 'Box set'
  return format
}
