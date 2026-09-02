'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import {
  Field, FormError, FormGrid, Input, MoneyInput, Select, SubmitButton, Textarea,
} from '@/components/ui/Form'
import { updatePayment } from '@/lib/actions/payments'
import { PAYMENT_METHOD } from '@/lib/format'
import type { Payment } from '@/lib/types'

const METHOD_OPTIONS = Object.entries(PAYMENT_METHOD).map(([value, label]) => ({ value, label }))

export function PaymentEditDialog({ payment }: { payment: Payment }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(
    updatePayment.bind(null, payment.id),
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
        aria-label="Modifier ce paiement"
      >
        <Pencil className="size-4" aria-hidden />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Modifier le paiement" size="md">
        <form action={formAction} className="space-y-5">
          <FormError message={state.error} />
          <FormGrid>
            <Field label="Montant" name="amount" required>
              <MoneyInput name="amount" defaultValue={payment.amount} required />
            </Field>
            <Field label="Date du paiement" name="payment_date" required>
              <Input name="payment_date" type="date" defaultValue={payment.payment_date} required />
            </Field>
            <Field label="Mode de paiement" name="method" required>
              <Select name="method" defaultValue={payment.method} options={METHOD_OPTIONS} required />
            </Field>
            <Field label="Référence" name="reference">
              <Input name="reference" defaultValue={payment.reference ?? ''} maxLength={60} />
            </Field>
            <Field label="Note" name="note" className="sm:col-span-2">
              <Textarea name="note" defaultValue={payment.note ?? ''} rows={2} />
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
