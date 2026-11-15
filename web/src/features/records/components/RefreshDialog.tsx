import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api, errorMessage } from '@/shared/lib/api'
import { RecordListSchema, RefreshOutSchema } from '@/shared/schemas'
import type { RefreshStatus } from '@/features/discogs'
import { useCurrency } from '@/features/settings'
import { formatMoney } from '@/shared/lib/money'
import { invalidateCollection } from '@/shared/lib/queries'
import type { RecordValue, VinylRecord } from '@/features/records/records'
import { t } from '@/i18n'
import { ResponsiveModal } from '@/shared/components/ResponsiveModal'
import { Button } from '@/shared/ui/button'

interface Item {
  record: VinylRecord
  status: RefreshStatus | 'failed'
  proposal?: RecordValue | null
  error?: string
}

/** Update the value of every record linked to Discogs, one at a time (the server paces the calls). */
export function RefreshDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const [currency] = useCurrency()
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [items, setItems] = useState<Item[] | null>(null)
  const running = useRef(false)

  async function run(records: VinylRecord[], keep: Item[] = []) {
    if (running.current) return
    running.current = true
    setProgress({ done: 0, total: records.length })
    const out: Item[] = []
    let stop: string | undefined
    for (const [i, record] of records.entries()) {
      if (stop) {
        out.push({ record, status: 'failed', error: stop })
      } else {
        try {
          const r = await api(`/api/records/${record.id}/refresh-value?currency=${currency}`, {
            method: 'POST',
            schema: RefreshOutSchema,
          })
          out.push({ record: r.record, status: r.status, proposal: r.proposal })
        } catch (e) {
          const message = errorMessage(e, t.errors.generic)
          out.push({ record, status: 'failed', error: message })
          const code = (e as { data?: { code?: string } }).data?.code
          if (code === 'discogs_expired' || code === 'discogs_not_connected') stop = message
        }
      }
      setProgress({ done: i + 1, total: records.length })
    }
    setItems([...keep, ...out])
    setProgress(null)
    running.current = false
    await invalidateCollection(queryClient)
  }

  async function allLinked(): Promise<VinylRecord[]> {
    const all: VinylRecord[] = []
    // 100 is the largest page the API serves.
    for (let offset = 0; ; offset += 100) {
      const page = await api(`/api/records?discogs=true&limit=100&offset=${offset}`, { schema: RecordListSchema })
      all.push(...page.items)
      if (all.length >= page.total || page.items.length === 0) return all
    }
  }

  useEffect(() => {
    if (!open) return
    setItems(null)
    allLinked()
      .then((records) => run(records))
      .catch((e) => {
        setItems([])
        toast.error(errorMessage(e, t.errors.generic))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const by = (s: Item['status']) => (items ?? []).filter((i) => i.status === s)
  const proposals = by('proposal')
  const failed = by('failed')

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !running.current && onOpenChange(o)}
      title={t.refresh.title}
      description={t.refresh.desc}
      footer={
        <Button className="h-12 sm:h-9" disabled={!!progress} onClick={() => onOpenChange(false)}>
          {t.refresh.close}
        </Button>
      }
    >
      <div className="grid gap-4 pb-2 text-sm" aria-live="polite">
        {progress && <p>{t.refresh.running(progress.done, progress.total)}</p>}
        {items && (
          <>
            <p className="font-medium">
              {t.refresh.summary(
                by('updated').length,
                by('unchanged').length + by('no_value').length,
                proposals.length,
                failed.length,
              )}
            </p>
            {items.length === 0 && <p className="text-muted-foreground">{t.refresh.none}</p>}
            {proposals.length > 0 && (
              <section>
                <h3 className="mb-1 font-medium">{t.refresh.confirmTitle}</h3>
                <ul className="divide-y rounded-md border">
                  {proposals.map((p) => (
                    <li key={p.record.id} className="flex items-center gap-2 p-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.record.title}</span>
                        <span className="text-muted-foreground">
                          {t.refresh.manualVs(
                            formatMoney(p.record.value!.amount_minor, p.record.value!.currency),
                            formatMoney(p.proposal!.amount_minor, p.proposal!.currency),
                          )}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await api(
                            `/api/records/${p.record.id}/refresh-value?currency=${p.proposal!.currency}&replace_manual=true`,
                            { method: 'POST', schema: RefreshOutSchema },
                          )
                          setItems((x) => x!.filter((i) => i !== p))
                          toast.success(t.refresh.replaced)
                          await invalidateCollection(queryClient)
                        }}
                      >
                        {t.refresh.use}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {failed.length > 0 && (
              <section>
                <h3 className="mb-1 font-medium">{t.refresh.failedTitle}</h3>
                <ul className="divide-y rounded-md border">
                  {failed.map((f) => (
                    <li key={f.record.id} className="p-2">
                      <span className="font-medium">{f.record.title}</span>{' '}
                      <span className="text-muted-foreground">· {f.error}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-2 h-11 md:h-9"
                  variant="outline"
                  onClick={() =>
                    void run(
                      failed.map((f) => f.record),
                      items.filter((i) => i.status !== 'failed'),
                    )
                  }
                >
                  {t.refresh.retryFailed}
                </Button>
              </section>
            )}
          </>
        )}
      </div>
    </ResponsiveModal>
  )
}
