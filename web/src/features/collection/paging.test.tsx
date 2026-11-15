import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRecordPage, useRecordPages, useSummary, type Filters } from '@/features/collection/filters'
import { invalidateCollection } from '@/shared/lib/queries'

vi.mock('@/features/collection/components/ShelfView', () => ({ ShelfView: ({ count }: { count?: number }) => <p>shelf {count}</p> }))

const NONE: Filters = { q: '', owner: 'any', genre: '', decade: '', label: '', country: '', format: '', year: '', sort: 'artist', order: 'asc' }

export function fakeRecord(i: number) {
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, title: `Album ${i}`, artist: 'Artist', year: 1970, label: 'Label', genres: [],
    format: 'LP', note: null, catalog_no: null, country: 'UK', purchase: null, value: null, owner_id: null, has_cover: false, cover_version: null,
    has_back_cover: false, discogs_release_id: null, created_by: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  }
}

/** A fake API holding `total` records; it answers lists, the summary and options, and logs every URL. */
function fakeApi(total: number) {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://x')
    calls.push(url.pathname + url.search)
    if (url.pathname === '/api/records/summary') return new Response(JSON.stringify({ total, totals: [], without_data: total }))
    if (url.pathname === '/api/records/options') return new Response(JSON.stringify({ genres: [], decades: [], labels: [], countries: [], formats: [], years: [], owners: [], shared_count: total, total }))
    if (url.pathname === '/api/household') return new Response(JSON.stringify({ id: 'h', name: 'F', members: [] }))
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = Number(url.searchParams.get('limit') ?? 10)
    const items = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, k) => fakeRecord(offset + k))
    return new Response(JSON.stringify({ items, total, offset, limit }))
  }))
  return calls
}

const lists = (calls: string[]) => calls.filter((c) => c.startsWith('/api/records?'))
const offsets = (calls: string[]) => lists(calls).map((c) => new URLSearchParams(c.split('?')[1]).get('offset'))

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}
const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

afterEach(() => vi.unstubAllGlobals())

describe('grid blocks', () => {
  it('asks for offsets 0, 10, 20 and stops at the end', async () => {
    const calls = fakeApi(25)
    const { result } = renderHook(() => useRecordPages(NONE, 10), { wrapper: wrapper(newClient()) })
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1))
    await act(() => result.current.fetchNextPage())
    await act(() => result.current.fetchNextPage())
    await waitFor(() => expect(result.current.hasNextPage).toBe(false))
    expect(offsets(calls)).toEqual(['0', '10', '20'])
    expect(result.current.data?.pages.flatMap((p) => p.items)).toHaveLength(25)
  })

  it('after a change, a long grid is restarted with a single request', async () => {
    const calls = fakeApi(100)
    const client = newClient()
    const { result } = renderHook(() => useRecordPages(NONE, 10), { wrapper: wrapper(client) })
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1))
    for (let i = 2; i <= 8; i++) {
      await act(() => result.current.fetchNextPage())
      await waitFor(() => expect(result.current.data?.pages).toHaveLength(i), { timeout: 3000 })
    }
    expect(result.current.data?.pages).toHaveLength(8)
    const before = lists(calls).length
    await act(() => invalidateCollection(client))
    expect(lists(calls).length - before).toBe(1)
    expect(result.current.data?.pages).toHaveLength(1)
  })
})

describe('table pages', () => {
  it('changing page fetches that page and prefetches the next, but not the summary again', async () => {
    const calls = fakeApi(37)
    const { result } = renderHook(() => {
      const [page, setPage] = useState(1)
      return { page: useRecordPage(NONE, page, 10), summary: useSummary(NONE), setPage }
    }, { wrapper: wrapper(newClient()) })
    await waitFor(() => expect(result.current.page.data?.total).toBe(37))
    await waitFor(() => expect(offsets(calls)).toContain('10')) // page 2 prefetched
    act(() => result.current.setPage(2))
    await waitFor(() => expect(result.current.page.data?.offset).toBe(10))
    await waitFor(() => expect(offsets(calls)).toContain('20')) // page 3 prefetched
    expect(offsets(calls).filter((o) => o === '10')).toHaveLength(1) // page 2 came from the prefetch
    expect(calls.filter((c) => c.startsWith('/api/records/summary'))).toHaveLength(1)
  })

  it('keeps the previous page on screen while the next one loads', async () => {
    fakeApi(37)
    const { result } = renderHook(() => {
      const [page, setPage] = useState(1)
      return { page: useRecordPage(NONE, page, 25), setPage }
    }, { wrapper: wrapper(newClient()) })
    await waitFor(() => expect(result.current.page.data?.offset).toBe(0))
    act(() => result.current.setPage(3)) // not prefetched
    expect(result.current.page.data?.offset).toBe(0)
    expect(result.current.page.isPlaceholderData).toBe(true)
    await waitFor(() => expect(result.current.page.data?.offset).toBe(50))
  })
})

describe('shelf view', () => {
  it('shows the count without loading a page of records', async () => {
    const calls = fakeApi(42)
    const { Home } = await import('@/features/collection/pages/Home')
    render(<Home />, { wrapper: wrapper(newClient()) })
    expect(await screen.findByText('shelf 42')).toBeInTheDocument()
    expect(lists(calls)).toEqual([])
  })
})
