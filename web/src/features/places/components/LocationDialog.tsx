import { lazy, Suspense, useEffect, useState } from 'react'
import { LocateFixedIcon } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage } from '@/shared/lib/api'
import { geocode } from '@/features/places/geocode'
import type { Location, LocationInput, LocationKind } from '@/features/places/locations'
import { t } from '@/i18n'
import { ResponsiveModal } from '@/shared/components/ResponsiveModal'
import { Button } from '@/shared/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

const PointPicker = lazy(() => import('./PurchaseMaps').then((m) => ({ default: m.PointPicker })))
type Errors = Partial<Record<'name' | 'address' | 'url', string>>
const URL_RE = /^https?:\/\/[^\s./]+\.[^\s]+$/i

/** Validation that mirrors the API, so mistakes show next to the field before saving. */
export function validateLocation(i: LocationInput): Errors {
  const e: Errors = {}
  if (!i.name.trim()) e.name = t.places.form.nameRequired
  if (i.kind !== 'online' && !i.address?.trim()) e.address = t.places.form.addressRequired
  if (i.kind !== 'physical') {
    if (!i.url?.trim()) e.url = t.places.form.urlRequired
    else if (!URL_RE.test(i.url.trim())) e.url = t.places.form.urlInvalid
  }
  return e
}

export function LocationDialog({ open, onOpenChange, location, onSave }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  location?: Location
  onSave: (input: LocationInput, id?: string) => Promise<unknown>
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<LocationKind>('physical')
  const [address, setAddress] = useState('')
  const [url, setUrl] = useState('')
  const [pt, setPt] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null })
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [geoMsg, setGeoMsg] = useState('')

  useEffect(() => {
    if (!open) return
    setName(location?.name ?? '')
    setKind(location?.kind ?? 'physical')
    setAddress(location?.address ?? '')
    setUrl(location?.url ?? '')
    setPt({ lat: location?.lat ?? null, lng: location?.lng ?? null })
    setErrors({})
    setGeoMsg('')
  }, [open, location])

  const physical = kind !== 'online'
  const online = kind !== 'physical'

  async function find() {
    if (!address.trim()) { setErrors((e) => ({ ...e, address: t.places.form.addressRequired })); return }
    setBusy(true)
    setGeoMsg('')
    try {
      const r = await geocode(address)
      if (r) { setPt({ lat: r.lat, lng: r.lng }); setGeoMsg(t.places.form.found) } else setGeoMsg(t.places.form.notFound)
    } catch {
      setGeoMsg(t.places.form.geoDown)
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    const input: LocationInput = {
      name: name.trim(), kind,
      address: physical ? address.trim() : null,
      url: online ? url.trim() : null,
      lat: physical ? pt.lat : null,
      lng: physical ? pt.lng : null,
    }
    const found = validateLocation(input)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      await onSave(input, location?.id)
      onOpenChange(false)
    } catch (e) {
      toast.error(errorMessage(e, t.errors.generic))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title={location ? t.places.form.editTitle : t.places.form.newTitle} description={t.places.form.desc}
      footer={<><Button variant="outline" className="h-12 sm:h-9" onClick={() => onOpenChange(false)}>{t.record.cancel}</Button><Button className="h-12 sm:h-9" disabled={busy} onClick={submit}>{t.record.save}</Button></>}>
      <FieldGroup className="pb-2">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="loc-name">{t.places.form.name}</FieldLabel>
          <Input id="loc-name" className="h-11 text-base md:h-9 md:text-sm" value={name} aria-invalid={!!errors.name} onChange={(e) => setName(e.target.value)} placeholder={t.places.form.namePlaceholder} />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <Field>
          <FieldLabel>{t.places.form.type}</FieldLabel>
          <ToggleGroup variant="outline" value={[kind]} onValueChange={(v) => v[0] && setKind(v[0] as LocationKind)} aria-label={t.places.form.type} className="w-full">
            <ToggleGroupItem value="physical" className="h-11 flex-1 md:h-9">{t.places.kind.physical}</ToggleGroupItem>
            <ToggleGroupItem value="online" className="h-11 flex-1 md:h-9">{t.places.kind.online}</ToggleGroupItem>
            <ToggleGroupItem value="both" className="h-11 flex-1 md:h-9">{t.places.kind.both}</ToggleGroupItem>
          </ToggleGroup>
        </Field>
        {physical && (
          <>
            <Field data-invalid={!!errors.address}>
              <FieldLabel htmlFor="loc-address">{t.places.form.address}</FieldLabel>
              <div className="flex gap-2">
                <Input id="loc-address" className="h-11 flex-1 text-base md:h-9 md:text-sm" value={address} aria-invalid={!!errors.address} onChange={(e) => setAddress(e.target.value)} placeholder={t.places.form.addressPlaceholder} />
                <Button type="button" variant="outline" className="h-11 md:h-9" disabled={busy} onClick={find}><LocateFixedIcon /> {t.places.form.find}</Button>
              </div>
              {errors.address && <FieldError>{errors.address}</FieldError>}
              {geoMsg && <FieldDescription role="status">{geoMsg}</FieldDescription>}
            </Field>
            <Field>
              <FieldLabel>{t.places.form.point} {pt.lat == null && <span className="font-normal text-muted-foreground">{t.places.form.optional}</span>}</FieldLabel>
              <Suspense fallback={<Skeleton className="h-56 w-full rounded-lg" />}>
                <PointPicker lat={pt.lat ?? undefined} lng={pt.lng ?? undefined} onChange={(lat, lng) => setPt({ lat, lng })} className="h-56 w-full rounded-lg border" />
              </Suspense>
              <FieldDescription>{pt.lat != null && pt.lng != null ? t.places.form.coords(pt.lat, pt.lng) : t.places.form.noCoords}</FieldDescription>
            </Field>
          </>
        )}
        {online && (
          <Field data-invalid={!!errors.url}>
            <FieldLabel htmlFor="loc-url">{t.places.form.url}</FieldLabel>
            <Input id="loc-url" type="url" inputMode="url" className="h-11 text-base md:h-9 md:text-sm" value={url} aria-invalid={!!errors.url} onChange={(e) => setUrl(e.target.value)} placeholder={t.places.form.urlPlaceholder} />
            {errors.url && <FieldError>{errors.url}</FieldError>}
          </Field>
        )}
      </FieldGroup>
    </ResponsiveModal>
  )
}
