import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '@/shared/lib/api'
import { checkForm, type FormErrors } from '@/shared/lib/form'
import { InviteCheckSchema } from '@/shared/schemas'
import { joinForm } from '@/features/auth/schemas'
import { useAuth } from '@/features/auth/auth-context'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { Field } from '@/shared/components/Field'
import { Notice } from '@/shared/components/Notice'
import { PasswordField } from '@/shared/components/PasswordField'
import { SubmitButton } from '@/shared/components/SubmitButton'
import { t } from '@/i18n'
import { routes } from '@/shared/lib/routes'

export function Join() {
  const { token = '' } = useParams()
  const { user, register, minPasswordLength } = useAuth()
  const navigate = useNavigate()
  const check = useQuery({
    queryKey: ['invite-check', token],
    queryFn: () =>
      api(`/api/invites/check?token=${encodeURIComponent(token)}`, { schema: InviteCheckSchema }),
  })
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />
  if (check.isLoading) return <AuthLayout><p className="text-muted-foreground">{t.invite.checking}</p></AuthLayout>

  const status = check.data?.status ?? 'invalid'
  if (status !== 'valid') {
    const message = (t.invite as Record<string, unknown>)[status] as string
    return (
      <AuthLayout>
        <Notice kind="error">{message ?? t.invite.invalid}</Notice>
        <p><Link className="font-medium text-foreground underline underline-offset-4" to={routes.signIn}>{t.register.alreadyHave}</Link></p>
      </AuthLayout>
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const checked = checkForm(joinForm(minPasswordLength), { display_name: displayName, email, password })
    setErrors(checked.errors ?? {})
    if (checked.errors) return
    setBusy(true)
    try {
      await register({ email: checked.data.email, password: checked.data.password, display_name: checked.data.display_name, invite_token: token })
      navigate('/')
    } catch (e) {
      setError(errorMessage(e, t.errors.generic))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t.register.joinTitle} subtitle={t.invite.welcome(check.data?.household_name ?? '')}>
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <Field label={t.register.displayName} required error={errors.display_name} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <Field label={t.register.email} type="email" autoComplete="email" autoCapitalize="off" autoCorrect="off" spellCheck={false} inputMode="email" enterKeyHint="next" required error={errors.email} value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField label={t.register.password} autoComplete="new-password" required error={errors.password} value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <Notice kind="error">{error}</Notice>}
        <SubmitButton busy={busy}>{t.register.submit}</SubmitButton>
      </form>
    </AuthLayout>
  )
}
