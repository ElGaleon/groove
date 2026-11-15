import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { api, ApiError, ResponseShapeError } from './api'
import { listOf, RecordListSchema } from '@/shared/schemas'

const answer = (status: number, body?: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ status, ok: status < 400, json: async () => body })),
  )

const Thing = z.object({ id: z.string(), year: z.number().nullable() })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('api() with a schema', () => {
  it('returns the checked data and ignores fields it does not know', async () => {
    answer(200, { id: 'a', year: 1959, brand_new_field: true })
    expect(await api('/api/x', { schema: Thing })).toEqual({ id: 'a', year: 1959 })
  })

  it('fails with a coded error when a field has the wrong type, and logs no values', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    answer(200, { id: 'a', year: 'nineteen fifty-nine' })
    const error = await api('/api/x', { schema: Thing }).catch((e) => e)
    expect(error).toBeInstanceOf(ResponseShapeError)
    expect(error.code).toBe('response_shape')
    const logged = String(log.mock.calls[0]?.[0])
    expect(logged).toContain('/api/x')
    expect(logged).toContain('year')
    expect(logged).not.toContain('nineteen')
  })

  it('fails when a required field is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    answer(200, { year: 1 })
    await expect(api('/api/x', { schema: Thing })).rejects.toBeInstanceOf(ResponseShapeError)
  })

  it('accepts an empty answer for a void schema', async () => {
    answer(204)
    expect(await api('/api/x', { method: 'DELETE', schema: z.void() })).toBeUndefined()
  })

  it('leaves the error answers of the API as they are', async () => {
    answer(401, { code: 'invalid_credentials', detail: 'Wrong email or password' })
    const error = await api('/api/x', { schema: Thing }).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).not.toBeInstanceOf(ResponseShapeError)
    expect(error.code).toBe('invalid_credentials')
  })
})

describe('listOf', () => {
  it('drops a row with the wrong shape and keeps the others', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const parsed = listOf(Thing).parse([
      { id: 'a', year: 1 },
      { id: 2, year: 1 },
      { id: 'c', year: null },
    ])
    expect(parsed.map((r) => r.id)).toEqual(['a', 'c'])
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('is what the record list uses', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(RecordListSchema.parse({ items: [{ nope: true }], total: 5, offset: 0, limit: 10 })).toEqual({
      items: [],
      total: 5,
      offset: 0,
      limit: 10,
    })
  })
})
