'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import {
  Field, FormError, FormGrid, FormSection, Input, SubmitButton, Textarea,
} from '@/components/ui/Form'
import type { ActionState } from '@/lib/actions/shared'
import type { Tenant } from '@/lib/types'

export function TenantForm({
  action, tenant, cancelHref,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  tenant?: Tenant
  cancelHref: string
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, { error: null })

  return (
    <form action={formAction} className="space-y-8">
      <FormError message={state.error} />

      <div className="card space-y-8 p-6">
        <FormSection title="Identité">
          <FormGrid>
            <Field label="Prénom" name="first_name" required>
              <Input name="first_name" defaultValue={tenant?.first_name} required maxLength={80} />
            </Field>
            <Field label="Nom" name="last_name" required>
              <Input name="last_name" defaultValue={tenant?.last_name} required maxLength={80} />
            </Field>
            <Field label="Numéro de CIN" name="cin" hint="Carte d'identité nationale">
              <Input name="cin" defaultValue={tenant?.cin ?? ''} maxLength={30} placeholder="12345678" />
            </Field>
            <Field label="Profession" name="profession">
              <Input name="profession" defaultValue={tenant?.profession ?? ''} maxLength={80} />
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection title="Coordonnées">
          <FormGrid>
            <Field label="Téléphone" name="phone">
              <Input name="phone" type="tel" inputMode="tel" defaultValue={tenant?.phone ?? ''} placeholder="+216 20 000 000" />
            </Field>
            <Field label="Email" name="email">
              <Input name="email" type="email" defaultValue={tenant?.email ?? ''} placeholder="locataire@exemple.com" />
            </Field>
            <Field label="Adresse personnelle" name="address" className="sm:col-span-2">
              <Input name="address" defaultValue={tenant?.address ?? ''} />
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection title="Contact d'urgence" description="Personne à prévenir en cas de besoin.">
          <FormGrid>
            <Field label="Nom du contact" name="emergency_contact_name">
              <Input name="emergency_contact_name" defaultValue={tenant?.emergency_contact_name ?? ''} />
            </Field>
            <Field label="Téléphone du contact" name="emergency_contact_phone">
              <Input name="emergency_contact_phone" type="tel" inputMode="tel"
                     defaultValue={tenant?.emergency_contact_phone ?? ''} />
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection title="Notes">
          <Field label="Informations complémentaires" name="notes">
            <Textarea name="notes" defaultValue={tenant?.notes ?? ''} rows={4} />
          </Field>
        </FormSection>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <Link href={cancelHref} className="btn-secondary">Annuler</Link>
        <SubmitButton>{tenant ? 'Enregistrer les modifications' : 'Créer le locataire'}</SubmitButton>
      </div>
    </form>
  )
}
