import type { ReactNode } from 'react'
import { useFilters, useSummary } from '@/features/collection/filters'
import { formatDelta, formatMoney } from '@/shared/lib/money'
import { t } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import { Card, CardContent } from '@/shared/ui/card'

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm leading-tight font-semibold tabular-nums sm:text-base">{value}</div>
    </div>
  )
}

/** Record count and financial totals (per currency) for the current collection filters. */
export function CollectionSummary() {
  const { filters } = useFilters()
  const summary = useSummary(filters)
  const s = summary.data
  if (!s) return null
  const totals = s.totals.filter((c) => c.included > 0)
  return (
    <section aria-label={t.money.summary} className="mb-4">
      <Card size="sm">
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-4 px-3 sm:grid-cols-4">
          <Stat label={t.money.records} value={formatNumber(s.total)} />
          <Stat label={t.money.spent} value={totals.length ? totals.map((c) => <span key={c.currency} className="block">{formatMoney(c.spent, c.currency)}</span>) : t.money.unavailable} />
          <Stat label={t.money.amount} value={totals.length ? totals.map((c) => <span key={c.currency} className="block">{formatMoney(c.value, c.currency)}</span>) : t.money.unavailable} />
          <Stat label={t.money.difference} value={totals.length ? totals.map((c) => <span key={c.currency} className="block">{formatDelta({ abs: c.diff, pct: c.spent ? (c.diff / c.spent) * 100 : null, currency: c.currency })}</span>) : t.money.unavailable} />
        </CardContent>
      </Card>
    </section>
  )
}
