import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { DiscIcon, LoaderCircleIcon, PencilLineIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError, errorMessage } from '@/shared/lib/api'
import { checkForm } from '@/shared/lib/form'
import { LocationSchema, RecordSchema } from '@/shared/schemas'
import { useMembers } from '@/shared/lib/members'
import { recordForm } from '@/features/records/schemas'
import { fetchReleaseValue, useDiscogsStatus, type SearchResult } from '@/features/discogs'
import { invalidateCollection } from '@/shared/lib/queries'
import { useCurrency, CURRENCIES } from '@/features/settings'
import { amountToInput, parseAmount } from '@/shared/lib/money'
import { useLocations, type Location, type LocationInput } from '@/features/places'
import {
  mainFormat,
  uploadCover,
  type RecordInput,
  type RecordValue,
  type ValueInput,
  type VinylRecord,
} from '@/features/records/records'
import { t } from '@/i18n'
import { DiscogsSearchStep } from '@/features/discogs'
import { LocationDialog } from '@/features/places'
import { LocationPicker } from '@/features/places'
import { ResponsiveModal } from '@/shared/components/ResponsiveModal'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Button } from '@/shared/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { Link } from 'react-router-dom'
import { routes } from '@/shared/lib/routes'

const input = 'h-11 text-base md:h-9 md:text-sm'
const trigger = 'h-11 w-full text-base md:h-9 md:text-sm'

interface Form {
  title: string
  artist: string
  label: string
  catalogNo: string
  year: string
  country: string
  format: string
  genres: string
  note: string
  ownerId: string
  price: string
  currency: string
  date: string
  locationId: string
  channel: 'physical' | 'online'
  valueAmount: string
  valueCurrency: string
}
type Errors = Partial<Record<keyof Form, string>>

function toForm(r: Partial<VinylRecord> | undefined, currency: string): Form {
  return {
    title: r?.title ?? '',
    artist: r?.artist ?? '',
    label: r?.label ?? '',
    catalogNo: r?.catalog_no ?? '',
    year: r?.year?.toString() ?? '',
    country: r?.country ?? '',
    format: r?.format ?? '',
    genres: (r?.genres ?? []).join(', '),
    note: r?.note ?? '',
    ownerId: r?.owner_id ?? '',
    price: amountToInput(r?.purchase?.amount_minor ?? undefined, r?.purchase?.currency ?? currency),
    currency: r?.purchase?.currency ?? currency,
    date: r?.purchase?.date ?? '',
    locationId: r?.purchase?.location_id ?? '',
    channel: r?.purchase?.channel ?? 'physical',
    valueAmount: amountToInput(r?.value?.amount_minor, r?.value?.currency ?? currency),
    valueCurrency: r?.value?.currency ?? currency,
  }
}

