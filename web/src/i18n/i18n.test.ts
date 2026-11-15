import { afterEach, describe, expect, it } from 'vitest'
import { formatMoney } from '@/shared/lib/money'
import { formatDate } from './format'
import { detectLanguage, merge, rawCatalog, setLanguage, t } from './index'

afterEach(() => {
  setLanguage('it', false)
  localStorage.clear()
})

type Plain = Record<string, unknown>
const isPlain = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v)

function keysOf(value: unknown, prefix = ''): string[] {
  if (isPlain(value)) return Object.entries(value).flatMap(([k, v]) => keysOf(v, `${prefix}${k}.`))
  return [prefix.replace(/\.$/, '')]
}

describe('language detection', () => {
  it('prefers the member language, then the stored choice, then the browser, then Italian', () => {
    expect(detectLanguage('en')).toBe('en')
    localStorage.setItem('groove.language', 'en')
    expect(detectLanguage(null)).toBe('en')
    expect(detectLanguage('it')).toBe('it') // the saved member language wins over the browser's
    localStorage.clear()
    expect(detectLanguage(null)).toBe(['it', 'en'].includes(navigator.language.slice(0, 2)) ? navigator.language.slice(0, 2) : 'it')
    expect(detectLanguage('fr')).not.toBe('fr') // unknown languages are ignored
  })
})

describe('switching', () => {
  it('changes the texts and the document language', () => {
    expect(t.nav.home).toBe('Collezione')
    setLanguage('en', false)
    expect(t.nav.home).toBe('Collection')
    expect(document.documentElement.lang).toBe('en')
    expect(t.home.count(2)).toBe('2 records')
    setLanguage('it', false)
    expect(t.home.count(2)).toBe('2 vinili')
  })

  it('remembers an explicit choice in the browser', () => {
    setLanguage('en')
    expect(localStorage.getItem('groove.language')).toBe('en')
  })

  it('falls back to Italian for a text a language does not have, never to an empty label', () => {
    expect(merge({ a: 'ciao', b: 'due' }, { a: 'hello' })).toEqual({ a: 'hello', b: 'due' })
    expect(merge({ a: 'ciao' }, { a: '' })).toEqual({ a: 'ciao' })
  })
})

describe('catalogs', () => {
  const it_ = rawCatalog('it'), en = rawCatalog('en')

  it('English and Italian define exactly the same keys', () => {
    expect(keysOf(en).sort()).toEqual(keysOf(it_).sort())
  })

  it('functions take the same arguments and give text in both languages', () => {
    const pairs: [string, unknown, unknown][] = []
    const walk = (a: unknown, b: unknown, path: string) => {
      if (isPlain(a) && isPlain(b)) Object.keys(a).forEach((k) => walk(a[k], b[k], `${path}${k}.`))
      else pairs.push([path, a, b])
    }
    walk(it_, en, '')
    for (const [path, a, b] of pairs) {
      if (typeof a === 'function') {
        expect(typeof b, path).toBe('function')
        expect((b as () => void).length, path).toBe((a as () => void).length)
        const args = Array.from({ length: (a as () => void).length }, () => 3)
        expect(String((a as (...x: unknown[]) => unknown)(...args)).length, path).toBeGreaterThan(0)
        expect(String((b as (...x: unknown[]) => unknown)(...args)).length, path).toBeGreaterThan(0)
      } else if (typeof a === 'string') {
        expect(typeof b, path).toBe('string')
        expect((b as string).length, path).toBeGreaterThan(0)
      }
    }
  })
})

describe('formatting follows the language', () => {
  it('writes the same amount with each language\'s conventions', () => {
    expect(formatMoney(1234567, 'EUR')).toMatch(/12\.345,67\s€/)
    setLanguage('en', false)
    expect(formatMoney(1234567, 'EUR')).toBe('€12,345.67')
  })

  it('formats dates in the active language', () => {
    expect(formatDate('2025-03-12T00:00:00Z', { dateStyle: 'long', timeZone: 'UTC' })).toBe('12 marzo 2025')
    setLanguage('en', false)
    expect(formatDate('2025-03-12T00:00:00Z', { dateStyle: 'long', timeZone: 'UTC' })).toBe('12 March 2025')
  })
})
