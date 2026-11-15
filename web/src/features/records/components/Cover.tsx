import { coverUrl, type VinylRecord } from '@/features/records/records'
import { t } from '@/i18n'
import { cn } from '@/shared/lib/utils'

/** The cover, or a neutral placeholder with title and artist when there is none. */
export function Cover({
  record,
  size = 160,
  fluid = false,
  className,
}: {
  record: VinylRecord
  size?: number
  fluid?: boolean
  className?: string
}) {
  const box = className ? undefined : fluid ? { width: '100%', height: 'auto' } : { width: size, height: size }
  if (record.has_cover) {
    return (
      <img
        className={cn('cover aspect-square shrink-0 rounded-md bg-muted object-cover', className)}
        src={coverUrl(record)}
        alt={`${record.title} — ${record.artist}`}
        style={box}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    )
  }
  return (
    <div
      className={cn(
        'cover placeholder flex aspect-square shrink-0 flex-col justify-center gap-0.5 overflow-hidden bg-gradient-to-br from-zinc-200 to-zinc-300 p-2 leading-tight text-zinc-700',
        className ?? 'rounded-md text-[0.7rem]',
      )}
      style={box}
      role="img"
      aria-label={t.record.noCover}
    >
      {(fluid || className) && <strong className="line-clamp-3 text-sm">{record.title}</strong>}
      {(fluid || className) && <span className="line-clamp-2 text-xs">{record.artist}</span>}
    </div>
  )
}
