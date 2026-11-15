import { Navigate, useLocation, useParams } from 'react-router-dom'

/** Sends a former Italian address to its English one, keeping the path parameters and the query. */
export function LegacyRedirect({ to }: { to: string }) {
  const params = useParams()
  const { search, hash } = useLocation()
  const path = to.replace(/:(\w+)/g, (_, name: string) => encodeURIComponent(params[name] ?? ''))
  return <Navigate to={`${path}${search}${hash}`} replace />
}