/** Add or edit a record. With Discogs connected, adding starts from a live Discogs search. */
export function RecordDialog({
  open,
  onOpenChange,
  record,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: VinylRecord
  onSaved?: (record: VinylRecord) => void
}) {
  const queryClient = useQueryClient()
  const [defaultCurrency] = useCurrency()
  const status = useDiscogsStatus()
  const linkedAccount = status.data?.connected && status.data.status === 'active'
  const locations = useLocations()
  const members = useMembers()

  const [f, setF] = useState<Form>(() => toForm(record, defaultCurrency))
  const [errors, setErrors] = useState<Errors>({})
  const [step, setStep] = useState<'search' | 'form'>('form')
  const [picked, setPicked] = useState<SearchResult | null>(null)
  const [dgValue, setDgValue] = useState<RecordValue | null>(null)
  const [valueLoading, setValueLoading] = useState(false)
  const [cover, setCover] = useState<File | null>(null)
  const [newLocation, setNewLocation] = useState(false)
  const [duplicate, setDuplicate] = useState<VinylRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setF((x) => ({ ...x, [key]: value }))

  useEffect(() => {
    if (!open) return
    setF(toForm(record, defaultCurrency))
    setErrors({})
    setPicked(null)
    setDgValue(record?.value?.source === 'discogs' ? record.value : null)
    setCover(null)
    setDuplicate(null)
    setFormError(null)
    setStep(!record && linkedAccount ? 'search' : 'form')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record])

  // The first render after opening may not know yet whether Discogs is connected.
  useEffect(() => {
    if (open && !record && step === 'form' && linkedAccount && !picked && f.title === '' && f.artist === '')
      setStep('search')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedAccount])

  const location: Location | undefined = locations.data?.find((l) => l.id === f.locationId)
  const releaseId = picked?.release_id ?? record?.discogs_release_id ?? null

  async function pick(r: SearchResult) {
    setPicked(r)
    setF((x) => ({
      ...x,
      title: r.title || x.title,
      artist: r.artist || x.artist,
      label: r.label ?? '',
      catalogNo: r.catalog_no ?? '',
      year: r.year?.toString() ?? '',
      country: r.country ?? '',
      format: mainFormat(r.format),
      genres: r.genres.join(', '),
    }))
    setStep('form')
    setValueLoading(true)
    try {
      const v = await fetchReleaseValue(r.release_id, f.valueCurrency)
      if (v.amount_minor == null) {
        setDgValue(null)
        toast(t.add.importedNoValue)
      } else {
        setDgValue({
          amount_minor: v.amount_minor,
          currency: v.currency,
          source: 'discogs',
          measure: v.measure,
          fetched_at: new Date().toISOString(),
          num_for_sale: v.num_for_sale,
        })
        setF((x) => ({ ...x, valueCurrency: v.currency, valueAmount: amountToInput(v.amount_minor!, v.currency) }))
        toast.success(t.add.imported)
      }
    } catch {
      toast.error(t.add.valueFailed)
    } finally {
      setValueLoading(false)
    }
  }

  function build(): { input: RecordInput; errors: Errors } {
    const e: Errors = {}
    const year = f.year.trim() ? Number(f.year) : null
    const checked = checkForm(recordForm, { title: f.title, artist: f.artist, year: year ?? undefined })
    if (checked.errors) {
      if (checked.errors.title) e.title = checked.errors.title
      if (checked.errors.artist) e.artist = checked.errors.artist
      if (checked.errors.year) e.year = t.money.invalidYear
    }
    const price = f.price.trim() ? parseAmount(f.price, f.currency) : undefined
    if (price === null) e.price = t.money.invalidAmount
    const vAmount = f.valueAmount.trim() ? parseAmount(f.valueAmount, f.valueCurrency) : undefined
    if (vAmount === null) e.valueAmount = t.money.invalidAmount

    let value: ValueInput | null = null
    if (typeof vAmount === 'number') {
      if (dgValue && dgValue.amount_minor === vAmount && dgValue.currency === f.valueCurrency)
        value = {
          amount_minor: vAmount,
          currency: f.valueCurrency,
          source: 'discogs',
          measure: dgValue.measure,
          num_for_sale: dgValue.num_for_sale,
        }
      else
        value = {
          amount_minor: vAmount,
          currency: f.valueCurrency,
          source: 'manual',
          measure: null,
          num_for_sale: null,
        }
    }
    const hasPurchase = typeof price === 'number' || f.date || f.locationId
    return {
      errors: e,
      input: {
        title: f.title.trim(),
        artist: f.artist.trim(),
        year,
        label: f.label.trim() || null,
        genres: f.genres
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean),
        format: f.format || null,
        note: f.note.trim() || null,
        catalog_no: f.catalogNo.trim() || null,
        country: f.country.trim() || null,
        owner_id: f.ownerId || null,
        purchase: hasPurchase
          ? {
              amount_minor: typeof price === 'number' ? price : null,
              currency: f.currency,
              date: f.date || null,
              location_id: f.locationId || null,
              channel: location?.kind === 'both' ? f.channel : null,
            }
          : null,
        value,
      },
    }
  }

  async function save(allowDuplicate: boolean) {
    const { input: body, errors: found } = build()
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    setFormError(null)
    try {
      let saved: VinylRecord
      if (record) {
        // An unchanged value keeps its source and date: only send it when it changed.
        const same =
          record.value &&
          body.value &&
          record.value.amount_minor === body.value.amount_minor &&
          record.value.currency === body.value.currency
        const { value, ...rest } = body
        const payload: Partial<RecordInput> = same ? rest : { ...rest, value }
        saved = await api(`/api/records/${record.id}`, { method: 'PATCH', body: payload, schema: RecordSchema })
      } else {
        saved = await api('/api/records', {
          method: 'POST',
          body: { ...body, allow_duplicate: allowDuplicate, discogs_release_id: picked?.release_id ?? null },
          schema: RecordSchema,
        })
        try {
          if (cover) await uploadCover(saved.id, cover)
          else if (picked?.cover_url)
            await api(`/api/discogs/records/${saved.id}/cover`, {
              method: 'POST',
              body: { url: picked.cover_url },
              schema: RecordSchema,
            })
        } catch (e) {
          toast.error(`${t.record.coverFailed} ${errorMessage(e, t.errors.generic)}`)
        }
      }
      if (record && cover) saved = await uploadCover(saved.id, cover)
      await invalidateCollection(queryClient)
      toast.success(record ? t.add.updated : t.add.saved)
      onSaved?.(saved)
      onOpenChange(false)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data?.code === 'duplicate')
        setDuplicate(e.data.existing as VinylRecord)
      else setFormError(errorMessage(e, t.errors.generic))
    } finally {
      setBusy(false)
    }
  }

  async function saveLocation(i: LocationInput, id?: string) {
    const saved = await api(id ? `/api/locations/${id}` : '/api/locations', {
      method: id ? 'PATCH' : 'POST',
      body: i,
      schema: LocationSchema,
    })
    await invalidateCollection(queryClient)
    set('locationId', saved.id)
    return saved
  }

  const searching = step === 'search' && linkedAccount
  const title = searching ? t.add.searchTitle : record ? t.record.editTitle : t.add.formTitle
  const description = searching ? t.add.searchDesc : t.add.formDesc

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={onOpenChange}
        wide
        title={title}
        description={description}
        footer={
          searching ? (
            <>
              <Button variant="outline" className="h-12 sm:h-9" onClick={() => onOpenChange(false)}>
                {t.record.cancel}
              </Button>
              <Button variant="secondary" className="h-12 sm:h-9" onClick={() => setStep('form')}>
                <PencilLineIcon /> {t.add.manual}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="h-12 sm:h-9" onClick={() => onOpenChange(false)}>
                {t.record.cancel}
              </Button>
              <Button className="h-12 sm:h-9" disabled={busy} onClick={() => void save(false)}>
                {busy ? t.record.saving : t.record.save}
              </Button>
            </>
          )
        }
      >
        {searching ? (
          <DiscogsSearchStep onPick={(r) => void pick(r)} onManual={() => setStep('form')} />
        ) : (
          <form
            noValidate
            className="pb-2"
            onSubmit={(e) => {
              e.preventDefault()
              void save(false)
            }}
          >
            <FieldGroup>
              {linkedAccount ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                  <span className="flex items-center gap-2">
                    <DiscIcon className="size-4 shrink-0" />
                    {releaseId ? (
                      <span>
                        <strong className="font-medium">{t.add.linked}</strong>
                        <span className="text-muted-foreground"> · #{releaseId}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{t.add.manualEntry}</span>
                    )}
                  </span>
                  {!record && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setStep('search')}>
                      <SearchIcon /> {releaseId ? t.add.change : t.add.searchOnDiscogs}
                    </Button>
                  )}
                </div>
              ) : (
                !record && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    <span>{t.add.connectInvite}</span>
                    <Link
                      className="text-foreground underline"
                      to={routes.settings}
                      onClick={() => onOpenChange(false)}
                    >
                      {t.add.connect}
                    </Link>
                  </div>
                )
              )}

              <FieldSet>
                <FieldLegend>{t.add.sections.disc}</FieldLegend>
                <Field data-invalid={!!errors.title}>
                  <FieldLabel htmlFor="f-title">{t.record.title}</FieldLabel>
                  <Input
                    id="f-title"
                    className={input}
                    aria-invalid={!!errors.title}
                    value={f.title}
                    onChange={(e) => set('title', e.target.value)}
                  />
                  {errors.title && <FieldError>{errors.title}</FieldError>}
                </Field>
                <Field data-invalid={!!errors.artist}>
                  <FieldLabel htmlFor="f-artist">{t.record.artist}</FieldLabel>
                  <Input
                    id="f-artist"
                    className={input}
                    aria-invalid={!!errors.artist}
                    value={f.artist}
                    onChange={(e) => set('artist', e.target.value)}
                  />
                  {errors.artist && <FieldError>{errors.artist}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel htmlFor="f-genres">{t.record.genres}</FieldLabel>
                  <Input
                    id="f-genres"
                    className={input}
                    value={f.genres}
                    onChange={(e) => set('genres', e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="f-owner">{t.record.owner}</FieldLabel>
                  <Select
                    items={[
                      { value: 'shared', label: t.record.shared },
                      ...(members.data ?? []).map((m) => ({ value: m.id, label: m.display_name })),
                    ]}
                    value={f.ownerId || 'shared'}
                    onValueChange={(v) => set('ownerId', !v || v === 'shared' ? '' : v)}
                  >
                    <SelectTrigger id="f-owner" className={trigger}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shared">{t.record.shared}</SelectItem>
                      {members.data?.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="f-cover">{t.record.cover}</FieldLabel>
                  <Input
                    id="f-cover"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="h-11 md:h-9"
                    onChange={(e) => setCover(e.target.files?.[0] ?? null)}
                  />
                  {picked?.cover_url && !cover && <FieldDescription>{t.add.coverFromDiscogs}</FieldDescription>}
                </Field>
              </FieldSet>

              <FieldSet>
                <FieldLegend>{t.version.section}</FieldLegend>
                <FieldDescription>{t.version.hint}</FieldDescription>
                <Field>
                  <FieldLabel htmlFor="f-label">{t.record.label}</FieldLabel>
                  <Input
                    id="f-label"
                    className={input}
                    value={f.label}
                    onChange={(e) => set('label', e.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="f-cat">{t.version.catalogNo}</FieldLabel>
                    <Input
                      id="f-cat"
                      className={input}
                      value={f.catalogNo}
                      onChange={(e) => set('catalogNo', e.target.value)}
                    />
                  </Field>
                  <Field data-invalid={!!errors.year}>
                    <FieldLabel htmlFor="f-year">{t.record.year}</FieldLabel>
                    <Input
                      id="f-year"
                      inputMode="numeric"
                      className={input}
                      aria-invalid={!!errors.year}
                      value={f.year}
                      onChange={(e) => set('year', e.target.value)}
                    />
                    {errors.year && <FieldError>{errors.year}</FieldError>}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="f-country">{t.version.country}</FieldLabel>
                    <Input
                      id="f-country"
                      className={input}
                      placeholder="UK, IT, US…"
                      value={f.country}
                      onChange={(e) => set('country', e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="f-format">{t.filters.format}</FieldLabel>
                    <Select
                      items={[
                        { value: 'none', label: '—' },
                        ...t.add.formats.map((x) => ({ value: x, label: x })),
                        ...(f.format && !t.add.formats.includes(f.format)
                          ? [{ value: f.format, label: f.format }]
                          : []),
                      ]}
                      value={f.format || 'none'}
                      onValueChange={(v) => set('format', !v || v === 'none' ? '' : v)}
                    >
                      <SelectTrigger id="f-format" className={trigger}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {t.add.formats.map((x) => (
                          <SelectItem key={x} value={x}>
                            {x}
                          </SelectItem>
                        ))}
                        {f.format && !t.add.formats.includes(f.format) && (
                          <SelectItem value={f.format}>{f.format}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="f-note">{t.record.note}</FieldLabel>
                  <Textarea
                    id="f-note"
                    rows={2}
                    className="text-base md:text-sm"
                    value={f.note}
                    onChange={(e) => set('note', e.target.value)}
                  />
                </Field>
              </FieldSet>

              <FieldSet>
                <FieldLegend>{t.money.purchase}</FieldLegend>
                <div className="grid grid-cols-2 gap-3">
                  <Field data-invalid={!!errors.price}>
                    <FieldLabel htmlFor="f-price">{t.money.price}</FieldLabel>
                    <Input
                      id="f-price"
                      inputMode="decimal"
                      className={input}
                      placeholder="24,90"
                      aria-invalid={!!errors.price}
                      value={f.price}
                      onChange={(e) => set('price', e.target.value)}
                    />
                    {errors.price && <FieldError>{errors.price}</FieldError>}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="f-cur">{t.money.currency}</FieldLabel>
                    <CurrencySelect id="f-cur" value={f.currency} onChange={(c) => set('currency', c)} />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="f-date">{t.money.date}</FieldLabel>
                  <Input
                    id="f-date"
                    type="date"
                    className={input}
                    value={f.date}
                    onChange={(e) => set('date', e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="f-loc">{t.money.place}</FieldLabel>
                  <LocationPicker
                    id="f-loc"
                    locations={locations.data ?? []}
                    value={f.locationId || undefined}
                    onChange={(id) => set('locationId', id ?? '')}
                    onCreate={() => setNewLocation(true)}
                  />
                </Field>
                {location?.kind === 'both' && (
                  <Field>
                    <FieldLabel htmlFor="f-channel">{t.money.channel}</FieldLabel>
                    <Select
                      items={[
                        { value: 'physical', label: t.money.channelPhysical },
                        { value: 'online', label: t.money.channelOnline },
                      ]}
                      value={f.channel}
                      onValueChange={(v) => set('channel', (v ?? 'physical') as Form['channel'])}
                    >
                      <SelectTrigger id="f-channel" className={trigger}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="physical">{t.money.channelPhysical}</SelectItem>
                        <SelectItem value="online">{t.money.channelOnline}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </FieldSet>

              <FieldSet>
                <FieldLegend>{t.money.value}</FieldLegend>
                <div className="grid grid-cols-2 gap-3">
                  <Field data-invalid={!!errors.valueAmount}>
                    <FieldLabel htmlFor="f-val">{t.money.amount}</FieldLabel>
                    <Input
                      id="f-val"
                      inputMode="decimal"
                      className={input}
                      aria-invalid={!!errors.valueAmount}
                      value={f.valueAmount}
                      onChange={(e) => set('valueAmount', e.target.value)}
                    />
                    {errors.valueAmount && <FieldError>{errors.valueAmount}</FieldError>}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="f-vcur">{t.money.currency}</FieldLabel>
                    <CurrencySelect id="f-vcur" value={f.valueCurrency} onChange={(c) => set('valueCurrency', c)} />
                  </Field>
                </div>
                <FieldDescription>
                  {valueLoading ? (
                    <span className="inline-flex items-center gap-1">
                      <LoaderCircleIcon className="size-3 animate-spin" /> {t.money.valueLoading}
                    </span>
                  ) : dgValue ? (
                    t.money.valueDiscogs(
                      dgValue.measure ? (t.money.measures[dgValue.measure] ?? dgValue.measure) : null,
                      dgValue.num_for_sale,
                    )
                  ) : (
                    t.money.valueManual
                  )}
                </FieldDescription>
              </FieldSet>

              {formError && (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}
            </FieldGroup>
          </form>
        )}
      </ResponsiveModal>

      <LocationDialog open={newLocation} onOpenChange={setNewLocation} onSave={saveLocation} />

      <AlertDialog open={!!duplicate} onOpenChange={(o) => !o && setDuplicate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.add.dupTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.record.duplicateTitle} “{duplicate?.title}” — {duplicate?.artist}
              {duplicate?.catalog_no ? ` (${duplicate.catalog_no})` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.record.duplicateCancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDuplicate(null)
                void save(true)
              }}
            >
              {t.record.duplicateAnother}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function CurrencySelect({ id, value, onChange }: { id: string; value: string; onChange: (c: string) => void }) {
  return (
    <Select
      items={CURRENCIES.map((c) => ({ value: c, label: c }))}
      value={value}
      onValueChange={(c) => onChange(c ?? 'EUR')}
    >
      <SelectTrigger id={id} className={trigger}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
