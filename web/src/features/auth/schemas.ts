import { z } from 'zod'
import { LoginInSchema, PasswordResetInSchema, RegisterInSchema } from '@/shared/schemas'

/**
 * What the auth forms check before sending. The limits come from the server's own request
 * schemas; the minimum password length is what the server announces (`/api/auth/status`).
 */
const email = z.string().trim().min(1).pipe(RegisterInSchema.shape.email)
const displayName = z.string().trim().pipe(RegisterInSchema.shape.display_name)
const householdName = z.string().trim().pipe(RegisterInSchema.shape.household_name.unwrap().unwrap())
const newPassword = (min: number) => z.string().min(min)

export const signInForm = z.object({ email, password: LoginInSchema.shape.password.min(1) })

export const setupForm = (min: number) =>
  z.object({ household_name: householdName, display_name: displayName, email, password: newPassword(min) })

export const joinForm = (min: number) => setupForm(min).omit({ household_name: true })

export const resetForm = (min: number) => z.object({ new_password: PasswordResetInSchema.shape.new_password.min(min) })
