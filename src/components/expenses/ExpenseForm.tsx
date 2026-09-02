'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import {
  Field, FormError, FormGrid, Input, MoneyInput, Select, SubmitButton, Textarea,
} from '@/components/ui/Form'
import { EXPENSE_CATEGORY, todayISO } from '@/lib/format'
import type { ActionState } from '@/lib/actions/shared'
import type { Expense } from '@/lib/types'

const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY).map(([value, label]) => ({ value, label }))

export function ExpenseForm({
  action, expense, properties, defaultPropertyId, cancelHref, submitLabel,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  expense?: Expense
  properties: { id: string; reference: string; name: string }[]
  defaultPropertyId?: string
  cancelHref: string
  submitLabel?: string
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, { error: null })

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />

      <div className="card p-6">
        <FormGrid>
          <Field label="Bien concerné" name="property_id" required>
            <Select
              name="property_id"
              defaultValue={expense?.property_id ?? defaultPropertyId ?? ''}
              options={properties.map((p) => ({ value: p.id, label: `${p.reference} — ${p.name}` }))}
              placeholder="Sélectionner un bien…"
              required
            />
          </Field>
          <Field label="Catégorie" name="category" required>
            <Select name="category" defaultValue={expense?.category ?? 'reparation'} options={CATEGORY_OPTIONS} required />
          </Field>
          <Field label="Montant" name="amount" required>
            <MoneyInput name="amount" defaultValue={expense?.amount ?? ''} required autoFocus={!expense} />
          </Field>
          <Field label="Date de la dépense" name="expense_date" required>
            <Input name="expense_date" type="date" defaultValue={expense?.expense_date ?? todayISO()} required />
          </Field>
          <Field label="Description" name="description" className="sm:col-span-2"
                 hint="Facultatif : nature des travaux, fournisseur, période concernée…">
            <Textarea name="description" defaultValue={expense?.description ?? ''} rows={3} />
          </Field>
        </FormGrid>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <Link href={cancelHref} className="btn-secondary">Annuler</Link>
        <SubmitButton>{submitLabel ?? (expense ? 'Enregistrer les modifications' : 'Enregistrer la dépense')}</SubmitButton>
      </div>
    </form>
  )
}
