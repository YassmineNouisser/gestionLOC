'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import {
  Field, FormError, FormGrid, Input, MoneyInput, Select, SubmitButton, Textarea,
} from '@/components/ui/Form'
import { updateExpense } from '@/lib/actions/expenses'
import { EXPENSE_CATEGORY } from '@/lib/format'
import type { Expense, Property } from '@/lib/types'

const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY).map(([value, label]) => ({ value, label }))

export function ExpenseEditDialog({
  expense, properties,
}: {
  expense: Expense
  properties: Pick<Property, 'id' | 'reference' | 'name'>[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(
    updateExpense.bind(null, expense.id),
    { error: null, success: null },
  )

  useEffect(() => {
    if (state.success) {
      setOpen(false)
      router.refresh()
    }
  }, [state.success, router])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost btn-sm text-ink-600"
        aria-label="Modifier cette dépense"
      >
        <Pencil className="size-4" aria-hidden />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Modifier la dépense" size="md">
        <form action={formAction} className="space-y-5">
          <FormError message={state.error} />
          <FormGrid>
            <Field label="Bien concerné" name="property_id" required>
              <Select
                name="property_id"
                defaultValue={expense.property_id}
                options={properties.map((p) => ({ value: p.id, label: `${p.reference} — ${p.name}` }))}
                required
              />
            </Field>
            <Field label="Catégorie" name="category" required>
              <Select name="category" defaultValue={expense.category} options={CATEGORY_OPTIONS} required />
            </Field>
            <Field label="Montant" name="amount" required>
              <MoneyInput name="amount" defaultValue={expense.amount} required />
            </Field>
            <Field label="Date" name="expense_date" required>
              <Input name="expense_date" type="date" defaultValue={expense.expense_date} required />
            </Field>
            <Field label="Description" name="description" className="sm:col-span-2">
              <Textarea name="description" defaultValue={expense.description ?? ''} rows={3} />
            </Field>
          </FormGrid>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Annuler</button>
            <SubmitButton />
          </div>
        </form>
      </Modal>
    </>
  )
}
