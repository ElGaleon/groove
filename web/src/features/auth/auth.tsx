import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { z } from 'zod'
import { api, ApiError } from '@/shared/lib/api'
import { SetupStatusSchema, UserSchema } from '@/shared/schemas'
import { AuthContext, type AuthValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const me = useQuery({
    queryKey: ['me'],
    retry: false,
    queryFn: async () => {
      try {
        return await api('/api/auth/me', { schema: UserSchema })
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
  })
  const setup = useQuery({
    queryKey: ['setup'],
    queryFn: () => api('/api/auth/status', { schema: SetupStatusSchema }),
  })

  const signInMutation = useMutation({
    mutationFn: (v: { email: string; password: string }) =>
      api('/api/auth/login', { method: 'POST', body: v, schema: UserSchema }),
    onSuccess: (user) => queryClient.setQueryData(['me'], user),
  })
  const registerMutation = useMutation({
    mutationFn: (body: object) => api('/api/auth/register', { method: 'POST', body, schema: UserSchema }),
    onSuccess: (user) => {
      queryClient.setQueryData(['me'], user)
      queryClient.setQueryData(['setup'], (old: z.infer<typeof SetupStatusSchema> | undefined) => ({
        min_password_length: 10,
        ...old,
        needs_setup: false,
      }))
    },
  })
  const resetMutation = useMutation({
    mutationFn: (v: { token: string; new_password: string }) =>
      api('/api/auth/password-reset', { method: 'POST', body: v, schema: UserSchema }),
    onSuccess: (user) => queryClient.setQueryData(['me'], user),
  })
  const signOutMutation = useMutation({
    mutationFn: () => api('/api/auth/logout', { method: 'POST', schema: z.void() }),
    onSuccess: () => {
      queryClient.setQueryData(['me'], null)
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'setup' })
    },
  })

  const value: AuthValue = {
    user: me.data ?? null,
    loading: me.isLoading || setup.isLoading,
    needsSetup: setup.data?.needs_setup ?? false,
    minPasswordLength: setup.data?.min_password_length ?? 10,
    signIn: async (email, password) => {
      await signInMutation.mutateAsync({ email, password })
    },
    register: async (input) => {
      await registerMutation.mutateAsync(input)
    },
    resetPassword: async (token, newPassword) => {
      await resetMutation.mutateAsync({ token, new_password: newPassword })
    },
    signOut: async () => {
      await signOutMutation.mutateAsync()
    },
    refresh: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
