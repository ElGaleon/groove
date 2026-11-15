import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronFirstIcon, ChevronLastIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useFilters, useRecordPage, useRecordPages } from '@/features/collection/filters'
import { formatMoney } from '@/shared/lib/money'
import { isIncompleteVersion, versionSummary, type VinylRecord } from '@/features/records'
import { t } from '@/i18n'
import { Cover, OwnerBadge } from '@/features/records'
import { DeltaText } from '@/features/records'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from '@/shared/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { routes } from '@/shared/lib/routes'
import { cn } from '@/shared/lib/utils'
import { useIsMobile } from '@/shared/hooks/use-mobile'

/** The records for the current filters: a grid that loads as you scroll, or a paginated table. */
export function RecordViews({ forceView }: { forceView?: 'list' | 'grid' } = {}) {
  const { view: urlView } = useFilters()
  const view = forceView ?? (urlView === 'grid' ? 'grid' : 'list')
  return view === 'grid' ? <GridBrowser /> : <TableBrowser />
}

function Loading() {
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground" role="status">
        {t.loading}
      </p>
      <Skeleton className="h-40 w-full" />
    </>
  )
}

function Empty() {
  const { reset, active } = useFilters()
  return (
    <div className="rounded-xl border border-dashed p-10 text-center text-base text-muted-foreground">
      {active ? t.views.noMatches : t.home.empty}
      {active && (
        <button type="button" className="mt-2 block w-full font-medium text-foreground underline" onClick={reset}>
          {t.views.reset}
        </button>
      )}
    </div>
  )
}

// --- grid: infinite scroll ----------------------------------------------------------------------

function GridBrowser() {
  const { filters, browse } = useFilters()
  const pages = useRecordPages(filters, browse.size)
  const items = pages.data?.pages.flatMap((p) => p.items) ?? []
  const gridRef = useRef<HTMLUListElement>(null)
  // After "Show more" from the keyboard, focus moves to the first new record (the button may vanish).
  const [focusFrom, setFocusFrom] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (focusFrom === null || items.length <= focusFrom) return
    gridRef.current?.querySelectorAll<HTMLElement>('[data-card]')[focusFrom]?.focus()
    setFocusFrom(null)
  }, [focusFrom, items.length])

  if (!pages.data) return <Loading />
  if (items.length === 0) return <Empty />
  return (
    <>
      <GridView items={items} listRef={gridRef} />
      <LoadMore
        hasMore={pages.hasNextPage}
        loading={pages.isFetchingNextPage}
        onMore={(fromKeyboard) => {
          if (fromKeyboard) setFocusFrom(items.length)
          void pages.fetchNextPage()
        }}
      />
    </>
  )
}

function LoadMore({
  hasMore,
  loading,
  onMore,
}: {
  hasMore: boolean
  loading: boolean
  onMore: (fromKeyboard: boolean) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!hasMore || loading || !ref.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onMore(false)
      },
      { rootMargin: '400px' },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [hasMore, loading, onMore])
  if (!hasMore) return <p className="my-6 text-center text-sm text-muted-foreground">{t.views.end}</p>
  return (
    <div ref={ref} className="my-4 flex justify-center">
      {/* aria-disabled, not disabled: a disabled button would drop the keyboard focus. */}
      <Button
        type="button"
        variant="outline"
        aria-disabled={loading}
        onClick={(e) => !loading && onMore(e.detail === 0)}
      >
        {loading ? t.loading : t.views.loadMore}
      </Button>
    </div>
  )
}

/** Opens the detail of a record on top of the collection, keeping the filters in the address. */
export function useOpenRecord() {
  const navigate = useNavigate()
  const { search } = useLocation()
  return (id: string) => navigate({ pathname: routes.record(id), search })
}

