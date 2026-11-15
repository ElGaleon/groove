import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '@/shared/lib/api'
import { checkForm, type FormErrors } from '@/shared/lib/form'
import { PasswordResetCheckSchema } from '@/shared/schemas'
import { resetForm } from '@/features/auth/schemas'
import { useAuth } from '@/features/auth/auth-context'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { Notice } from '@/shared/components/Notice'
import { PasswordField } from '@/shared/components/PasswordField'
import { SubmitButton } from '@/shared/components/SubmitButton'
import { t } from '@/i18n'
import { routes } from '@/shared/lib/routes'

/** Opened from the one-time link a family member generated for someone who forgot the password. */
export function ResetPassword() {
  const { token = '' } = useParams()
  const { user, resetPassword, minPasswordLength } = useAuth()
  const navigate = useNavigate()
  const check = useQuery({
    queryKey: ['password-reset-check', token],
    queryFn: () =>
      api(`/api/auth/password-reset/check?token=${encodeURIComponent(token)}`, { schema: PasswordResetCheckSchema }),
  })
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />
  if (check.isLoading) return <AuthLayout><p className="text-muted-foreground">{t.resetPassword.checking}</p></AuthLayout>

  const status = check.data?.status ?? 'invalid'
  if (status !== 'valid') {
    const message = (t.resetPassword as Record<string, unknown>)[status] as string | undefined
    return (
      <AuthLayout>
        <Notice kind="error">{message ?? t.resetPassword.invalid}</Notice>
        <p><Link className="font-medium text-foreground underline underline-offset-4" to={routes.signIn}>{t.resetPassword.toSignIn}</Link></p>
      </AuthLayout>
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const checked = checkForm(resetForm(minPasswordLength), { new_password: password })
    setErrors(checked.errors ?? {})
    if (checked.errors) return
    setBusy(true)
    try {
      await resetPassword(token, checked.data.new_password)
      navigate('/')
    } catch (e) {
      setError(errorMessage(e, t.errors.generic))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t.resetPassword.title} subtitle={t.resetPassword.subtitle(check.data?.display_name ?? '')}>
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <PasswordField label={t.resetPassword.password} autoComplete="new-password" required error={errors.new_password} value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <Notice kind="error">{error}</Notice>}
        <SubmitButton busy={busy}>{t.resetPassword.submit}</SubmitButton>
      </form>
    </AuthLayout>
  )
}
