import { useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { GlobeIcon, MapPinIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { api, ApiError, errorMessage } from '@/shared/lib/api'
import { z } from 'zod'
import { LocationSchema } from '@/shared/schemas'
import { LocationDialog } from '@/features/places/components/LocationDialog'
import { Page } from '@/shared/components/Page'
import { ResponsiveModal } from '@/shared/components/ResponsiveModal'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { invalidateCollection } from '@/shared/lib/queries'
import { formatMoney } from '@/shared/lib/money'
import { KIND_LABEL, useLocations, usePlaces, type Location, type LocationInput, type PlaceStats } from '@/features/places/locations'
import { t } from '@/i18n'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { routes } from '@/shared/lib/routes'

const PurchaseMap = lazy(() => import('@/features/places/components/PurchaseMaps').then((m) => ({ default: m.PurchaseMap })))
const spentText = (s: Record<string, number>) => Object.entries(s).map(([c, a]) => formatMoney(a, c)).join(' + ') || '—'

function PlaceRow({ p, selected, onClick }: { p: PlaceStats; selected?: boolean; onClick: () => void }) {
  const online = p.location.kind === 'online'
  return (
    <li>
      <button type="button" onClick={onClick} aria-pressed={selected}
        className={`flex min-h-16 w-full items-center gap-3 rounded-lg border p-3 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'bg-accent' : 'bg-card'}`}>
        {online ? <GlobeIcon className="size-5 shrink-0 text-muted-foreground" /> : <MapPinIcon className="size-5 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium">{p.location.name}</span>
          <span className="block truncate text-sm text-muted-foreground">{p.location.address ?? p.location.url}</span>
        </span>
        <span className="shrink-0 text-right text-sm"><span className="block font-medium">{t.places.count(p.count)}</span><span className="text-muted-foreground">{spentText(p.spent)}</span></span>
      </button>
    </li>
  )
}

/** Where the family bought its records: map of physical places, online list, and the places themselves. */
export function Purchases() {
  const queryClient = useQueryClient()
  const mobile = useIsMobile()
  const [year, setYear] = useState('all')
  const [tab, setTab] = useState('map')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [edit, setEdit] = useState<{ open: boolean; location?: Location }>({ open: false })
  const [removal, setRemoval] = useState<{ open: boolean; location?: Location; count: number }>({ open: false, count: 0 })
  const [target, setTarget] = useState('')

  const places = usePlaces(year)
  const locations = useLocations()
  const data = places.data
  const all = data ? [...data.mapped, ...data.unmapped, ...data.online] : []
  const selected = all.find((p) => p.location.id === selectedId) ?? null
  const years = data?.years ?? []

  async function saveLocation(i: LocationInput, id?: string) {
    const saved = await api(id ? `/api/locations/${id}` : '/api/locations', { method: id ? 'PATCH' : 'POST', body: i, schema: LocationSchema })
    await invalidateCollection(queryClient)
    toast.success(t.places.saved)
    return saved
  }

  async function tryDelete(l: Location) {
    try {
      await api(`/api/locations/${l.id}`, { method: 'DELETE', schema: z.void() })
      await invalidateCollection(queryClient)
      toast(t.places.deleted)
    } catch (e) {
      if (e instanceof ApiError && e.data?.code === 'in_use') {
        setTarget('')
        setRemoval({ open: true, location: l, count: Number(e.data.count ?? 0) })
      } else toast.error(errorMessage(e, t.errors.generic))
    }
  }

  async function reassignAndDelete() {
    const l = removal.location
    if (!l || !target) return
    try {
      await api(`/api/locations/${l.id}/reassign`, { method: 'POST', body: { to: target }, schema: z.void() })
      await api(`/api/locations/${l.id}`, { method: 'DELETE', schema: z.void() })
      await invalidateCollection(queryClient)
      setRemoval((r) => ({ ...r, open: false }))
      toast(t.places.moved)
    } catch (e) {
      toast.error(errorMessage(e, t.errors.generic))
    }
  }

  const others = (locations.data ?? []).filter((l) => l.id !== removal.location?.id)

  return (
    <Page>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold tracking-tight">{t.places.title}</h1>
        <Select items={[{ value: 'all', label: t.places.allPeriods }, ...years.map((y) => ({ value: y, label: y }))]} value={year} onValueChange={(y) => setYear(y ?? 'all')}>
          <SelectTrigger aria-label={t.places.period} className="h-11 w-40 text-base md:h-9 md:text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.places.allPeriods}</SelectItem>
            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="h-11 w-full md:h-9 md:w-fit">
          <TabsTrigger value="map" className="flex-1">{t.places.tabMap}</TabsTrigger>
          <TabsTrigger value="online" className="flex-1">{t.places.tabOnline}</TabsTrigger>
          <TabsTrigger value="places" className="flex-1">{t.places.tabPlaces}</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="mt-4">
          {places.isLoading && <Skeleton className="h-72 w-full rounded-xl" />}
          {data && data.mapped.length === 0 && data.unmapped.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-base text-muted-foreground">
              {year !== 'all' ? t.places.emptyYear : t.places.empty}
              <div><Button className="mt-3 h-11 md:h-9" variant="outline" onClick={() => setEdit({ open: true })}><PlusIcon /> {t.places.addPlace}</Button></div>
            </div>
          ) : data && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="grid content-start gap-2">
                {data.mapped.length > 0 ? (
                  <div role="region" aria-label={t.places.mapLabel}>
                    <p className="sr-only">{t.places.mapHint}</p>
                    <Suspense fallback={<Skeleton className="h-[45dvh] w-full rounded-xl lg:h-[60dvh]" />}>
                      <PurchaseMap className="h-[45dvh] w-full rounded-xl border lg:h-[60dvh]" dragging={!mobile || dragging} selectedId={selectedId} onSelect={setSelectedId}
                        places={data.mapped.map((p) => ({ id: p.location.id, name: p.location.name, lat: p.location.lat!, lng: p.location.lng!, count: p.count }))} />
                    </Suspense>
                  </div>
                ) : <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{t.places.noneOnMap}</div>}
                {mobile && data.mapped.length > 0 && (
                  <label className="flex items-center gap-2 text-sm"><Switch checked={dragging} onCheckedChange={setDragging} aria-label={t.places.dragLabel} /> {t.places.drag}</label>
                )}
              </div>
              <div className="grid content-start gap-4">
                <section aria-label={t.places.physical}>
                  <h2 className="mb-2 text-sm font-medium text-muted-foreground">{t.places.physical}</h2>
                  <ul className="grid gap-2">{data.mapped.map((p) => <PlaceRow key={p.location.id} p={p} selected={p.location.id === selectedId} onClick={() => setSelectedId(p.location.id)} />)}</ul>
                </section>
                {data.unmapped.length > 0 && (
                  <section aria-label={t.places.noPosition}>
                    <h2 className="mb-2 text-sm font-medium text-muted-foreground">{t.places.noPosition}</h2>
                    <ul className="grid gap-2">{data.unmapped.map((p) => <PlaceRow key={p.location.id} p={p} onClick={() => setSelectedId(p.location.id)} />)}</ul>
                  </section>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="online" className="mt-4">
          {data && data.online.length === 0
            ? <div className="rounded-xl border border-dashed p-10 text-center text-base text-muted-foreground">{t.places.emptyOnline}</div>
            : <ul className="grid gap-2 md:max-w-2xl">{data?.online.map((p) => <PlaceRow key={p.location.id} p={p} onClick={() => setSelectedId(p.location.id)} />)}</ul>}
        </TabsContent>

        <TabsContent value="places" className="mt-4 grid gap-3 md:max-w-2xl">
          <Button className="h-11 w-fit md:h-9" onClick={() => setEdit({ open: true })}><PlusIcon /> {t.places.newPlace}</Button>
          <ul className="divide-y rounded-xl border bg-card">
            {(locations.data ?? []).length === 0 && <li className="p-6 text-center text-muted-foreground">{t.places.none}</li>}
            {(locations.data ?? []).map((l) => (
              <li key={l.id} className="flex items-center gap-2 p-3">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-base font-medium">{l.name}<Badge variant="secondary">{KIND_LABEL[l.kind]}</Badge></span>
                  <span className="block truncate text-sm text-muted-foreground">{[l.address, l.url].filter(Boolean).join(' · ')}</span>
                </span>
                <Button variant="outline" size="icon" className="size-11 md:size-8" aria-label={t.places.editAria(l.name)} onClick={() => setEdit({ open: true, location: l })}><PencilIcon /></Button>
                <Button variant="outline" size="icon" className="size-11 text-destructive md:size-8" aria-label={t.places.deleteAria(l.name)} onClick={() => void tryDelete(l)}><Trash2Icon /></Button>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      <ResponsiveModal open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)} title={selected?.location.name ?? ''} description={selected?.location.address ?? selected?.location.url ?? undefined}
        footer={selected && <Button variant="outline" className="h-12 sm:h-9" onClick={() => setEdit({ open: true, location: selected.location })}><PencilIcon /> {t.places.editPlace}</Button>}>
        {selected && (
          <div className="grid gap-3 pb-2">
            <p className="text-base">{t.places.spentLine(selected.count, spentText(selected.spent))}</p>
            {selected.location.url && <a href={selected.location.url} target="_blank" rel="noreferrer" className="w-fit text-sm underline">{selected.location.url}</a>}
            <ul className="divide-y rounded-lg border">
              {selected.records.map((r) => (
                <li key={r.id}>
                  <Link to={routes.record(r.id)} className="flex min-h-14 items-center justify-between gap-2 p-3 hover:bg-accent">
                    <span className="min-w-0"><span className="block truncate font-medium">{r.title}</span><span className="block truncate text-sm text-muted-foreground">{r.artist}</span></span>
                    <span className="shrink-0 text-sm">{r.amount_minor != null && r.currency ? formatMoney(r.amount_minor, r.currency) : '—'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </ResponsiveModal>

      <LocationDialog open={edit.open} onOpenChange={(o) => setEdit((e) => ({ ...e, open: o }))} location={edit.location} onSave={saveLocation} />

      <AlertDialog open={removal.open} onOpenChange={(o) => setRemoval((r) => ({ ...r, open: o }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.places.inUse(removal.location?.name ?? '', removal.count)}</AlertDialogTitle>
            <AlertDialogDescription>{t.places.inUseText}</AlertDialogDescription>
          </AlertDialogHeader>
          <Select items={others.map((l) => ({ value: l.id, label: l.name }))} value={target || null} onValueChange={(v) => setTarget(v ?? '')}>
            <SelectTrigger aria-label={t.places.moveTo} className="h-11 w-full text-base md:h-9 md:text-sm"><SelectValue placeholder={t.places.moveTo} /></SelectTrigger>
            <SelectContent>{others.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.record.cancel}</AlertDialogCancel>
            <Button disabled={!target} onClick={reassignAndDelete}>{t.places.moveDelete}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  )
}
