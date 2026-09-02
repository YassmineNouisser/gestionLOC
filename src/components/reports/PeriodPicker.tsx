'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { monthLabel, shiftMonth } from '@/lib/format'

/** Navigation mois précédent / suivant, avec sélecteur de mois. */
export function MonthPicker({ value }: { value: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()

  function go(month: string) {
    const next = new URLSearchParams(params.toString())
    next.set('mois', month)
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }))
  }

  return (
    <div className="no-print flex items-center gap-2">
      <button type="button" onClick={() => go(shiftMonth(value, -1))}
              className="btn-secondary px-3" aria-label="Mois précédent">
        <ChevronLeft className="size-5" />
      </button>

      <div className="relative">
        <input
          type="month"
          value={value.slice(0, 7)}
          onChange={(e) => e.target.value && go(`${e.target.value}-01`)}
          aria-label={`Mois du rapport : ${monthLabel(value)}`}
          className="field h-11 w-auto py-0"
        />
        {pending && (
          <Loader2 className="absolute -right-7 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-400" aria-hidden />
        )}
      </div>

      <button type="button" onClick={() => go(shiftMonth(value, 1))}
              className="btn-secondary px-3" aria-label="Mois suivant">
        <ChevronRight className="size-5" />
      </button>
    </div>
  )
}

/** Navigation entre années civiles. */
export function YearPicker({ value, min, max }: { value: number; min: number; max: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()

  function go(year: number) {
    const next = new URLSearchParams(params.toString())
    next.set('annee', String(year))
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }))
  }

  const years = Array.from({ length: max - min + 1 }, (_, i) => max - i)

  return (
    <div className="no-print flex items-center gap-2">
      <button type="button" onClick={() => go(value - 1)} disabled={value <= min}
              className="btn-secondary px-3" aria-label="Année précédente">
        <ChevronLeft className="size-5" />
      </button>

      <select
        value={value}
        onChange={(e) => go(Number(e.target.value))}
        aria-label={`Année du rapport : ${value}`}
        className="field h-11 w-auto py-0"
      >
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>

      {pending && <Loader2 className="size-4 animate-spin text-ink-400" aria-hidden />}

      <button type="button" onClick={() => go(value + 1)} disabled={value >= max}
              className="btn-secondary px-3" aria-label="Année suivante">
        <ChevronRight className="size-5" />
      </button>
    </div>
  )
}
