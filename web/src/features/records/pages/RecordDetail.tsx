import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLinkIcon, PencilIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { api, ApiError, errorMessage } from '@/shared/lib/api'
import { RecordSchema, RefreshOutSchema } from '@/shared/schemas'
import { DeltaText } from '@/features/records/components/Delta'
import { OwnerSelect } from '@/features/records/components/OwnerSelect'
import { Field } from '@/shared/components/Field'
import { useRecordDialog } from '@/features/records/components/RecordDialogProvider'
import { ResponsiveModal } from '@/shared/components/ResponsiveModal'
import { useDiscogsStatus } from '@/features/discogs'
import { formatMoney } from '@/shared/lib/money'
import { invalidateCollection, invalidateRecords } from '@/shared/lib/queries'
import { useLocations } from '@/features/places'
import { coverUrl, isIncompleteVersion, uploadBackCover, uploadCover, versionSummary, type RecordValue } from '@/features/records/records'
import { t } from '@/i18n'
import { formatDate } from '@/i18n/format'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

const fmtDate = (d?: string | null) => (d ? formatDate(d) : undefined)

/** The detail of a record as a dialog; the router shows it on top of the collection. */
export function RecordDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { search } = useLocation()
  return (
    <RecordDetailDialog id={id} onClose={() => navigate({ pathname: '/', search })} />
  )
}

function RecordDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const navigate = useNavigate()
  const { search } = useLocation()
  const queryClient = useQueryClient()
  const record = useQuery({ queryKey: ['record', id], retry: false, queryFn: () => api(`/api/records/${id}`, { schema: RecordSchema }) })
  const { openEdit } = useRecordDialog()
  const discogs = useDiscogsStatus()
  const locations = useLocations()
  const [proposal, setProposal] = useState<RecordValue | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const r = record.data
  const notFound = record.error instanceof ApiError && record.error.status === 404

  const place = r?.purchase?.location_id ? locations.data?.find((l) => l.id === r.purchase!.location_id) : undefined

  async function remove() {
    try {
      await api(`/api/records/${id}`, { method: 'DELETE', schema: z.void() })
      await invalidateCollection(queryClient)
      setConfirming(false)
      navigate({ pathname: '/', search }, { state: { removed: { id, title: r?.title } } })
    } catch (e) {
      toast.error(errorMessage(e, t.errors.generic))
    }
  }

  async function refreshValue(replaceManual = false) {
    setRefreshing(true)
    try {
      const out = await api(
        `/api/records/${id}/refresh-value?currency=${r?.value?.currency ?? r?.purchase?.currency ?? 'EUR'}${replaceManual ? '&replace_manual=true' : ''}`,
        { method: 'POST', schema: RefreshOutSchema },
      )
      if (out.status === 'proposal') setProposal(out.proposal ?? null)
      else if (out.status === 'no_value') toast(t.refresh.noValue)
      else if (out.status === 'updated') toast.success(t.refresh.updated)
      await invalidateCollection(queryClient)
    } catch (e) {
      toast.error(errorMessage(e, t.errors.generic))
    } finally {
      setRefreshing(false)
    }
  }

  async function changeCover(file: File | undefined) {
    if (!file) return
    try {
      queryClient.setQueryData(['record', id], await uploadCover(id, file))
      await invalidateRecords(queryClient)
    } catch (e) {
      toast.error(errorMessage(e, t.errors.generic))
    }
  }

  async function changeBackCover(file: File | undefined) {
    if (!file) return
    try {
      queryClient.setQueryData(['record', id], await uploadBackCover(id, file))
      await invalidateRecords(queryClient)
    } catch (e) {
      toast.error(errorMessage(e, t.errors.generic))
    }
  }

  const rows: [string, React.ReactNode][] = r
    ? [
        [t.record.label, r.label], [t.detail.catalogNo, r.catalog_no], [t.detail.country, r.country], [t.record.year, r.year],
        [t.record.format.split(' (')[0], r.format], [t.record.genres.split(' (')[0], r.genres.length ? r.genres.join(', ') : null], [t.record.note, r.note],
        [t.detail.paid, r.purchase?.amount_minor != null ? formatMoney(r.purchase.amount_minor, r.purchase.currency) : undefined],
        [t.detail.date, fmtDate(r.purchase?.date)],
        [t.detail.place, place ? (
          <span className="flex flex-wrap items-center gap-x-2">{place.name}
            {place.kind !== 'physical' && place.url && <a href={place.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">{t.detail.site} <ExternalLinkIcon className="size-3" /></a>}
          </span>) : undefined],
        [t.detail.value, r.value ? (
          <span>{formatMoney(r.value.amount_minor, r.value.currency)} <span className="text-muted-foreground">· {t.detail.valueLine(r.value.source === 'discogs' ? t.money.sourceDiscogs : t.money.sourceManual, fmtDate(r.value.fetched_at) ?? '', r.value.num_for_sale, r.value.measure ? (t.money.measures[r.value.measure] ?? r.value.measure) : null)}</span></span>) : undefined],
        [t.record.ownedBy, <OwnerSelect key="o" record={r} />],
      ]
    : []

  return (
    <>
      <ResponsiveModal
        open
        onOpenChange={(o) => !o && onClose()}
        title={r?.title ?? (notFound ? t.record.notFound : '')}
        description={r ? <>{r.artist}{versionSummary(r) && ` · ${versionSummary(r)}`}</> : undefined}
        footer={r && (
          <>
            <Button variant="outline" className="h-12 sm:h-9" onClick={() => { onClose(); openEdit(r) }}><PencilIcon /> {t.record.edit}</Button>
            <Button variant="outline" className="h-12 text-destructive sm:h-9" onClick={() => setConfirming(true)}><Trash2Icon /> {t.record.removeShort}</Button>
          </>
        )}
      >
        {record.isLoading && <Skeleton className="mx-auto aspect-square w-full max-w-xs rounded-xl" />}
        {notFound && <p className="py-4 text-sm text-muted-foreground">{t.record.notFound}</p>}
        {r && (
          <div className="grid gap-4 pb-2">
            {r.has_cover
              ? <img src={coverUrl(r)} alt={`${r.title} — ${r.artist}`} className="cover mx-auto aspect-square w-full max-w-xs rounded-xl object-cover shadow-xl ring-1 ring-black/5" />
              : <div className="cover placeholder mx-auto flex aspect-square w-full max-w-xs flex-col justify-center gap-1 rounded-xl bg-gradient-to-br from-zinc-200 to-zinc-300 p-4 text-zinc-700 shadow-xl ring-1 ring-black/5" role="img" aria-label={t.record.noCover}><strong>{r.title}</strong><span className="text-sm">{r.artist}</span></div>}
            {isIncompleteVersion(r) && <Badge variant="outline" className="w-fit">{t.version.incomplete}</Badge>}
            <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2 text-sm">
              {rows.filter(([, v]) => v != null && v !== '').map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
              {r.purchase?.amount_minor != null && r.value && <><dt className="text-muted-foreground">{t.detail.difference}</dt><dd><DeltaText record={r} /></dd></>}
            </dl>
            {r.discogs_release_id && discogs.data?.connected && discogs.data.status === 'active' && (
              <Button variant="secondary" className="h-11 md:h-9" disabled={refreshing} onClick={() => void refreshValue()}><RefreshCwIcon className={refreshing ? 'animate-spin' : ''} /> {t.refresh.refreshOne}</Button>
            )}
            <Field label={t.record.cover} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void changeCover(e.target.files?.[0])} />
            <Field label={t.record.backCover} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void changeBackCover(e.target.files?.[0])} />
          </div>
        )}
      </ResponsiveModal>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.record.removeTitle(r?.title ?? '')}</AlertDialogTitle>
            <AlertDialogDescription>{t.record.removeAsk}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.record.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>{t.record.removeConfirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!proposal} onOpenChange={(o) => !o && setProposal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.refresh.replaceAsk}</AlertDialogTitle>
            <AlertDialogDescription>{r?.value && proposal && t.refresh.manualVs(formatMoney(r.value.amount_minor, r.value.currency), formatMoney(proposal.amount_minor, proposal.currency))}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.refresh.keepManual}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setProposal(null); void refreshValue(true) }}>{t.refresh.use}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
