import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { api, errorMessage } from '@/shared/lib/api'
import { checkForm, type FormErrors } from '@/shared/lib/form'
import { HouseholdSchema, InviteCreatedSchema, InviteListSchema, PasswordResetCreatedSchema, type Member } from '@/shared/schemas'
import { changePasswordForm } from '@/features/family/schemas'
import { useAuth } from '@/features/auth'
import { PasswordField } from '@/shared/components/PasswordField'
import { Notice } from '@/shared/components/Notice'
import { Page, Section } from '@/shared/components/Page'
import { t } from '@/i18n'
import { formatDate } from '@/i18n/format'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { routes } from '@/shared/lib/routes'

export function Family() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const household = useQuery({ queryKey: ['household'], queryFn: () => api('/api/household', { schema: HouseholdSchema }) })
  const invites = useQuery({ queryKey: ['invites'], queryFn: () => api('/api/invites', { schema: InviteListSchema }) })
  const [newLink, setNewLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [resetLink, setResetLink] = useState<{ name: string; url: string } | null>(null)
  const [resetCopied, setResetCopied] = useState(false)

  const createInvite = useMutation({
    mutationFn: () => api('/api/invites', { method: 'POST', schema: InviteCreatedSchema }),
    onSuccess: (data) => {
      setCopied(false)
      setNewLink(`${window.location.origin}${routes.invite(data.token)}`)
      queryClient.invalidateQueries({ queryKey: ['invites'] })
    },
  })
  const createReset = useMutation({
    mutationFn: (member: Member) =>
      api(`/api/household/members/${member.id}/password-reset`, { method: 'POST', schema: PasswordResetCreatedSchema }).then((r) => ({ member, token: r.token })),
    onSuccess: ({ member, token }) => {
      setResetCopied(false)
      setResetLink({ name: member.display_name, url: `${window.location.origin}${routes.resetPassword(token)}` })
    },
  })
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/api/invites/${id}`, { method: 'DELETE', schema: z.void() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invites'] }),
  })

  const members = household.data?.members ?? []
  const lastMember = members.length === 1

  return (
    <Page className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t.family.title}: {household.data?.name}</h1>

      <Section title={t.family.members}>
        <ul className="grid gap-2">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
              <strong>{m.display_name}</strong>
              <span className="text-muted-foreground">{m.email}</span>
              {m.id === user?.id && <Badge variant="secondary">{t.family.you}</Badge>}
              {m.id !== user?.id && (
                <Button type="button" variant="link" size="sm" className="ml-auto" onClick={() => createReset.mutate(m)}>{t.family.resetPassword}</Button>
              )}
            </li>
          ))}
        </ul>
        {createReset.isError && <Notice kind="error">{errorMessage(createReset.error, t.errors.generic)}</Notice>}
        {resetLink && (
          <div className="grid gap-2 rounded-lg border bg-muted/40 p-3">
            <p className="text-sm">{t.family.resetCreated(resetLink.name)}</p>
            <div className="flex gap-2">
              <Input readOnly value={resetLink.url} aria-label={t.family.resetLinkLabel} onFocus={(e) => e.currentTarget.select()} />
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard?.writeText(resetLink.url).catch(() => undefined)
                  setResetCopied(true)
                }}
              >
                {resetCopied ? t.family.copied : t.family.copy}
              </Button>
            </div>
          </div>
        )}
      </Section>

      <Section title={t.family.invites}>
        <div><Button type="button" onClick={() => createInvite.mutate()}>{t.family.createInvite}</Button></div>
        {newLink && (
          <div className="grid gap-2 rounded-lg border bg-muted/40 p-3">
            <p className="text-sm">{t.family.inviteCreated}</p>
            <div className="flex gap-2">
              <Input readOnly value={newLink} aria-label={t.family.inviteLinkLabel} onFocus={(e) => e.currentTarget.select()} />
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard?.writeText(newLink).catch(() => undefined)
                  setCopied(true)
                }}
              >
                {copied ? t.family.copied : t.family.copy}
              </Button>
            </div>
          </div>
        )}
        {(invites.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.family.noInvites}</p>
        ) : (
          <ul className="grid gap-2">
            {invites.data?.map((i) => (
              <li key={i.id} className="flex items-center gap-3 text-sm">
                <span>{formatDate(i.created_at, { dateStyle: 'medium' })}</span>
                <Badge variant={i.status === 'valid' ? 'default' : 'outline'}>{t.family.status[i.status] ?? i.status}</Badge>
                {i.status === 'valid' && (
                  <Button type="button" variant="link" size="sm" onClick={() => revoke.mutate(i.id)}>{t.family.revoke}</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <ChangePassword />
      <Leave lastMember={lastMember} />
    </Page>
  )
}

function ChangePassword() {
  const { minPasswordLength } = useAuth()
  const [errors, setErrors] = useState<FormErrors>({})
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    const checked = checkForm(changePasswordForm(minPasswordLength), { current_password: current, new_password: next })
    setErrors(checked.errors ?? {})
    if (checked.errors) return
    try {
      await api('/api/auth/password', { method: 'POST', body: checked.data, schema: z.void() })
      setCurrent('')
      setNext('')
      setMessage({ ok: true, text: t.family.passwordChanged })
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e, t.errors.generic) })
    }
  }

  return (
    <Section title={t.family.password}>
      <form onSubmit={onSubmit} noValidate className="grid max-w-sm gap-4">
        <PasswordField label={t.family.currentPassword} autoComplete="current-password" required error={errors.current_password} value={current} onChange={(e) => setCurrent(e.target.value)} />
        <PasswordField label={t.family.newPassword} autoComplete="new-password" required error={errors.new_password} value={next} onChange={(e) => setNext(e.target.value)} />
        {message && <Notice kind={message.ok ? 'ok' : 'error'}>{message.text}</Notice>}
        <div><Button type="submit">{t.family.changePassword}</Button></div>
      </form>
    </Section>
  )
}

function Leave({ lastMember }: { lastMember: boolean }) {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function leave() {
    try {
      await api('/api/household/leave', { method: 'POST', body: { confirm_delete_collection: lastMember }, schema: z.void() })
      queryClient.clear()
      await refresh()
      navigate(routes.signIn)
    } catch (e) {
      setError(errorMessage(e, t.errors.generic))
    }
  }

  return (
    <Section>
      <div><Button type="button" variant="destructive" onClick={() => setAsking(true)}>{t.family.leave}</Button></div>
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.family.leave}</AlertDialogTitle>
            <AlertDialogDescription>{lastMember ? t.family.leaveLastText : t.family.leaveText}</AlertDialogDescription>
          </AlertDialogHeader>
          {error && <Notice kind="error">{error}</Notice>}
          <AlertDialogFooter>
            <AlertDialogCancel>{t.family.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={leave}>{t.family.leaveConfirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  )
}
