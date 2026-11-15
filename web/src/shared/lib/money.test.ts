import { describe, expect, it } from 'vitest'
import { delta, formatDelta, formatMoney, parseAmount } from './money'

describe('money', () => {
  it('parses Italian and English amounts into minor units', () => {
    expect(parseAmount('24,90', 'EUR')).toBe(2490)
    expect(parseAmount('1.234,50', 'EUR')).toBe(123450)
    expect(parseAmount('24.9', 'EUR')).toBe(2490)
    expect(parseAmount('3200', 'JPY')).toBe(3200)
    expect(parseAmount('abc', 'EUR')).toBeNull()
    expect(parseAmount('-5', 'EUR')).toBeNull()
    expect(parseAmount('', 'EUR')).toBeNull()
  })
  it('formats', () => {
    expect(formatMoney(2490, 'EUR')).toContain('24,90')
  })
  it('gain: +15 EUR (+75%)', () => {
    const d = delta({ amountMinor: 2000, currency: 'EUR' }, { amountMinor: 3500, currency: 'EUR' })
    expect(d?.abs).toBe(1500)
    expect(Math.round(d!.pct!)).toBe(75)
    expect(formatDelta(d)).toContain('+')
  })
  it('n/d when something is missing or currencies differ', () => {
    expect(formatDelta(delta(undefined, { amountMinor: 1, currency: 'EUR' }))).toBe('n/d')
    expect(formatDelta(delta({ amountMinor: 1, currency: 'USD' }, { amountMinor: 1, currency: 'EUR' }))).toBe('n/d')
  })
})
