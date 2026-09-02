'use client'

import { useEffect, useRef, useState } from 'react'
import { money, percent } from '@/lib/format'

/**
 * Le format est désigné par un nom plutôt que par une fonction : une fonction
 * ne peut pas traverser la frontière serveur → client.
 */
const FORMATS = {
  money,
  percent,
  integer: (v: number) => String(Math.round(v)),
} as const

export type CountUpFormat = keyof typeof FORMATS

/**
 * Compte de zéro jusqu'à la valeur, une seule fois à l'affichage.
 * Le chiffre final s'écrit immédiatement si l'utilisateur a demandé à
 * réduire les animations : l'information ne dépend jamais du mouvement.
 */
export function CountUp({
  value,
  format = 'money',
  duration = 900,
  className,
}: {
  value: number
  format?: CountUpFormat
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = useState(value)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced || value === 0 || duration <= 0) {
      setDisplay(value)
      return
    }

    const start = performance.now()
    setDisplay(0)

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // Sortie quartique : élan franc puis freinage net, comme un compteur mécanique.
      const eased = 1 - Math.pow(1 - t, 4)
      setDisplay(value * eased)
      if (t < 1) frame.current = requestAnimationFrame(tick)
      else setDisplay(value)
    }

    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [value, duration])

  return <span className={className}>{FORMATS[format](display)}</span>
}