/** Cover (with the owner on it), title, artist and value: the version lives in the table and the detail. */
function GridView({ items, listRef }: { items: VinylRecord[]; listRef?: React.Ref<HTMLUListElement> }) {
  const open = useOpenRecord()
  return (
    <ul
      ref={listRef}
      className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5"
    >
      {items.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            data-card
            onClick={() => open(r.id)}
            className="group block w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="relative block transition-transform group-hover:-translate-y-1 group-active:scale-[.98]">
              <Cover
                record={r}
                className="aspect-square w-full rounded-xl object-cover shadow-md ring-1 ring-black/5"
              />
              <OwnerBadge ownerId={r.owner_id} overlay className="absolute bottom-2 left-2" />
            </span>
            <span className="mt-2 block text-base leading-tight font-medium">{r.title}</span>
            <span className="block truncate text-sm text-muted-foreground">{r.artist}</span>
            {r.value && (
              <span className="mt-1 block text-sm font-medium">
                {formatMoney(r.value.amount_minor, r.value.currency)}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}

// --- table: pages --------------------------------------------------------------------------------

function TableBrowser() {
  const { filters, browse, update } = useFilters()
  const { page, size } = browse
  const query = useRecordPage(filters, page, size)
  const data = query.data
  const lastPage = data ? Math.max(1, Math.ceil(data.total / size)) : 1
  const topRef = useRef<HTMLDivElement>(null)

  // A page past the end (old link, last record of the page removed) becomes the last real page.
  useEffect(() => {
    if (data && !query.isPlaceholderData && page > lastPage) update({ page: lastPage })
  }, [data, query.isPlaceholderData, page, lastPage, update])

  if (!data) return <Loading />
  if (data.total === 0) return <Empty />
  const go = (to: number) => {
    update({ page: to })
    topRef.current?.scrollIntoView?.({ block: 'nearest' })
  }
  const from = data.items.length ? data.offset + 1 : 0
  const to = data.offset + data.items.length
  return (
    <div ref={topRef} className="grid gap-3">
      <div
        aria-busy={query.isPlaceholderData}
        className={cn('transition-opacity', query.isPlaceholderData && 'opacity-60')}
      >
        <RecordTable items={data.items} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground tabular-nums" role="status">
          {query.isPlaceholderData ? t.loading : t.views.range(from, to, data.total)}
        </p>
        {lastPage > 1 && <PageControls page={Math.min(page, lastPage)} lastPage={lastPage} onPage={go} />}
      </div>
    </div>
  )
}

/** First, last, the current page and its neighbours; gaps become an ellipsis. */
export function pageNumbers(page: number, last: number): (number | 'gap')[] {
  const wanted = [...new Set([1, page - 1, page, page + 1, last])]
    .filter((n) => n >= 1 && n <= last)
    .sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  wanted.forEach((n, i) => {
    if (i > 0 && n - wanted[i - 1] > 1) out.push('gap')
    out.push(n)
  })
  return out
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
  current,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  current?: boolean
}) {
  return (
    <Button
      type="button"
      variant={current ? 'outline' : 'ghost'}
      size="icon"
      className="size-10 md:size-8"
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function PageControls({ page, lastPage, onPage }: { page: number; lastPage: number; onPage: (n: number) => void }) {
  const atStart = page <= 1
  const atEnd = page >= lastPage
  return (
    <Pagination aria-label={t.views.pages} className="mx-0 w-auto">
      <PaginationContent className="flex-wrap">
        <PaginationItem>
          <PageButton label={t.views.first} disabled={atStart} onClick={() => onPage(1)}>
            <ChevronFirstIcon />
          </PageButton>
        </PaginationItem>
        <PaginationItem>
          <PageButton label={t.views.previous} disabled={atStart} onClick={() => onPage(page - 1)}>
            <ChevronLeftIcon />
          </PageButton>
        </PaginationItem>
        {pageNumbers(page, lastPage).map((n, i) => (
          <PaginationItem
            key={n === 'gap' ? `gap-${i}` : n}
            className={cn(n !== page && n !== 'gap' && 'max-sm:hidden')}
          >
            {n === 'gap' ? (
              <PaginationEllipsis className="max-sm:hidden">
                <span className="sr-only">{t.views.morePages}</span>
              </PaginationEllipsis>
            ) : (
              <PageButton label={t.views.page(n)} current={n === page} onClick={() => onPage(n)}>
                <span className="tabular-nums">{n}</span>
              </PageButton>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PageButton label={t.views.next} disabled={atEnd} onClick={() => onPage(page + 1)}>
            <ChevronRightIcon />
          </PageButton>
        </PaginationItem>
        <PaginationItem>
          <PageButton label={t.views.last} disabled={atEnd} onClick={() => onPage(lastPage)}>
            <ChevronLastIcon />
          </PageButton>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

function Money({ amount, currency }: { amount: number | null | undefined; currency: string | undefined }) {
  return amount != null && currency ? (
    <>{formatMoney(amount, currency)}</>
  ) : (
    <span className="text-muted-foreground">—</span>
  )
}

/**
 * One row per record. On phones the version, owner and amounts sit under the title instead of in
 * their own columns, so the page never scrolls sideways; the title is the button that opens the record.
 * The layout is picked in script (not just CSS) so each value is in the page once.
 */
function RecordTable({ items }: { items: VinylRecord[] }) {
  const open = useOpenRecord()
  const wide = !useIsMobile()
  const c = t.views.columns
  return (
    <div className="rounded-xl border bg-card">
      <Table className={wide ? undefined : 'table-fixed'}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={wide ? 'w-16' : 'w-20'}>
              <span className="sr-only">{c.cover}</span>
            </TableHead>
            <TableHead>{c.title}</TableHead>
            {wide && (
              <>
                <TableHead>{c.version}</TableHead>
                <TableHead>{c.owner}</TableHead>
                <TableHead className="text-right">{c.paid}</TableHead>
                <TableHead className="text-right">{c.value}</TableHead>
                <TableHead className="text-right">{c.difference}</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((r) => (
            <TableRow key={r.id} className="cursor-pointer" onClick={() => open(r.id)}>
              <TableCell className="py-3">
                <Cover
                  record={r}
                  className={cn('rounded-lg object-cover shadow-sm ring-1 ring-black/5', wide ? 'size-12' : 'size-16')}
                />
              </TableCell>
              <TableCell className="py-3 whitespace-normal">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    open(r.id)
                  }}
                  className={cn(
                    'block text-left leading-tight font-medium outline-none hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring',
                    wide ? 'text-sm' : 'text-base',
                  )}
                >
                  {r.title}
                </button>
                <span className="block text-sm text-muted-foreground">{r.artist}</span>
                {!wide && (
                  <>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      {versionSummary(r) || null}
                      {isIncompleteVersion(r) && <Badge variant="outline">{t.version.incompleteShort}</Badge>}
                      <OwnerBadge ownerId={r.owner_id} />
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
                      {r.purchase?.amount_minor != null && (
                        <span className="text-muted-foreground">
                          {t.money.paid} {formatMoney(r.purchase.amount_minor, r.purchase.currency)}
                        </span>
                      )}
                      {r.value && (
                        <span className="font-medium">
                          {t.money.worth} {formatMoney(r.value.amount_minor, r.value.currency)}
                        </span>
                      )}
                      {r.purchase?.amount_minor != null && r.value && <DeltaText record={r} />}
                    </span>
                  </>
                )}
              </TableCell>
              {wide && (
                <>
                  <TableCell className="whitespace-normal text-muted-foreground">
                    {versionSummary(r) || null}
                    {isIncompleteVersion(r) && (
                      <Badge variant="outline" className="ml-1">
                        {t.version.incompleteShort}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <OwnerBadge ownerId={r.owner_id} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Money amount={r.purchase?.amount_minor} currency={r.purchase?.currency} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    <Money amount={r.value?.amount_minor} currency={r.value?.currency} />
                  </TableCell>
                  <TableCell className="text-right">
                    {r.purchase?.amount_minor != null && r.value ? (
                      <DeltaText record={r} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
