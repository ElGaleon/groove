import { describe, expect, it } from 'vitest'
import { isIncompleteVersion, mainFormat, versionSummary } from './records'

describe('records helpers', () => {
  it('keeps the shape of the disc from a Discogs format', () => {
    expect(mainFormat('Vinyl, LP, Album')).toBe('LP')
    expect(mainFormat('Vinyl, 7", 45 RPM')).toBe('7"')
    expect(mainFormat('Box Set, Vinyl')).toBe('Box set')
    expect(mainFormat('Cassette')).toBe('Cassette')
    expect(mainFormat(null)).toBe('')
  })
  it('summarises the version and flags an incomplete one', () => {
    const r = { label: 'Apple', country: 'UK', year: 1969, format: 'LP', catalog_no: 'PCS 7088' }
    expect(versionSummary(r)).toBe('Apple · UK 1969 · LP')
    expect(isIncompleteVersion(r)).toBe(false)
    expect(isIncompleteVersion({ ...r, country: null })).toBe(true)
  })
})
