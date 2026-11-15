import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth'
import { t } from '@/i18n'
import { routes } from '@/shared/lib/routes'

export function RequireAuth() {
  const { user, loading, needsSetup } = useAuth()
  if (loading) return <main className="p-6 text-muted-foreground">{t.loading}</main>
  if (!user) return <Navigate to={needsSetup ? routes.register : routes.signIn} replace />
  return <Outlet />
}
