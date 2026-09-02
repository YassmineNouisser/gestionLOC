'use client'

import { useState, useTransition } from 'react'
import { Loader2, Trash2, TriangleAlert } from 'lucide-react'
import { Modal } from './Modal'

/**
 * Bouton de suppression avec confirmation explicite.
 * `action` est une Server Action qui renvoie un message d'erreur, ou null.
 */
export function DeleteButton({
  action, label = 'Supprimer', title, description, className = 'btn-danger',
  compact = false,
}: {
  action: () => Promise<{ error: string | null }>
  label?: string
  title: string
  description: string
  className?: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function confirm() {
    setError(null)
    startTransition(async () => {
      const res = await action()
      if (res?.error) setError(res.error)
      else setOpen(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); setOpen(true) }}
        className={compact ? 'btn-ghost btn-sm text-bad-600 hover:bg-bad-50' : className}
        aria-label={compact ? label : undefined}
      >
        <Trash2 className={compact ? 'size-4' : 'size-5'} aria-hidden />
        {!compact && label}
      </button>

      <Modal open={open} onClose={() => !pending && setOpen(false)} title={title} size="sm">
        <div className="flex gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-bad-50 text-bad-600">
            <TriangleAlert className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-ink-700">{description}</p>
            {error && (
              <p role="alert" className="mt-3 rounded-lg bg-bad-50 px-3 py-2 text-sm text-bad-700">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="btn-secondary"
            disabled={pending}
          >
            Annuler
          </button>
          <button type="button" onClick={confirm} className="btn-danger" disabled={pending}>
            {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
            {pending ? 'Suppression…' : 'Confirmer la suppression'}
          </button>
        </div>
      </Modal>
    </>
  )
}
