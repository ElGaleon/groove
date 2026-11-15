import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { api, errorMessage } from '@/shared/lib/api'
import { ConnectSchema } from '@/shared/schemas'
import { BackupSection } from '@/features/settings/components/BackupSection'
import { Notice } from '@/shared/components/Notice'
import { ResponsiveModal } from '@/shared/components/ResponsiveModal'
import { useDiscogsStatus } from '@/features/discogs'
import { CURRENCIES, useCurrency } from '@/features/settings/currency'
import { useLanguageSetting } from '@/features/auth'
import { isLanguage, LANGUAGES, t } from '@/i18n'
import { languageName } from '@/shared/components/LanguageSelect'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button, buttonVariants } from '@/shared/ui/button'
import { FieldGroup, FieldLegend, FieldSet } from '@/shared/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { cn } from '@/shared/lib/utils'
import { routes } from '@/shared/lib/routes'

/** The settings dialog; the router shows it on top of the collection. */
export function Settings() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const clean = new URLSearchParams(search)
  clean.delete('discogs')
  return (
    <SettingsDialog onClose={() => navigate({ pathname: '/', search: clean.size ? `?${clean}` : '' })} />
  )
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const status = useDiscogsStatus()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currency, setCurrency] = useCurrency()
  const [language, setLanguage] = useLanguageSetting()
  const result = params.get('discogs')

  const connect = useMutation({
    mutationFn: () => api('/api/discogs/connect', { method: 'POST', schema: ConnectSchema }),
    onSuccess: (data) => window.location.assign(data.authorize_url),
    onError: (e) => setError(errorMessage(e, t.errors.generic)),
  })
  const disconnect = useMutation({
    mutationFn: () => api('/api/discogs/connection', { method: 'DELETE', schema: z.void() }),
    onSuccess: () => {
      setConfirming(false)
      void queryClient.invalidateQueries({ queryKey: ['discogs-status'] })
    },
    onError: (e) => setError(errorMessage(e, t.errors.generic)),
  })

  const s = status.data
  return (
    <>
      <ResponsiveModal
        open
        onOpenChange={(o) => !o && onClose()}
        title={t.nav.settings}
        description={t.prefs.description}
        footer={<Button className="h-12 sm:h-9" onClick={onClose}>{t.prefs.close}</Button>}
      >
        <FieldGroup className="pb-2">
          <FieldSet>
            <FieldLegend>{t.discogs.title}</FieldLegend>
            <p className="text-sm text-muted-foreground">{t.discogs.intro}</p>
            {result && t.discogs.result[result] && <Notice kind={result === 'connected' ? 'ok' : 'error'}>{t.discogs.result[result]}</Notice>}
            {error && <Notice kind="error">{error}</Notice>}
            {status.isLoading && <Skeleton className="h-9 w-48" />}
            {s && !s.configured && <p className="text-sm text-muted-foreground">{t.discogs.notConfigured}</p>}
            {s && s.configured && !s.connected && (
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline">{t.discogs.notConnected}</Badge>
                <Button className="h-11 md:h-9" disabled={connect.isPending} onClick={() => connect.mutate()}>{t.discogs.connect}</Button>
              </div>
            )}
            {s && s.connected && s.status === 'expired' && (
              <div className="grid gap-3">
                <Notice kind="error">{t.discogs.expired}</Notice>
                <div className="flex gap-2">
                  <Button className="h-11 md:h-9" disabled={connect.isPending} onClick={() => connect.mutate()}>{t.discogs.reconnect}</Button>
                  <Button variant="outline" className="h-11 md:h-9" onClick={() => setConfirming(true)}>{t.discogs.disconnect}</Button>
                </div>
              </div>
            )}
            {s && s.connected && s.status === 'active' && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="grid gap-1">
                  <span className="flex items-center gap-2 text-sm font-medium">{t.prefs.connected} <Badge variant="secondary">{s.username}</Badge></span>
                  <Link className={cn(buttonVariants({ variant: 'link' }), 'h-auto justify-start p-0')} to={routes.import}>{t.discogs.importLink}</Link>
                </div>
                <Button variant="outline" className="h-11 md:h-9" onClick={() => setConfirming(true)}>{t.discogs.disconnect}</Button>
              </div>
            )}
          </FieldSet>

          <FieldSet>
            <FieldLegend>{t.prefs.languageTitle}</FieldLegend>
            <p className="text-sm text-muted-foreground">{t.prefs.languageText}</p>
            <Select
              items={LANGUAGES.map((l) => ({ value: l, label: languageName(l) }))}
              value={language}
              onValueChange={(l) => {
                if (!isLanguage(l)) return
                void setLanguage(l).then(() => toast.success(t.prefs.languageSaved)).catch((e) => setError(errorMessage(e, t.errors.generic)))
              }}
            >
              <SelectTrigger aria-label={t.prefs.languageLabel} className="h-11 w-full text-base md:h-9 md:text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l} value={l}>{languageName(l)}</SelectItem>)}</SelectContent>
            </Select>
          </FieldSet>

          <FieldSet>
            <FieldLegend>{t.prefs.currencyTitle}</FieldLegend>
            <Select
              items={CURRENCIES.map((c) => ({ value: c, label: c }))}
              value={currency}
              onValueChange={(c) => {
                if (!c) return
                void setCurrency(c).then(() => toast.success(t.prefs.currencySaved)).catch((e) => setError(errorMessage(e, t.errors.generic)))
              }}
            >
              <SelectTrigger aria-label={t.prefs.currencyLabel} className="h-11 w-full text-base md:h-9 md:text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </FieldSet>

          <BackupSection />
        </FieldGroup>
      </ResponsiveModal>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.discogs.disconnect}</AlertDialogTitle>
            <AlertDialogDescription>{t.discogs.disconnectAsk}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.record.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>{t.discogs.disconnectConfirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
