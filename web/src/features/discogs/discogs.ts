import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { DiscogsStatusSchema, ReleaseValueSchema } from '@/shared/schemas'

export type { DiscogsStatus } from '@/shared/schemas'

export const useDiscogsStatus = () =>
  useQuery({ queryKey: ['discogs-status'], queryFn: () => api('/api/discogs/status', { schema: DiscogsStatusSchema }) })

export type { ImportJob, ReleaseValue, SearchPage, SearchResult } from '@/shared/schemas'

export const fetchReleaseValue = (releaseId: number, currency: string) =>
  api(`/api/discogs/releases/${releaseId}/value?currency=${currency}`, { schema: ReleaseValueSchema })

export type RefreshStatus = 'updated' | 'unchanged' | 'proposal' | 'no_value'
