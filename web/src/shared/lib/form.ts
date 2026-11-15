import type { z } from 'zod'
import { ApiError, errorMessage } from './api'
import { t } from '@/i18n'

/** The message of each invalid field, by field name. */
export type FormErrors = Record<string, string>

type Issue = z.core.$ZodIssue

/** Express a zod issue the way the server expresses it (a code, a field, the numbers), so the catalogs are the only place with words. */
function asApiError(issue: Issue): ApiError {
  const field = String(issue.path[0] ?? '')
  // zod says "received undefined" for a missing value and e.g. "received NaN" for a wrong one
  if (issue.code === 'invalid_type')
    return new ApiError(422, '', {
      code: /received (undefined|null)/.test(issue.message) ? 'required' : 'invalid',
      field,
    })
  if (issue.code === 'too_small' && issue.origin === 'string') {
    const minimum = Number(issue.minimum)
    if (minimum <= 1) return new ApiError(422, '', { code: 'required', field })
    if (field.endsWith('password'))
      return new ApiError(422, '', { code: 'password_too_short', field, min_length: minimum })
  }
  return new ApiError(422, '', { code: 'invalid', field })
}

/**
 * Check what a member typed before it is sent, with the same limits as the server.
 * Returns the parsed data, or one message per invalid field (the first problem of each).
 */
export function checkForm<S extends z.ZodType>(
  schema: S,
  values: unknown,
): { data: z.output<S>; errors: null } | { data: null; errors: FormErrors } {
  const parsed = schema.safeParse(values)
  if (parsed.success) return { data: parsed.data, errors: null }
  const errors: FormErrors = {}
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? '')
    if (!(field in errors)) errors[field] = errorMessage(asApiError(issue), t.errors.generic)
  }
  return { data: null, errors }
}
