import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { HouseholdSchema, type Member } from '@/shared/schemas'

export type { Member }

/** The members of the family, in the order they joined; one cached query shared by every screen. */
export const useMembers = () =>
  useQuery({
    queryKey: ['household'],
    queryFn: () => api('/api/household', { schema: HouseholdSchema }),
    select: (d) => d.members,
  })

const PALETTE = 6

/** A member's colour: the palette entry at their place in the household, so it is the same on every screen. */
export const ownerColor = (index: number) => `var(--owner-${(index % PALETTE) + 1})`

export type Owner = { kind: 'shared' } | { kind: 'member'; id: string; name: string; color: string }

/**
 * Who owns a record: `shared` for the whole family, the member otherwise. `null` while the
 * members are loading, so nothing wrong is shown in the meantime. An owner who is no longer in the
 * family counts as shared (the server makes such records shared when a member leaves).
 */
export function useOwner(ownerId: string | null): Owner | null {
  const members = useMembers().data
  if (!ownerId) return { kind: 'shared' }
  if (!members) return null
  const index = members.findIndex((m) => m.id === ownerId)
  if (index < 0) return { kind: 'shared' }
  return { kind: 'member', id: ownerId, name: members[index].display_name, color: ownerColor(index) }
}
