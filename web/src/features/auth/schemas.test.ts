import { describe, expect, it } from 'vitest'
import { checkForm } from '@/shared/lib/form'
import { joinForm, setupForm, signInForm } from './schemas'

describe('auth forms', () => {
  it('asks for a longer password in the member\'s language, with the number the server announced', () => {
    const result = checkForm(joinForm(12), { display_name: 'Bob', email: 'bob@example.com', password: 'short' })
    expect(result.errors).toEqual({ password: 'La password deve avere almeno 12 caratteri.' })
  })

  it('names what is missing and what is not valid', () => {
    const result = checkForm(setupForm(10), { household_name: '  ', display_name: 'Anna', email: 'not-an-email', password: 'a long enough password' })
    expect(result.errors).toEqual({ household_name: 'Manca il nome della famiglia.', email: 'Controlla l’email: valore non valido.' })
  })

  it('trims what was typed and returns the cleaned values', () => {
    const result = checkForm(signInForm, { email: '  anna@example.com ', password: 'x' })
    expect(result.data).toEqual({ email: 'anna@example.com', password: 'x' })
    expect(result.errors).toBeNull()
  })

  it('does not send an empty form', () => {
    const result = checkForm(signInForm, { email: '', password: '' })
    expect(Object.keys(result.errors ?? {}).sort()).toEqual(['email', 'password'])
  })
})
