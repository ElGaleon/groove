import { useEffect, useState, type ReactNode } from 'react'
import { LayoutGridIcon, ListIcon, PlusIcon, Rows3Icon, SlidersHorizontalIcon, UsersIcon, XIcon } from 'lucide-react'
import { PAGE_SIZES, useFilters, useOptions, type Filters, type PageSize } from '@/features/collection/filters'
import { ownerColor, useMembers } from '@/shared/lib/members'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { t } from '@/i18n'
import { OwnerDot, useRecordDialog } from '@/features/records'
import { SearchField } from '@/shared/components/SearchField'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/shared/ui/drawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { cn } from '@/shared/lib/utils'

type Field = { key: keyof Filters; label: string; all: string; items: { value: string; label: ReactNode }[] }

/** The owner filter: shared records and each member, with their colour and how many records they have. */
function useOwnerField(): Field {
  const o = useOptions().data
  const members = useMembers().data ?? []
  const count = (n: number | undefined) =>
    n === undefined ? null : <span className="ml-1 text-muted-foreground tabular-nums">{n}</span>
  return {
    key: 'owner',
    label: t.filters.owner,
    all: t.filters.allOwners,
    items: [
      {
        value: 'shared',
        label: (
          <span className="flex items-center gap-2">
            <UsersIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
            {t.record.sharedLabel}
            {count(o?.shared_count)}
          </span>
        ),
      },
      ...members.map((m, i) => ({
        value: m.id,
        label: (
          <span className="flex items-center gap-2">
            <OwnerDot color={ownerColor(i)} />
            {m.display_name}
            {count(o?.owners.find((x) => x.id === m.id)?.count)}
          </span>
        ),
      })),
    ],
  }
}

function useFields(): Field[] {
  const o = useOptions().data
  const owner = useOwnerField()
  return [
    owner,
    {
      key: 'label',
      label: t.views.label,
      all: t.filters.allLabels,
      items: (o?.labels ?? []).map((l) => ({ value: l, label: l })),
    },
    {
      key: 'country',
      label: t.filters.country,
      all: t.filters.allCountries,
      items: (o?.countries ?? []).map((c) => ({ value: c, label: c })),
    },
    {
      key: 'format',
      label: t.filters.format,
      all: t.filters.allFormats,
      items: (o?.formats ?? []).map((c) => ({ value: c, label: c })),
    },
    {
      key: 'year',
      label: t.filters.year,
      all: t.filters.allYears,
      items: (o?.years ?? []).map((y) => ({ value: String(y), label: String(y) })),
    },
  ]
}

