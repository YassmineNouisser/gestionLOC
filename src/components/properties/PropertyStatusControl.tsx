'use client'

import { useState, useTransition } from 'react'
import { Loader2, Wrench } from 'lucide-react'
import { setPropertyStatus } from '@/lib/actions/properties'

/**
 * Bascule "Maintenance". Un bien avec contrat actif revient automatiquement
 * à "Loué" en sortie de maintenance (le trigger SQL fait autorité).
 */
export function PropertyStatusControl({
  id, status,
}: {
  id: string
  status: 'libre' | 'loue' | 'maintenance'
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inMaintenance = status === 'maintenance'

  function toggle() {
    setError(null)
    start(async () => {
      const res = await setPropertyStatus(id, inMaintenance ? 'libre' : 'maintenance')
      if (res.error) setError(res.error)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={inMaintenance ? 'btn-secondary' : 'btn-secondary'}
      >
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Wrench className="size-5" aria-hidden />}
        {inMaintenance ? 'Terminer la maintenance' : 'Mettre en maintenance'}
      </button>
      {error && <p role="alert" className="text-sm text-bad-700">{error}</p>}
    </>
  )
}
