import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/shared/lib/api'
import { RecordListSchema, RecordOptionsSchema, RecordSummarySchema } from '@/shared/schemas'
import { DEFAULT_PAGE_SIZE, parseSearch, type Filters, type PageSize, type View } from './schemas'
import { useIsMobile } from '@/shared/hooks/use-mobile'

export type { Browse, Filters, PageSize, SortKey, View } from './schemas'
export { PAGE_SIZES } from './schemas'

/** Options and totals change only when records do, and every mutation invalidates them. */
const STALE_MS = 5 * 60_000

/** A prefetched table page must still count as fresh when the member gets to it. */
const PAGE_STALE_MS = 30_000

type Changes = Partial<Filters> & { view?: View; page?: number; size?: PageSize }

const DEFAULTS: Filters = { q: '', owner: 'any', genre: '', decade: '', label: '', country: '', format: '', year: '', sort: 'artist', order: 'asc' }

/** Search, filters, sort and view live in the URL, so they survive switching views and reloads. */
export function useFilters() {
  const [params, setParams] = useSearchParams()
  const mobile = useIsMobile()
  // The 3D shelf is the home on desktop; on phones the grid is easier to read and to use.
  const defaultView: View = mobile ? 'grid' : 'shelf'

  const { filters, view, browse } = useMemo(() => parseSearch(params, defaultView), [params, defaultView])

  /** Any change to what is shown (search, filters, sort, size) starts again from page 1. */
  const update = useCallback(
    (changes: Changes) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(changes)) {
            const isDefault =
              value === undefined || value === '' ||
              (key === 'view' ? value === defaultView
                : key === 'page' ? value === 1
                : key === 'size' ? value === DEFAULT_PAGE_SIZE
                : value === DEFAULTS[key as keyof Filters])
            if (isDefault) next.delete(key)
            else next.set(key, String(value))
          }
          const restarts = Object.keys(changes).some((key) => key !== 'view' && key !== 'page')
          if (restarts && changes.page === undefined && next.toString() !== current.toString()) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams, defaultView],
  )
  const reset = useCallback(() => update({ q: '', owner: 'any', genre: '', decade: '', label: '', country: '', format: '', year: '' }), [update])
  const active = filters.q !== '' || filters.owner !== 'any' || filters.genre !== '' || filters.decade !== '' || filters.label !== '' || filters.country !== '' || filters.format !== '' || filters.year !== ''
  /** Filters other than the text search (the ones shown as a count on phones). */
  const activeCount = [filters.owner !== 'any', filters.genre, filters.decade, filters.label, filters.country, filters.format, filters.year].filter(Boolean).length
  return { filters, view, browse, update, reset, active, activeCount }
}

export function filterQuery(f: Filters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.owner !== 'any') p.set('owner', f.owner)
  if (f.genre) p.set('genre', f.genre)
  if (f.decade) p.set('decade', f.decade)
  if (f.label) p.set('label', f.label)
  if (f.country) p.set('country', f.country)
  if (f.format) p.set('format', f.format)
  if (f.year) p.set('year', f.year)
  p.set('sort', f.sort)
  p.set('order', f.order)
  return p
}

const listUrl = (f: Filters, offset: number, limit: number) => {
  const p = filterQuery(f)
  p.set('offset', String(offset))
  p.set('limit', String(limit))
  return `/api/records?${p}`
}

/** Grid: blocks of `size` records, loaded one after another as the member scrolls. */
export function useRecordPages(f: Filters, size: PageSize = DEFAULT_PAGE_SIZE) {
  return useInfiniteQuery({
    queryKey: ['records', 'infinite', filterQuery(f).toString(), size],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api(listUrl(f, pageParam, size), { schema: RecordListSchema }),
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, page) => n + page.items.length, 0)
      return last.items.length > 0 && loaded < last.total ? loaded : undefined
    },
  })
}

/** Table: one page; the previous page stays on screen while the next one loads, then is prefetched. */
export function useRecordPage(f: Filters, page: number, size: PageSize = DEFAULT_PAGE_SIZE) {
  const queryClient = useQueryClient()
  const key = filterQuery(f).toString()
  const query = useQuery({
    queryKey: ['records', 'page', key, page, size],
    queryFn: () => api(listUrl(f, (page - 1) * size, size), { schema: RecordListSchema }),
    placeholderData: keepPreviousData,
    staleTime: PAGE_STALE_MS,
  })
  const total = query.isPlaceholderData ? undefined : query.data?.total
  useEffect(() => {
    if (total === undefined || page * size >= total) return
    void queryClient.prefetchQuery({
      queryKey: ['records', 'page', key, page + 1, size],
      queryFn: () => api(listUrl(f, page * size, size), { schema: RecordListSchema }),
      staleTime: PAGE_STALE_MS,
    })
    // `f` is captured by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, key, page, size, total])
  return query
}

export type { RecordOptions as Options } from '@/shared/schemas'

/** The filters the shelf draws from (sorting does not apply to a random pick). */
export function randomQuery(f: Filters): URLSearchParams {
  const p = filterQuery(f)
  p.delete('sort')
  p.delete('order')
  return p
}

export const useOptions = () =>
  useQuery({ queryKey: ['records-options'], staleTime: STALE_MS, queryFn: () => api('/api/records/options', { schema: RecordOptionsSchema }) })

export { useMembers, type Member } from '@/shared/lib/members'


export type { RecordSummary } from '@/shared/schemas'

/** Totals over the whole collection (not just the loaded page), following the same filters. */
export function useSummary(f: Filters) {
  const p = filterQuery(f)
  p.delete('sort')
  p.delete('order')
  return useQuery({ queryKey: ['records-summary', p.toString()], staleTime: STALE_MS, queryFn: () => api(`/api/records/summary?${p}`, { schema: RecordSummarySchema }) })
}
