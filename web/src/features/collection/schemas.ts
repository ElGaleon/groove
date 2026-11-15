import { z } from 'zod'

/**
 * What the address bar may say about the collection. Whatever is missing or not understood falls
 * back to its default, so a stale or hand-edited link never breaks the screen.
 */
export const SORTS = ['artist', 'title', 'year', 'added'] as const
export const VIEWS = ['shelf', 'list', 'grid'] as const

const fourDigits = z.string().regex(/^\d{4}$/).catch('')

export const filtersSchema = z.object({
  q: z.string().catch(''),
  owner: z.string().min(1).catch('any'), // 'any' | 'shared' | a member id
  genre: z.string().catch(''),
  decade: fourDigits,
  label: z.string().catch(''),
  country: z.string().catch(''),
  format: z.string().catch(''),
  year: fourDigits,
  sort: z.enum(SORTS).catch('artist'),
  order: z.enum(['asc', 'desc']).catch('asc'),
})

export const viewSchema = z.enum(VIEWS)

/** How many records a block (grid) or a page (table) holds. */
export const PAGE_SIZES = [10, 25, 50] as const
export type PageSize = (typeof PAGE_SIZES)[number]
export const DEFAULT_PAGE_SIZE: PageSize = 10

/** Where the member is in the collection: kept apart from the filters so totals do not refetch. */
export const browseSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  size: z.coerce.number().pipe(z.union(PAGE_SIZES.map((n) => z.literal(n)))).catch(DEFAULT_PAGE_SIZE),
})
export type Browse = { page: number; size: PageSize }

export type Filters = z.infer<typeof filtersSchema>
export type View = z.infer<typeof viewSchema>
export type SortKey = (typeof SORTS)[number]

/** Read the filters and the view from the address bar (`fallbackView` is the default view for this device). */
export function parseSearch(params: URLSearchParams, fallbackView: View): { filters: Filters; view: View; browse: Browse } {
  const raw = Object.fromEntries(
    Object.keys(filtersSchema.shape).map((key) => [key, params.get(key) ?? undefined]),
  )
  return {
    filters: filtersSchema.parse(raw),
    view: viewSchema.catch(fallbackView).parse(params.get('view') ?? undefined),
    browse: browseSchema.parse({ page: params.get('page') ?? undefined, size: params.get('size') ?? undefined }) as Browse,
  }
}
