import type { ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/features/auth'
import { LanguageProvider } from './LanguageProvider'
import { Layout } from './Layout'
import { LegacyRedirect } from './LegacyRedirect'
import { legacyRedirects, patterns, routes } from '@/shared/lib/routes'
import { RequireAuth } from './RequireAuth'
import { AddRecord } from '@/features/records'
import { Import } from '@/features/discogs'
import { Settings } from '@/features/settings'
import { Family } from '@/features/family'
import { Home } from '@/features/collection'
import { Join } from '@/features/auth'
import { Purchases } from '@/features/places'
import { RecordDetail } from '@/features/records'
import { Register } from '@/features/auth'
import { ResetPassword } from '@/features/auth'
import { SignIn } from '@/features/auth'

/** Dialog routes keep the collection visible behind them. */
function OnCollection({ children }: { children: ReactNode }) {
  return (
    <>
      <Home />
      {children}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
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
      </LanguageProvider>
    </AuthProvider>
  )
}
