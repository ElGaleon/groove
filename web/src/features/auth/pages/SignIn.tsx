import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '@/shared/lib/api'
import { checkForm, type FormErrors } from '@/shared/lib/form'
import { signInForm } from '@/features/auth/schemas'
import { useAuth } from '@/features/auth/auth-context'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { Field } from '@/shared/components/Field'
import { Notice } from '@/shared/components/Notice'
import { PasswordField } from '@/shared/components/PasswordField'
import { SubmitButton } from '@/shared/components/SubmitButton'
import { t } from '@/i18n'
import { routes } from '@/shared/lib/routes'

export function SignIn() {
  const { user, signIn, needsSetup } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const checked = checkForm(signInForm, { email, password })
    setErrors(checked.errors ?? {})
    if (checked.errors) return
    setBusy(true)
    try {
      await signIn(checked.data.email, checked.data.password)
      navigate('/')
    } catch (e) {
      setError(errorMessage(e, t.errors.generic))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t.signIn.title} subtitle={t.signIn.subtitle}>
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <Field
          label={t.signIn.email}
          type="email"
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="email"
          enterKeyHint="next"
          required
          error={errors.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label={t.signIn.password}
          autoComplete="current-password"
          required
          error={errors.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="-mt-1 text-sm text-muted-foreground">{t.auth.forgot}</p>
        {error && <Notice kind="error">{error}</Notice>}
        <SubmitButton busy={busy}>{t.signIn.submit}</SubmitButton>
      </form>
      <p className="text-sm text-muted-foreground">
        {needsSetup ? (
          <Link className="font-medium text-foreground underline underline-offset-4" to={routes.register}>
            {t.signIn.firstTime}
          </Link>
        ) : (
          t.signIn.needInvite
        )}
      </p>
    </AuthLayout>
  )
}
