'use client'

import { FileDown } from 'lucide-react'
import { downloadReceipt, type ReceiptData } from '@/lib/pdf'

/** Génère et télécharge le reçu de paiement en PDF (côté navigateur). */
export function ReceiptButton({
  data, className = 'btn-ghost btn-sm text-ink-600', label = 'Reçu',
}: {
  data: ReceiptData
  className?: string
  label?: string
}) {
  return (
    <button type="button" onClick={() => downloadReceipt(data)} className={className}>
      <FileDown className="size-4" aria-hidden />
      {label}
    </button>
  )
}
