'use client'

import { useEffect, useState } from 'react'

/**
 * Barre de progression d'encaissement.
 * Elle se remplit depuis zéro à l'affichage ; la valeur est toujours
 * écrite en clair à côté, la couleur seule ne porte jamais l'information.
 */
export function ProgressBar({
  value, max, label, tone = 'ok',
}: {
  value: number
  max: number
  label?: string
  tone?: 'ok' | 'warn' | 'brand'
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 80)
    return () => clearTimeout(t)
  }, [pct])

  const fill = {
    ok:    'from-ok-600 to-ok-700',
    warn:  'from-warn-600 to-warn-700',
    brand: 'from-brand-500 to-brand-700',
  }[tone]

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progression'}
      className="relative h-2.5 w-full overflow-hidden rounded-full bg-ink-200/80 ring-1 ring-inset ring-ink-200"
    >
      <div
        className={`relative h-full rounded-full bg-gradient-to-r ${fill}`}
        style={{
          width: `${width}%`,
          transition: 'width 1.1s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Liseré clair sur l'arête supérieure : donne du relief au remplissage. */}
        <span
          className="absolute inset-x-0 top-0 h-px rounded-full bg-white/35"
          aria-hidden
        />
      </div>
    </div>
  )
}
