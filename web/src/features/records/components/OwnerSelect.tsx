import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '@/shared/lib/api'
import { t } from '@/i18n'
import { invalidateCollection } from '@/shared/lib/queries'
import { ownerColor, useMembers } from '@/shared/lib/members'
import { RecordSchema, type VinylRecord } from '@/shared/schemas'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { OwnerDot } from './OwnerBadge'

const SHARED = 'shared'

/**
 * Change who owns a record, at any time, without opening the edit form. The screen shows the new
 * owner only once the server has accepted it; if it refuses, the old owner stays.
 */
export function OwnerSelect({ record }: { record: Pick<VinylRecord, 'id' | 'owner_id'> }) {
  const queryClient = useQueryClient()
  const members = useMembers().data ?? []
  const change = useMutation({
    mutationFn: (ownerId: string | null) =>
      api(`/api/records/${record.id}`, { method: 'PATCH', body: { owner_id: ownerId }, schema: RecordSchema }),
    onSuccess: async (saved) => {
      queryClient.setQueryData(['record', record.id], saved)
      await invalidateCollection(queryClient)
      toast.success(
        t.record.ownerUpdated(
          saved.owner_id ? (members.find((m) => m.id === saved.owner_id)?.display_name ?? '') : null,
        ),
      )
    },
    onError: (e) => toast.error(errorMessage(e, t.errors.generic)),
  })

  const shared = (
    <span className="flex items-center gap-2">
      <UsersIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
      {t.record.sharedLabel}
    </span>
  )
  const items = [
    { value: SHARED, label: shared },
    ...members.map((m, i) => ({
      value: m.id,
      label: (
        <span className="flex items-center gap-2">
          <OwnerDot color={ownerColor(i)} />
          {m.display_name}
        </span>
      ),
    })),
  ]
  const current = members.some((m) => m.id === record.owner_id) ? (record.owner_id as string) : SHARED

  return (
    <Select
      items={items}
      value={current}
      disabled={change.isPending}
      onValueChange={(v) => v && v !== current && change.mutate(v === SHARED ? null : v)}
    >
      <SelectTrigger aria-label={t.record.ownedBy} className="h-9 w-auto min-w-40 md:h-8">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
