'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import {
  Field, FormError, FormGrid, Input, MoneyInput, Select, SubmitButton, Textarea,
} from '@/components/ui/Form'
import { createDepositPayment } from '@/lib/actions/deposits'
import { PAYMENT_METHOD, money, todayISO } from '@/lib/format'

const METHOD_OPTIONS = Object.entries(PAYMENT_METHOD).map(([value, label]) => ({ value, label }))

/**
 * Versement de caution. Plusieurs versements peuvent se succéder :
 * ils s'additionnent, exactement comme les paiements de loyer.
 */
export function DepositDialog({
  contractId, due, paid, balance, tenantLabel, propertyLabel, compact = false,
}: {
  contractId: string
  due: number
  paid: number
  balance: number
  tenantLabel: string
  propertyLabel: string
  compact?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(createDepositPayment, { error: null, success: null })
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
        className={compact ? 'btn-secondary btn-sm' : 'btn-primary'}
      >
        <Plus className={compact ? 'size-4' : 'size-5'} aria-hidden />
        {compact ? 'Verser' : 'Enregistrer un versement'}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Versement de caution"
        description={`${tenantLabel} · ${propertyLabel}`}
        size="md"
      >
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="contract_id" value={contractId} />
          <FormError message={state.error} />

          <div className="grid grid-cols-3 gap-3 rounded-xl bg-ink-50 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Caution due</p>
              <p className="font-bold tabular-nums text-ink-900">{money(due)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Déjà versé</p>
              <p className="font-bold tabular-nums text-ok-700">{money(paid)}</p>
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
              <MoneyInput name="amount" value={amount} onChange={(e) => setAmount(e.target.value)}
                          required autoFocus />
            </Field>
            <Field label="Date du versement" name="payment_date" required>
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
              Le montant dépasse le reste dû de {money(entered - balance)}. La caution sera marquée comme versée.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Annuler</button>
            <SubmitButton pendingLabel="Enregistrement…">
              <KeyRound className="size-5" aria-hidden />
              Enregistrer le versement
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  )
}
