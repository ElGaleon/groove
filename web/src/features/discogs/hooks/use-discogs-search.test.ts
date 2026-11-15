import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDiscogsSearch } from './use-discogs-search'

const result = (id: number) => ({
  release_id: id,
  title: 'T' + id,
  artist: 'A',
  year: null,
  label: null,
  catalog_no: null,
  country: null,
  genres: [],
  format: null,
  cover_url: null,
  in_collection: null,
})
const page = (ids: number[], p = 1, pages = 1) =>
  new Response(JSON.stringify({ results: ids.map(result), page: p, pages }), { status: 200 })

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useDiscogsSearch', () => {
  it('does not search under 3 characters', async () => {
    const f = vi.spyOn(globalThis, 'fetch')
    const { result: r } = renderHook(() => useDiscogsSearch(100))
    act(() => r.current.setQ('ab'))
    await act(() => vi.advanceTimersByTimeAsync(500))
    expect(f).not.toHaveBeenCalled()
    expect(r.current.status).toBe('idle')
  })

  it('fast typing searches only the last text after the pause', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => page([1]))
    const { result: r } = renderHook(() => useDiscogsSearch(100))
    for (const t of ['abb', 'abbe', 'abbey', 'abbey r']) {
      act(() => r.current.setQ(t))
      await act(() => vi.advanceTimersByTimeAsync(30))
    }
    await act(() => vi.advanceTimersByTimeAsync(200))
    expect(f).toHaveBeenCalledTimes(1)
    expect(String(f.mock.calls[0][0])).toContain('q=abbey%20r')
    expect(r.current.status).toBe('done')
  })

  it('a late answer of a superseded query does not replace the latest', async () => {
    const waiting: Record<string, (r: Response) => void> = {}
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (url) =>
        new Promise((res) => {
          waiting[String(url).includes('nuova') ? 'nuova' : 'vecchia'] = res
        }),
    )
    const { result: r } = renderHook(() => useDiscogsSearch(10))
    act(() => r.current.setQ('vecchia'))
    await act(() => vi.advanceTimersByTimeAsync(20))
    act(() => r.current.setQ('nuova'))
    await act(() => vi.advanceTimersByTimeAsync(20))
    await act(async () => {
      waiting['nuova'](page([2]))
      waiting['vecchia']?.(page([1]))
    })
    expect(r.current.results.map((x) => x.release_id)).toEqual([2])
  })

  it('loads more without losing results, and retries after an error', async () => {
    let fail = true
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (fail) return new Response(JSON.stringify({ detail: 'boom' }), { status: 502 })
      const p = Number(/page=(\d+)/.exec(String(url))![1])
      return page([p * 10, p * 10 + 1], p, 2)
    })
    const { result: r } = renderHook(() => useDiscogsSearch(10))
    act(() => r.current.setQ('abbey'))
    await act(() => vi.advanceTimersByTimeAsync(30))
    expect(r.current.status).toBe('error')
    fail = false
    act(() => r.current.retry())
    await act(() => vi.advanceTimersByTimeAsync(30))
    expect(r.current.results).toHaveLength(2)
    expect(r.current.hasMore).toBe(true)
    await act(async () => {
      await r.current.loadMore()
    })
    expect(r.current.results.map((x) => x.release_id)).toEqual([10, 11, 20, 21])
    expect(r.current.hasMore).toBe(false)
  })
})
