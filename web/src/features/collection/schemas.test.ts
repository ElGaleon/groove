import { describe, expect, it } from 'vitest'
import { parseSearch } from './schemas'

const parse = (query: string, view: 'shelf' | 'list' | 'grid' = 'shelf') =>
  parseSearch(new URLSearchParams(query), view)

describe('parseSearch', () => {
  it('uses the defaults when the address says nothing', () => {
    const { filters, view } = parse('')
    expect(filters).toEqual({
      q: '',
      owner: 'any',
      genre: '',
      decade: '',
      label: '',
      country: '',
      format: '',
      year: '',
      sort: 'artist',
      order: 'asc',
    })
    expect(view).toBe('shelf')
  })

  it('ignores what it does not understand and keeps what it does', () => {
    const { filters, view } = parse('view=banana&year=abc&sort=title', 'grid')
    expect(view).toBe('grid') // the default view of this device
    expect(filters.year).toBe('')
    expect(filters.sort).toBe('title')
  })

  it('reads valid values', () => {
    const { filters, view } = parse('view=list&q=blue&year=1960&decade=1960&owner=shared&order=desc&sort=year')
    expect(view).toBe('list')
    expect(filters).toMatchObject({
      q: 'blue',
      year: '1960',
      decade: '1960',
      owner: 'shared',
      order: 'desc',
      sort: 'year',
    })
  })

  it('falls back on an unknown order and an empty owner', () => {
    const { filters } = parse('order=sideways&owner=')
    expect(filters.order).toBe('asc')
    expect(filters.owner).toBe('any')
  })
})

describe('page and size in the address', () => {
  it('defaults to page 1 of 10', () => {
    expect(parse('').browse).toEqual({ page: 1, size: 10 })
  })

  it('reads the allowed sizes and a page number', () => {
    expect(parse('page=3&size=25').browse).toEqual({ page: 3, size: 25 })
    expect(parse('size=50').browse.size).toBe(50)
  })

  it('treats any other size or a bad page as the default', () => {
    expect(parse('size=37').browse.size).toBe(10)
    expect(parse('size=abc').browse.size).toBe(10)
    expect(parse('page=abc').browse.page).toBe(1)
    expect(parse('page=0').browse.page).toBe(1)
    expect(parse('page=2.5').browse.page).toBe(1)
  })

  it('keeps page and size out of the filters', () => {
    expect(parse('page=3&size=25').filters).not.toHaveProperty('page')
  })
})
