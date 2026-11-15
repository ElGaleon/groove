import { UsersIcon } from 'lucide-react'
import { t } from '@/i18n'
import { useOwner } from '@/shared/lib/members'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'

/** A coloured dot with the member's name: the same colour for that member on every screen. */
export function OwnerDot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ backgroundColor: color }} />
}

/**
 * Who owns a record, readable at a glance: a shared record has the group icon and the word
 * "shared", a member's record has their coloured dot and name. Never colour alone.
 * `overlay` is the version laid on top of a cover.
 */
export function OwnerBadge({ ownerId, overlay, className }: { ownerId: string | null; overlay?: boolean; className?: string }) {
  const owner = useOwner(ownerId)
  if (!owner) return null
  const skin = overlay ? 'border-transparent bg-background/90 text-foreground shadow-sm backdrop-blur' : undefined
  if (owner.kind === 'shared') {
    return (
      <Badge variant="outline" className={cn(skin, className)} title={t.record.sharedHint} data-owner="shared">
        <UsersIcon aria-hidden="true" /> {t.record.sharedLabel}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className={cn(skin, className)} title={owner.name} data-owner={owner.id}>
      <OwnerDot color={owner.color} />
      <span className="max-w-[11ch] truncate">{owner.name}</span>
    </Badge>
  )
}
