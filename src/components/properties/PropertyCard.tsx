import Link from 'next/link'
import { Bed, MapPin, Ruler, TrendingUp, TriangleAlert } from 'lucide-react'
import { PropertyStatusBadge } from '@/components/ui/Badge'
import { PROPERTY_TYPE, money, num, percent } from '@/lib/format'
import type { Property, PropertyStats } from '@/lib/types'

export function PropertyCard({
  property: p, stats,
}: {
  property: Property
  stats?: PropertyStats
}) {
  const impayes = Number(stats?.total_impayes ?? 0)

  return (
    <Link
      href={`/biens/${p.id}`}
      className="card card-link reveal flex h-full flex-col p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-400">{p.reference}</p>
          <h2 className="mt-0.5 truncate text-[17px] font-bold text-ink-900">{p.name}</h2>
        </div>
        <PropertyStatusBadge status={p.status} />
      </div>

      <p className="mt-2 flex items-center gap-1.5 truncate text-sm text-ink-500">
        <MapPin className="size-4 shrink-0 text-ink-400" aria-hidden />
        {[p.address, p.city].filter(Boolean).join(', ') || 'Adresse non renseignée'}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600">
        <span className="font-medium">{PROPERTY_TYPE[p.type]}</span>
        {p.surface != null && (
          <span className="flex items-center gap-1.5">
            <Ruler className="size-4 text-ink-400" aria-hidden />
            {num(p.surface, 0)} m²
          </span>
        )}
        {p.rooms != null && (
          <span className="flex items-center gap-1.5">
            <Bed className="size-4 text-ink-400" aria-hidden />
            {p.rooms} ch.
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4">
        <div>
          <p className="text-xs font-semibold text-ink-500">Loyer mensuel</p>
          <p className="mt-0.5 font-bold tabular-nums text-ink-900">{money(p.monthly_rent)}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-xs font-semibold text-ink-500">
            <TrendingUp className="size-3.5" aria-hidden />
            Rentabilité nette
          </p>
          <p className="mt-0.5 font-bold tabular-nums text-ink-900">
            {stats?.rentabilite_nette != null ? percent(stats.rentabilite_nette) : '—'}
          </p>
        </div>
      </div>

      {impayes > 0 && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-bad-50 px-3 py-2 text-sm font-semibold text-bad-700">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {money(impayes)} d&apos;impayés
        </p>
      )}
    </Link>
  )
}
