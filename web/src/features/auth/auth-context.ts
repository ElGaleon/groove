import { createContext, useContext } from 'react'

import type { User } from '@/shared/schemas'

export type { User }

export interface AuthValue {
  user: User | null
  loading: boolean
  needsSetup: boolean
  /** What the server asks of a password: the forms apply the same limit. */
  minPasswordLength: number
  signIn: (email: string, password: string) => Promise<void>
  register: (input: {
    email: string
    password: string
    display_name: string
    household_name?: string
    invite_token?: string
  }) => Promise<void>
  resetPassword: (token: string, newPassword: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<unknown>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
