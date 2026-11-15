import type { z } from 'zod'
import { t } from '@/i18n'

/** An error answered by the API: `code` (and `field`) are the contract; `message` is English, for logs. */
export class ApiError extends Error {
  status: number
  data: Record<string, unknown> | null
  code: string | null
  field: string | null
  constructor(status: number, message: string, data: Record<string, unknown> | null = null) {
    super(message)
    this.status = status
    this.data = data
    this.code = data && typeof data.code === 'string' ? data.code : null
    this.field = data && typeof data.field === 'string' ? data.field : null
  }
}

/** The API answered, but not in the shape this app knows: a bug on one side, never the member's fault. */
export class ResponseShapeError extends ApiError {
  path: string
  constructor(status: number, path: string) {
    super(status, `Unexpected response shape from ${path}`, { code: 'response_shape' })
    this.path = path
  }
}

interface ApiOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
}

/**
 * JSON call to the API. State-changing requests carry the header the server requires.
 * The answer is checked against `schema` before it reaches a screen: unknown fields are ignored,
 * a wrong shape throws `ResponseShapeError` (and is logged without its values). A call that
 * answers with nothing (204) uses `z.void()`.
 */
export async function api<S extends z.ZodType>(path: string, options: ApiOptions & { schema: S }): Promise<z.output<S>> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {}
  if (method !== 'GET') headers['X-Requested-With'] = 'groove'
  const isForm = options.body instanceof FormData
  if (options.body !== undefined && !isForm) headers['Content-Type'] = 'application/json'

  const response = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    signal: options.signal,
    body:
      options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
  })
  const data = response.status === 204 ? undefined : await response.json().catch(() => null)
  if (!response.ok) {
    const detail = data && typeof data.detail === 'string' ? data.detail : null
    throw new ApiError(response.status, detail ?? `HTTP ${response.status}`, data)
  }
  const parsed = options.schema.safeParse(data)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    console.error(`[api] unexpected response from ${method} ${path}: ${issue?.path.join('.') || '(root)'} ${issue?.code ?? ''}`)
    throw new ResponseShapeError(response.status, path)
  }
  return parsed.data
}

/** The message for a member: the API error translated by its code, or `fallback`. */
export function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError) || !error.code) return fallback
  const { code, field, data } = error
  if (code === 'password_too_short') return t.errors.passwordTooShort(Number(data?.min_length ?? 10))
  if (code === 'in_use') return t.errors.inUse(Number(data?.count ?? 0))
  if ((code === 'required' || code === 'invalid') && field) {
    const label = t.errors.fields[field] ?? field
    return code === 'required' ? t.errors.required(label) : t.errors.invalid(label)
  }
  return t.errors.codes[code] ?? fallback
}
