'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Wallet } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import {
  Field, FormError, FormGrid, Input, MoneyInput, Select, SubmitButton, Textarea,
} from '@/components/ui/Form'
import { createPayment } from '@/lib/actions/payments'
import { PAYMENT_METHOD, money, monthLabel, todayISO } from '@/lib/format'

const METHOD_OPTIONS = Object.entries(PAYMENT_METHOD).map(([value, label]) => ({ value, label }))

/**
 * Enregistrement d'un paiement pour un loyer donné.
 * Plusieurs paiements peuvent être saisis pour un même mois : ils s'additionnent.
 */
export function PaymentDialog({
  rentId, periodMonth, balance, amountDue, tenantLabel, propertyLabel,
  trigger = 'button', className = 'btn-primary',
}: {
  rentId: string
  periodMonth: string
  balance: number
  amountDue: number
  tenantLabel: string
  propertyLabel: string
  trigger?: 'button' | 'compact'
  className?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(createPayment, { error: null, success: null })
  const [amount, setAmount] = useState(String(balance > 0 ? balance : ''))

  useEffect(() => {
    if (state.success) {
      setOpen(false)
      router.refresh()
    }
  }, [state.success, router])

  useEffect(() => {
    if (open) setAmount(String(balance > 0 ? balance : ''))
  }, [open, balance])

  const entered = Number(amount || 0)
  const remaining = balance - entered

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={trigger === 'compact' ? 'btn-secondary btn-sm' : className}
      >
        <Plus className={trigger === 'compact' ? 'size-4' : 'size-5'} aria-hidden />
        {trigger === 'compact' ? 'Paiement' : 'Enregistrer un paiement'}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Enregistrer un paiement"
        description={`${monthLabel(periodMonth)} · ${tenantLabel} · ${propertyLabel}`}
        size="md"
      >
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="rent_id" value={rentId} />
          <FormError message={state.error} />

          <div className="grid grid-cols-2 gap-3 rounded-xl bg-ink-50 px-5 py-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Montant dû</p>
              <p className="font-bold tabular-nums text-ink-900">{money(amountDue)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Reste avant</p>
              <p className="font-bold tabular-nums text-ink-900">{money(balance)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Reste après</p>
              <p className={`font-bold tabular-nums ${remaining > 0 ? 'text-warn-700' : 'text-ok-700'}`}>
                {money(Math.max(remaining, 0))}
              </p>
            </div>
          </div>

          <FormGrid>
            <Field label="Montant reçu" name="amount" required>
              <MoneyInput
                name="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
              />
            </Field>
            <Field label="Date du paiement" name="payment_date" required>
              <Input name="payment_date" type="date" defaultValue={todayISO()} required />
            </Field>
            <Field label="Mode de paiement" name="method" required>
              <Select name="method" defaultValue="especes" options={METHOD_OPTIONS} required />
            </Field>
            <Field label="Référence" name="reference" hint="N° de chèque, virement…">
              <Input name="reference" maxLength={60} />
            </Field>
            <Field label="Note" name="note" className="sm:col-span-2">
              <Textarea name="note" rows={2} />
            </Field>
          </FormGrid>

          {entered > balance && balance >= 0 && (
            <p className="rounded-lg bg-warn-50 px-4 py-3 text-sm text-warn-700 ring-1 ring-inset ring-warn-100">
              Le montant saisi dépasse le reste dû de {money(entered - balance)}. Le loyer sera marqué comme payé.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Annuler</button>
            <SubmitButton pendingLabel="Enregistrement…">
              <Wallet className="size-5" aria-hidden />
              Enregistrer le paiement
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  )
}
