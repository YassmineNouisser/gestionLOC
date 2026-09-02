'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X, Loader2 } from 'lucide-react'

/** Met à jour les paramètres d'URL sans perdre les autres filtres. */
function useUrlFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString())
      if (value) next.set(key, value)
      else next.delete(key)
      next.delete('page')
      startTransition(() => {
        router.replace(`${pathname}?${next.toString()}`, { scroll: false })
      })
    },
    [params, pathname, router],
  )

  return { params, setParam, pending, pathname, router }
}

export function SearchFilter({
  placeholder = 'Rechercher…', paramName = 'q',
}: {
  placeholder?: string
  paramName?: string
}) {
  const { params, setParam, pending } = useUrlFilter()
  const current = params.get(paramName) ?? ''
  const [value, setValue] = useState(current)

  useEffect(() => { setValue(current) }, [current])

  // Recherche différée : évite une requête à chaque frappe.
  useEffect(() => {
    if (value === current) return
    const t = setTimeout(() => setParam(paramName, value), 350)
    return () => clearTimeout(t)
  }, [value, current, paramName, setParam])

  return (
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-400" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="field h-11 py-0 pl-10 pr-10"
      />
      {pending && (
        <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-400" aria-hidden />
      )}
    </div>
  )
}

export function SelectFilter({
  paramName, label, options, allLabel = 'Tous',
}: {
  paramName: string
  label: string
  options: { value: string; label: string }[]
  allLabel?: string
}) {
  const { params, setParam } = useUrlFilter()
  return (
    <select
      value={params.get(paramName) ?? ''}
      onChange={(e) => setParam(paramName, e.target.value)}
      aria-label={label}
      className="field h-11 w-auto min-w-[9rem] py-0"
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function MonthFilter({ paramName = 'mois', label = 'Mois' }: { paramName?: string; label?: string }) {
  const { params, setParam } = useUrlFilter()
  const value = (params.get(paramName) ?? '').slice(0, 7)
  return (
    <input
      type="month"
      value={value}
      onChange={(e) => setParam(paramName, e.target.value ? `${e.target.value}-01` : '')}
      aria-label={label}
      className="field h-11 w-auto py-0"
    />
  )
}

export function ResetFilters({ keep = [] as string[] }) {
  const { params, pathname, router } = useUrlFilter()
  const active = [...params.keys()].filter((k) => !keep.includes(k) && params.get(k))
  if (active.length === 0) return null

  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { scroll: false })}
      className="btn-ghost btn-sm h-11 text-ink-600"
    >
      <X className="size-4" aria-hidden />
      Réinitialiser
    </button>
  )
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="no-print mb-5 flex flex-wrap items-center gap-2.5">{children}</div>
  )
}
