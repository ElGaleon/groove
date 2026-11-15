import { z } from 'zod'
import { ChangePasswordInSchema } from '@/shared/schemas'

/** The change-password form: the new password must reach the length the server asks for. */
export const changePasswordForm = (min: number) =>
  z.object({
    current_password: ChangePasswordInSchema.shape.current_password.min(1),
    new_password: ChangePasswordInSchema.shape.new_password.min(min),
  })
