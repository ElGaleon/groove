import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '@/shared/lib/api'
import { checkForm, type FormErrors } from '@/shared/lib/form'
import { setupForm } from '@/features/auth/schemas'
import { useAuth } from '@/features/auth/auth-context'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { Field } from '@/shared/components/Field'
import { Notice } from '@/shared/components/Notice'
import { PasswordField } from '@/shared/components/PasswordField'
import { SubmitButton } from '@/shared/components/SubmitButton'
import { t } from '@/i18n'
import { routes } from '@/shared/lib/routes'

/** First-time setup: the first person creates the household. */
export function Register() {
  const { user, register, needsSetup, loading, minPasswordLength } = useAuth()
  const navigate = useNavigate()
  const [householdName, setHouseholdName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />
  if (loading) return <main className="p-6 text-muted-foreground">{t.loading}</main>
  if (!needsSetup) {
    return (
      <AuthLayout>
        <p>{t.register.setupDone}</p>
        <p>
          <Link className="font-medium text-foreground underline underline-offset-4" to={routes.signIn}>
            {t.register.alreadyHave}
          </Link>
        </p>
      </AuthLayout>
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const checked = checkForm(setupForm(minPasswordLength), {
      household_name: householdName,
      display_name: displayName,
      email,
      password,
    })
    setErrors(checked.errors ?? {})
    if (checked.errors) return
    setBusy(true)
    try {
      await register({
        email: checked.data.email,
        password: checked.data.password,
        display_name: checked.data.display_name,
        household_name: checked.data.household_name,
      })
      navigate('/')
    } catch (e) {
      setError(errorMessage(e, t.errors.generic))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t.register.setupTitle} subtitle={t.register.setupSubtitle}>
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <Field
          label={t.register.householdName}
          required
          error={errors.household_name}
          value={householdName}
          onChange={(e) => setHouseholdName(e.target.value)}
        />
        <Field
          label={t.register.displayName}
          required
          error={errors.display_name}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Field
          label={t.register.email}
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
          label={t.register.password}
          autoComplete="new-password"
          required
          error={errors.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <Notice kind="error">{error}</Notice>}
        <SubmitButton busy={busy}>{t.register.submit}</SubmitButton>
      </form>
      <p className="text-sm text-muted-foreground">
        <Link className="font-medium text-foreground underline underline-offset-4" to={routes.signIn}>
          {t.register.alreadyHave}
        </Link>
      </p>
    </AuthLayout>
  )
}
