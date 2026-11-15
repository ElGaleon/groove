import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react'
import { formatDelta } from '@/shared/lib/money'
import { recordDelta, type VinylRecord } from '@/features/records/records'
import { t } from '@/i18n'
import { cn } from '@/shared/lib/utils'

/** Gain or loss: an icon and a word, never colour alone. */
export function DeltaText({
  record,
  className,
}: {
  record: Pick<VinylRecord, 'purchase' | 'value'>
  className?: string
}) {
  const d = recordDelta(record)
  if (!d) return <span className={cn('text-sm text-muted-foreground', className)}>n/d</span>
  const up = d.abs > 0
  const down = d.abs < 0
  const Icon = up ? TrendingUpIcon : down ? TrendingDownIcon : MinusIcon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-sm font-medium',
        up && 'text-emerald-700 dark:text-emerald-400',
        down && 'text-red-700 dark:text-red-400',
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="sr-only">{up ? t.money.gain : down ? t.money.loss : t.money.even}: </span>
      {formatDelta(d)}
    </span>
  )
}
