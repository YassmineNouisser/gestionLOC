'use client'

import { useState, useTransition } from 'react'
import { Loader2, RotateCcw, SquarePen } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Field, FormError, Input, Select } from '@/components/ui/Form'
import { closeContract, reopenContract } from '@/lib/actions/contracts'
import { todayISO } from '@/lib/format'
import type { ContractStatus } from '@/lib/types'

export function ContractStatusControl({
  id, status,
}: {
  id: string
  status: ContractStatus
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [endDate, setEndDate] = useState(todayISO())
  const [nextStatus, setNextStatus] = useState<'termine' | 'resilie'>('termine')

  function submitClose() {
    setError(null)
    start(async () => {
      const res = await closeContract(id, nextStatus, endDate)
      if (res.error) setError(res.error)
      else setOpen(false)
    })
  }

  function submitReopen() {
    setError(null)
    start(async () => {
      const res = await reopenContract(id)
      if (res.error) setError(res.error)
    })
  }

  if (status !== 'actif') {
    return (
      <>
        <button type="button" onClick={submitReopen} disabled={pending} className="btn-secondary">
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <RotateCcw className="size-5" aria-hidden />}
          Réactiver le contrat
        </button>
        {error && <p role="alert" className="text-sm text-bad-700">{error}</p>}
      </>
    )
  }

  return (
    <>
      <button type="button" onClick={() => { setError(null); setOpen(true) }} className="btn-secondary">
        <SquarePen className="size-5" aria-hidden />
        Clôturer le contrat
      </button>

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Clôturer le contrat"
        description="Le bien redeviendra automatiquement libre. Les loyers déjà générés et les paiements sont conservés."
        size="sm"
      >
        <div className="space-y-5">
          <FormError message={error} />

          <Field label="Motif de clôture" name="close_status" required>
            <Select
              name="close_status"
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as 'termine' | 'resilie')}
              options={[
                { value: 'termine', label: 'Terminé — le bail est arrivé à son terme' },
                { value: 'resilie', label: 'Résilié — fin anticipée du bail' },
              ]}
            />
          </Field>

          <Field label="Date de fin" name="close_end_date" required
                 hint="Aucun loyer ne sera généré après cette date.">
            <Input
              name="close_end_date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary" disabled={pending}>
              Annuler
            </button>
            <button type="button" onClick={submitClose} className="btn-primary" disabled={pending}>
              {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
              {pending ? 'Clôture…' : 'Confirmer la clôture'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
