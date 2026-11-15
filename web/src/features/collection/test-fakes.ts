import { vi } from 'vitest'

/** A record as the API returns it; `extra` overrides any field. */
export function fakeRecord(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    title: `Album ${i}`,
    artist: 'Artist',
    year: 1970,
    label: 'Label',
    genres: [],
    format: 'LP',
    note: null,
    catalog_no: null,
    country: 'UK',
    purchase: null,
    value: null,
    owner_id: null,
    has_cover: false,
    cover_version: null,
    has_back_cover: false,
    discogs_release_id: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...extra,
  }
}

/** A fake API holding `total` records; it answers lists, the summary and options, and logs every URL. */
export function fakeApi(total: number, make: (i: number) => ReturnType<typeof fakeRecord> = (i) => fakeRecord(i)) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://x')
      calls.push(url.pathname + url.search)
      if (url.pathname === '/api/records/summary')
        return new Response(JSON.stringify({ total, totals: [], without_data: total }))
      if (url.pathname === '/api/records/options')
        return new Response(
          JSON.stringify({
            genres: [],
            decades: [],
            labels: [],
            countries: [],
            formats: [],
            years: [],
            owners: [],
            shared_count: total,
            total,
          }),
        )
      if (url.pathname === '/api/household') return new Response(JSON.stringify({ id: 'h', name: 'F', members: [] }))
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = Number(url.searchParams.get('limit') ?? 10)
      const items = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, k) => make(offset + k))
      return new Response(JSON.stringify({ items, total, offset, limit }))
    }),
  )
  return calls
}

export const lists = (calls: string[]) => calls.filter((c) => c.startsWith('/api/records?'))
export const offsets = (calls: string[]) => lists(calls).map((c) => new URLSearchParams(c.split('?')[1]).get('offset'))
