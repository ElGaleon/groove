import { useCallback, useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '@/shared/lib/api'
import { SearchPageSchema } from '@/shared/schemas'
import type { SearchResult } from '@/features/discogs/discogs'
import { t } from '@/i18n'

export const MIN_CHARS = 3
const DEBOUNCE_MS = 500
type SearchStatus = 'idle' | 'loading' | 'done' | 'error'

const isAbort = (e: unknown) => (e as Error)?.name === 'AbortError'

/** Live search: waits for a pause in typing, needs 3 characters, the last query always wins. */
export function useDiscogsSearch(debounceMs = DEBOUNCE_MS) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [results, setResults] = useState<SearchResult[]>([])
  const [paging, setPaging] = useState({ page: 1, pages: 1 })
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [tick, setTick] = useState(0)
  const control = useRef<AbortController | null>(null)

  useEffect(() => {
    control.current?.abort()
    const term = q.trim()
    if (term.length < MIN_CHARS) {
      setStatus('idle')
      setResults([])
      setError('')
      return
    }
    setStatus('loading')
    const c = new AbortController()
    control.current = c
    const timer = setTimeout(async () => {
      try {
        const r = await api(`/api/discogs/search?q=${encodeURIComponent(term)}&page=1`, {
          signal: c.signal,
          schema: SearchPageSchema,
        })
        if (c.signal.aborted) return
        setResults(r.results)
        setPaging({ page: r.page, pages: r.pages })
        setError('')
        setStatus('done')
      } catch (e) {
        if (isAbort(e)) return
        setError(errorMessage(e, t.errors.generic))
        setResults([])
        setStatus('error')
      }
    }, debounceMs)
    return () => {
      clearTimeout(timer)
      c.abort()
    }
  }, [q, debounceMs, tick])

  const loadMore = useCallback(async () => {
    if (loadingMore || paging.page >= paging.pages) return
    setLoadingMore(true)
    const c = new AbortController()
    control.current = c
    try {
      const r = await api(`/api/discogs/search?q=${encodeURIComponent(q.trim())}&page=${paging.page + 1}`, {
        signal: c.signal,
        schema: SearchPageSchema,
      })
      if (c.signal.aborted) return
      setResults((prev) => [...prev, ...r.results.filter((n) => !prev.some((p) => p.release_id === n.release_id))])
      setPaging({ page: r.page, pages: r.pages })
    } catch (e) {
      if (!isAbort(e)) setError(errorMessage(e, t.errors.generic))
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, paging, q])

  return {
    q,
    setQ,
    status,
    results,
    error,
    hasMore: paging.page < paging.pages,
    loadMore,
    loadingMore,
    retry: () => setTick((n) => n + 1),
  }
}
