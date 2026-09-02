'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function Modal({
  open, onClose, title, description, children, size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>(
      'input:not([type=hidden]), select, textarea, button',
    )?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open || !mounted) return null

  const width = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' }[size]

  /*
   * Rendu dans document.body plutôt qu'en place : une carte animée ou un
   * conteneur en overflow-auto crée un bloc conteneur qui rognerait un
   * élément en position fixed. Le portail met la modale hors d'atteinte.
   */
  return createPortal(
    <div className="no-print fixed inset-0 z-[100] overflow-y-auto">
      <div
        className="reveal-fade fixed inset-0 bg-ink-950/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`relative w-full ${width} rounded-t-2xl bg-white sm:rounded-2xl`}
          style={{
            boxShadow: 'var(--shadow-lg)',
            animation: 'pop-in 0.35s var(--ease-out-quint) both',
          }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-6 py-5">
            <div>
              <h2 className="font-display text-[1.15rem] leading-tight text-ink-900">{title}</h2>
              {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
            </div>
            <button onClick={onClose} className="btn-ghost -mr-2 -mt-1 p-2" aria-label="Fermer">
              <X className="size-5" />
            </button>
          </div>
          <div className="px-6 py-5">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
