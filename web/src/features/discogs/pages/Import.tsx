import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '@/shared/lib/api'
import { ImportJobSchema } from '@/shared/schemas'
import { Notice } from '@/shared/components/Notice'
import { Page, Section } from '@/shared/components/Page'
import { useDiscogsStatus, type ImportJob } from '@/features/discogs/discogs'
import { t } from '@/i18n'
import { Button, buttonVariants } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import { Progress } from '@/shared/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group'
import { invalidateCollection } from '@/shared/lib/queries'
import { routes } from '@/shared/lib/routes'

const active = (j: ImportJob | null | undefined) => j?.status === 'pending' || j?.status === 'running'

export function Import() {
  const queryClient = useQueryClient()
  const status = useDiscogsStatus()
  const [shared, setShared] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Progress is read from the server, so closing and reopening the page shows the same job.
  const job = useQuery({
    queryKey: ['import-job'],
    queryFn: () => api('/api/discogs/import/latest', { schema: ImportJobSchema.nullable() }),
    refetchInterval: (q) => (active(q.state.data) ? 1000 : false),
  })
  const start = useMutation({
    mutationFn: () => api('/api/discogs/import', { method: 'POST', body: { shared }, schema: ImportJobSchema }),
    onSuccess: (data) => {
      queryClient.setQueryData(['import-job'], data)
      void invalidateCollection(queryClient)
    },
    onError: (e) => setError(errorMessage(e, t.errors.generic)),
  })

  const j = job.data
  const jobStatus = j?.status
  useEffect(() => {
    if (jobStatus === 'done') void invalidateCollection(queryClient)
  }, [jobStatus, queryClient])

  const s = status.data
  if (s && (!s.connected || s.status !== 'active')) {
    return (
      <Page className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">{t.import.title}</h1>
        <p>{s.status === 'expired' ? t.discogs.lockedExpired : t.discogs.locked}</p>
        <div><Link className={buttonVariants()} to={routes.settings}>{t.discogs.goSettings}</Link></div>
      </Page>
    )
  }

  const finished = j && !active(j)
  const pct = j?.total ? Math.round((j.processed / j.total) * 100) : null

  return (
    <Page className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t.import.title}</h1>
      {active(j) ? (
        <Section>
          <Progress value={pct} aria-label={t.import.title} />
          <p role="status" className="text-sm font-medium">{t.import.running(j?.processed ?? 0, j?.total ?? null)}</p>
          <p className="text-sm text-muted-foreground">{t.import.keepOpen}</p>
        </Section>
      ) : (
        <Section>
          {finished && j.status === 'done' && (
            <Notice kind="ok">
              <span>{t.import.done(j.added)} {j.message ? t.import.messages[j.message] ?? '' : ''}</span>
              <Link className="ml-2 underline" to="/">{t.import.toCollection}</Link>
            </Notice>
          )}
          {finished && j.status === 'failed' && <Notice kind="error">{t.import.failed} {t.import.messages[j.message ?? ''] ?? t.errors.generic} {t.import.keptSoFar(j.added)}</Notice>}
          <p className="text-sm text-muted-foreground">{t.import.intro}</p>
          <form onSubmit={(e) => { e.preventDefault(); setError(null); start.mutate() }} className="grid gap-4">
            <RadioGroup value={shared ? 'shared' : 'mine'} onValueChange={(v) => setShared(v === 'shared')}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="mine" id="own-mine" />
                <Label htmlFor="own-mine">{t.import.ownerMine}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="shared" id="own-shared" />
                <Label htmlFor="own-shared">{t.import.ownerShared}</Label>
              </div>
            </RadioGroup>
            {error && <Notice kind="error">{error}</Notice>}
            <div><Button type="submit" disabled={start.isPending}>{finished ? t.import.again : t.import.start}</Button></div>
          </form>
        </Section>
      )}
    </Page>
  )
}
