import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FilterBar } from '@/features/collection/components/FilterBar'
import { useFilters } from '@/features/collection/filters'

vi.mock('@/features/records', () => ({ useRecordDialog: () => ({ openAdd: () => {}, openEdit: () => {} }) }))


function Where() {
  return <output data-testid="url">{useLocation().search}</output>
}

function renderAt(url: string) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    genres: ['Jazz', 'Rock'], decades: [1960, 1970], labels: [], countries: [], formats: [], years: [], owners: [], shared_count: 0, total: 0,
  }), { status: 200 })))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <FilterBar />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('filter state in the URL', () => {
  it('keeps the filters when switching view', () => {
    renderAt('/?label=Blue&q=blue')
    fireEvent.click(screen.getByRole('button', { name: 'Griglia' }))
    const url = screen.getByTestId('url').textContent ?? ''
    expect(url).toContain('label=Blue')
    expect(url).toContain('q=blue')
    expect(url).toContain('view=grid')
  })

  it('restores the controls from the URL, as after a reload', async () => {
    renderAt('/?view=grid&q=blue')
    expect(screen.getByRole('searchbox')).toHaveValue('blue')
    expect(screen.getByRole('button', { name: 'Griglia' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('writes typing and filter changes to the URL, and resets them', async () => {
    renderAt('/')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'miles' } })
    await waitFor(() => expect(screen.getByTestId('url').textContent).toContain('q=miles'))
    fireEvent.click(screen.getByRole('button', { name: 'Azzera i filtri' }))
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue(''))
    expect(screen.getByTestId('url').textContent).toBe('')
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })
})

describe('page size selector', () => {
  it('writes the chosen size to the URL and goes back to page 1', async () => {
    renderAt('/?view=list&page=3')
    fireEvent.click(screen.getByRole('combobox', { name: 'Dischi per pagina' }))
    const option = await screen.findByRole('option', { name: '25 per pagina' })
    // base-ui selects on pointer up after a pointer down, not on a bare click.
    fireEvent.pointerDown(option, { pointerType: 'mouse' })
    fireEvent.pointerUp(option, { pointerType: 'mouse' })
    fireEvent.click(option)
    await waitFor(() => expect(screen.getByTestId('url').textContent).toContain('size=25'))
    expect(screen.getByTestId('url').textContent).not.toContain('page=')
  })
})

describe('page and size follow what is shown', () => {
  function useFiltersAt(url: string) {
    const client = new QueryClient()
    return renderHook(() => ({ f: useFilters(), search: useLocation().search }), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}><MemoryRouter initialEntries={[url]}>{children}</MemoryRouter></QueryClientProvider>
      ),
    })
  }

  it('a filter change from page 4 goes back to page 1', () => {
    const { result } = useFiltersAt('/?view=list&page=4')
    expect(result.current.f.browse.page).toBe(4)
    act(() => result.current.f.update({ format: 'LP' }))
    expect(result.current.search).not.toContain('page=')
    expect(result.current.search).toContain('format=LP')
    expect(result.current.f.browse.page).toBe(1)
  })

  it('sort and size changes also restart, a view switch does not', () => {
    const { result } = useFiltersAt('/?view=list&page=3')
    act(() => result.current.f.update({ view: 'grid' }))
    expect(result.current.search).toContain('page=3')
    act(() => result.current.f.update({ size: 25 }))
    expect(result.current.search).toContain('size=25')
    expect(result.current.search).not.toContain('page=')
    act(() => result.current.f.update({ page: 2 }))
    act(() => result.current.f.update({ sort: 'year' }))
    expect(result.current.search).not.toContain('page=')
  })

  it('setting the same search again keeps the page', () => {
    const { result } = useFiltersAt('/?q=blue&page=2')
    act(() => result.current.f.update({ q: 'blue' }))
    expect(result.current.search).toContain('page=2')
  })

  it('leaves the defaults out of the address', () => {
    const { result } = useFiltersAt('/?page=2&size=25')
    act(() => result.current.f.update({ page: 1, size: 10 }))
    expect(result.current.search).toBe('')
  })
})
