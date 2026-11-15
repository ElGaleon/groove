import { describe, expect, it } from 'vitest'
import { ApiError, errorMessage } from './api'

const err = (status: number, body: Record<string, unknown>) => new ApiError(status, String(body.detail ?? ''), body)

describe('errorMessage', () => {
  it('translates a known code, ignoring the English detail', () => {
    const e = err(401, { code: 'invalid_credentials', detail: 'Wrong email or password' })
    expect(e.code).toBe('invalid_credentials')
    expect(errorMessage(e, 'x')).toBe('Email o password non corretti.')
  })

  it('names the field of a validation error', () => {
    expect(errorMessage(err(422, { code: 'required', field: 'title', detail: 'Field title is required' }), 'x')).toBe(
      'Manca il titolo.',
    )
    expect(errorMessage(err(422, { code: 'invalid', field: 'year', detail: '' }), 'x')).toContain('l’anno')
  })

  it('uses the values that travel with a code', () => {
    expect(
      errorMessage(err(422, { code: 'password_too_short', field: 'password', min_length: 12, detail: '' }), 'x'),
    ).toContain('12')
    expect(errorMessage(err(409, { code: 'in_use', count: 1, detail: '' }), 'x')).toContain('1 disco')
    expect(errorMessage(err(409, { code: 'in_use', count: 3, detail: '' }), 'x')).toContain('3 dischi')
  })

  it('falls back for an unknown code, a plain error or a non-API error', () => {
    expect(errorMessage(err(500, { code: 'something_new', detail: 'English' }), 'generic')).toBe('generic')
    expect(errorMessage(err(500, { detail: 'English' }), 'generic')).toBe('generic')
    expect(errorMessage(new Error('boom'), 'generic')).toBe('generic')
  })
})
