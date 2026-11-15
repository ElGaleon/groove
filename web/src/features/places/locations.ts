import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { LocationListSchema, PlacesSchema, type LocationKind } from '@/shared/schemas'

export type { Location, LocationKind } from '@/shared/schemas'

export interface LocationInput {
  name: string
  kind: LocationKind
  address: string | null
  lat: number | null
  lng: number | null
  url: string | null
}

export const useLocations = () =>
  useQuery({ queryKey: ['locations'], queryFn: () => api('/api/locations', { schema: LocationListSchema }) })

export type { PlaceRecord, PlaceStats, Places } from '@/shared/schemas'

export const usePlaces = (year: string) =>
  useQuery({
    queryKey: ['places', year],
    queryFn: () => api(`/api/purchases/places${year === 'all' ? '' : `?year=${year}`}`, { schema: PlacesSchema }),
  })

export const KIND_LABEL: Record<LocationKind, string> = {
  physical: 'Fisico',
  online: 'Online',
  both: 'Fisico + online',
}
