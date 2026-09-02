'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck, Loader2 } from 'lucide-react'
import { payRemaining } from '@/lib/actions/payments'

/** Encaisse en un clic la totalité du reste dû (mode espèces, daté du jour). */
export function PayRemainingButton({ rentId, className = 'btn-secondary btn-sm' }: {
  rentId: string
  className?: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run() {
    setError(null)
    start(async () => {
      const res = await payRemaining(rentId)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <>
      <button type="button" onClick={run} disabled={pending} className={className} title="Encaisser le solde en espèces">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCheck className="size-4" aria-hidden />}
        Solder
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-bad-700">{error}</p>}
    </>
  )
}
