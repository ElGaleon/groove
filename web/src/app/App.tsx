import { lazy, Suspense, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/features/auth'
import { LanguageProvider } from './LanguageProvider'
import { Layout } from './Layout'
import { LegacyRedirect } from './LegacyRedirect'
import { legacyRedirects, patterns, routes } from '@/shared/lib/routes'
import { RequireAuth } from './RequireAuth'
import { Home } from '@/features/collection'
import { Join } from '@/features/auth'
import { RecordDetail } from '@/features/records'
import { Register } from '@/features/auth'
import { ResetPassword } from '@/features/auth'
import { SignIn } from '@/features/auth'
import { VinylSpinner } from '@/shared/components/VinylSpinner'

// Pages a member opens now and then load on demand, so the collection appears sooner.
const AddRecord = lazy(() => import('@/features/records').then((m) => ({ default: m.AddRecord })))
const Settings = lazy(() => import('@/features/settings').then((m) => ({ default: m.Settings })))
const Import = lazy(() => import('@/features/discogs').then((m) => ({ default: m.Import })))
const Family = lazy(() => import('@/features/family').then((m) => ({ default: m.Family })))
const Purchases = lazy(() => import('@/features/places').then((m) => ({ default: m.Purchases })))

function PageLoading() {
  return <div className="flex justify-center py-16"><VinylSpinner className="size-6" /></div>
}

/** Dialog routes keep the collection visible behind them. */
function OnCollection({ children }: { children: ReactNode }) {
  return (
    <>
      <Home />
      {/* The dialog may still be loading: the collection stays visible meanwhile. */}
      <Suspense fallback={null}>{children}</Suspense>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Suspense fallback={<PageLoading />}>
        <Routes>
          {legacyRedirects.map((r) => (
            <Route key={r.from} path={r.from} element={<LegacyRedirect to={r.to} />} />
          ))}
          <Route path={routes.signIn} element={<SignIn />} />
          <Route path={routes.register} element={<Register />} />
          <Route path={patterns.invite} element={<Join />} />
          <Route path={patterns.resetPassword} element={<ResetPassword />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path={routes.newRecord} element={<AddRecord />} />
              <Route path={patterns.record} element={<OnCollection><RecordDetail /></OnCollection>} />
              <Route path={routes.map} element={<Purchases />} />
              <Route path={routes.family} element={<Family />} />
              <Route path={routes.settings} element={<OnCollection><Settings /></OnCollection>} />
              <Route path={routes.import} element={<Import />} />
            </Route>
          </Route>
        </Routes>
        </Suspense>
      </LanguageProvider>
    </AuthProvider>
  )
}
