'use client'

import { useActionState } from 'react'
import {
  Field, FormError, FormGrid, FormSuccess, Input, SubmitButton,
} from '@/components/ui/Form'
import { updateProfile } from '@/lib/actions/profile'
import { updatePassword } from '@/lib/actions/auth'

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, formAction] = useActionState(updateProfile, { error: null, success: null })

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.error} />
      <FormSuccess message={state.success} />

      <FormGrid>
        <Field label="Nom affiché" name="full_name" required>
          <Input name="full_name" defaultValue={fullName} required maxLength={80} />
        </Field>
        <Field label="Adresse email" name="email"
               hint="L'email de connexion se modifie depuis Supabase.">
          <Input name="email" value={email} disabled readOnly />
        </Field>
      </FormGrid>

      <div className="flex justify-end">
        <SubmitButton>Enregistrer</SubmitButton>
      </div>
    </form>
  )
}

export function PasswordForm() {
  const [state, formAction] = useActionState(updatePassword, { error: null })

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.error} />
      <FormSuccess message={state.success} />

      <FormGrid>
        <Field label="Nouveau mot de passe" name="password" required
               hint="8 caractères minimum.">
          <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Confirmer le mot de passe" name="confirm" required>
          <Input name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
      </FormGrid>

      <div className="flex justify-end">
        <SubmitButton>Changer le mot de passe</SubmitButton>
      </div>
    </form>
  )
}