const ALL = '__all__'
function FilterSelect({ field, stacked }: { field: Field; stacked?: boolean }) {
  const { filters, update } = useFilters()
  const raw = String(filters[field.key])
  const value = raw === '' || raw === 'any' ? ALL : raw
  const items = [{ value: ALL, label: field.all }, ...field.items]
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {stacked && field.label}
      <Select
        items={items}
        value={value}
        onValueChange={(v) =>
          update({ [field.key]: !v || v === ALL ? (field.key === 'owner' ? 'any' : '') : v } as Partial<Filters>)
        }
      >
        <SelectTrigger aria-label={field.label} className={stacked ? 'h-12 w-full text-base' : 'w-40'}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

/** How many records a page (table) or a block (grid) holds: 10, 25 or 50. */
function PageSizeSelect({ stacked }: { stacked?: boolean }) {
  const { browse, update } = useFilters()
  const items = PAGE_SIZES.map((n) => ({ value: String(n), label: t.views.pageSizeOption(n) }))
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {stacked && t.views.pageSize}
      <Select
        items={items}
        value={String(browse.size)}
        onValueChange={(v) => v && update({ size: Number(v) as PageSize })}
      >
        <SelectTrigger aria-label={t.views.pageSize} className={stacked ? 'h-12 w-full text-base' : 'w-36'}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

function ViewToggle() {
  const { view, update } = useFilters()
  return (
    <ToggleGroup
      variant="outline"
      value={[view]}
      onValueChange={(v) => v[0] && update({ view: v[0] as 'shelf' | 'list' | 'grid' })}
      aria-label={t.views.views}
    >
      <ToggleGroupItem value="shelf" aria-label={t.shelf.view} className="h-11 w-11 md:h-9 md:w-9">
        <Rows3Icon />
      </ToggleGroupItem>
      <ToggleGroupItem value="grid" aria-label={t.views.grid} className="h-11 w-11 md:h-9 md:w-9">
        <LayoutGridIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label={t.views.list} className="h-11 w-11 md:h-9 md:w-9">
        <ListIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

/**
 * Search, filters and view switch. Desktop: filters inline. Phone: the search has its own row and the
 * filters open in a bottom sheet that says how many records match.
 */
export function FilterBar({
  compact = false,
  count,
  viewActions,
}: { compact?: boolean; count?: number; viewActions?: ReactNode } = {}) {
  const { filters, update, reset, active, activeCount } = useFilters()
  const fields = useFields()
  const mobile = useIsMobile()
  const { openAdd } = useRecordDialog()
  // What the member is typing; null means "show what the URL says" (reset, back button).
  const [typed, setTyped] = useState<string | null>(null)
  const text = typed ?? filters.q

  useEffect(() => {
    if (typed === null) return
    const timer = setTimeout(() => {
      update({ q: typed })
      setTyped(null)
    }, 250)
    return () => clearTimeout(timer)
  }, [typed, update])

  const search = (
    <SearchField
      className={cn('flex-1', mobile ? 'min-w-full' : 'min-w-64')}
      aria-label={t.views.search}
      placeholder={t.filters.placeholder}
      value={text}
      onChange={(e) => setTyped(e.target.value)}
    />
  )

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {!compact && search}
        {(mobile || compact) && (
          <Drawer>
            <DrawerTrigger
              render={
                <Button variant="outline" className="h-11 gap-2 bg-background px-3" aria-label={t.filters.open} />
              }
            >
              <SlidersHorizontalIcon className="size-4" /> {t.filters.title}
              {activeCount > 0 && <Badge className="size-5 justify-center rounded-full p-0">{activeCount}</Badge>}
            </DrawerTrigger>
            <DrawerContent className="max-h-[92dvh]">
              <DrawerHeader className="text-left">
                <DrawerTitle>{t.filters.title}</DrawerTitle>
                <DrawerDescription>{count != null ? t.home.count(count) : t.views.views}</DrawerDescription>
              </DrawerHeader>
              <div className="grid gap-4 overflow-y-auto px-4 pb-2">
                {compact && <div className="relative">{search}</div>}
                {fields.map((f) => (
                  <FilterSelect key={f.key} field={f} stacked />
                ))}
                {!compact && <PageSizeSelect stacked />}
              </div>
              <DrawerFooter className="grid grid-cols-2 gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button variant="outline" className="h-12" disabled={!active} onClick={reset}>
                  {t.filters.clear}
                </Button>
                <DrawerClose render={<Button className="h-12" />}>
                  {count != null ? t.filters.show(count) : t.record.save}
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        )}
        <Button className="ml-auto h-11 md:h-9" onClick={openAdd}>
          <PlusIcon /> {t.home.addShort}
        </Button>
        <div className={cn('flex items-center gap-2', viewActions && 'max-md:ml-auto')}>
          {viewActions}
          <ViewToggle />
        </div>
      </div>
      {!mobile && !compact && (
        <div className="flex flex-wrap items-center gap-2">
          {fields.map((f) => (
            <FilterSelect key={f.key} field={f} />
          ))}
          {active && (
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              <XIcon /> {t.views.reset}
            </Button>
          )}
          <div className="ml-auto">
            <PageSizeSelect />
          </div>
        </div>
      )}
    </div>
  )
}
