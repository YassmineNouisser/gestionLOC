import type { Metadata } from 'next'
import Link from 'next/link'
import { Droplets, Gauge, Plus, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import { requireUser } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatCard } from '@/components/ui/StatCard'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { FilterBar, MonthFilter, ResetFilters, SearchFilter, SelectFilter } from '@/components/ui/Filters'
import { deleteReading } from '@/lib/actions/readings'
import { date, money, monthLabel, num } from '@/lib/format'
import type { MeterReadingView, Property } from '@/lib/types'

export const metadata: Metadata = { title: 'Relevés' }
export const dynamic = 'force-dynamic'

export default async function ReadingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mois?: string; bien?: string }>
}) {
  const { q, mois, bien } = await searchParams
  const user = await requireUser()
  const supabase = await createClient()

  let query = supabase.from('v_meter_readings').select('*')
    .order('period_month', { ascending: false })
    .order('property_reference')
    .limit(500)

  if (mois) query = query.eq('period_month', mois)
  if (bien) query = query.eq('property_id', bien)

  const [{ data, error }, { data: propertyRows }] = await Promise.all([
    query,
    supabase.from('properties').select('id, reference, name').order('reference'),
  ])

  let readings = rows<MeterReadingView>(data)
  if (q) {
    const needle = q.toLowerCase()
    readings = readings.filter((r) =>
      [r.property_name, r.property_reference, r.tenant_first_name, r.tenant_last_name]
        .some((v) => v?.toLowerCase().includes(needle)),
    )
  }

  const properties = rows<Pick<Property, 'id' | 'reference' | 'name'>>(propertyRows)
  const sum = (get: (r: MeterReadingView) => number) =>
    readings.reduce((s, r) => s + Number(get(r)), 0)

  const filtered = Boolean(q || mois || bien)

  return (
    <>
      <PageHeader
        title="Eau et électricité"
        subtitle={
          mois
            ? `${monthLabel(mois)} · ${readings.length} relevé${readings.length > 1 ? 's' : ''}`
            : 'Relevés de compteurs et montants à refacturer'
        }
        actions={
          user.canWrite && (
            <Link href="/releves/nouveau" className="btn-primary">
              <Plus className="size-5" aria-hidden />
              Nouveau relevé
            </Link>
          )
        }
      />

      <div className="stagger mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Consommation d'eau" value={`${num(sum((r) => r.water_consumption), 2)} m³`}
                  tone="brand" icon={<Droplets className="size-5" />} />
        <StatCard label="Montant eau" value={money(sum((r) => r.water_amount))} tone="brand" />
        <StatCard label="Consommation électrique" value={`${num(sum((r) => r.elec_consumption), 2)} kWh`}
                  tone="warn" icon={<Zap className="size-5" />} />
        <StatCard label="Montant électricité" value={money(sum((r) => r.elec_amount))} tone="warn" />
      </div>

      <FilterBar>
        <SearchFilter placeholder="Bien, locataire…" />
        <MonthFilter />
        <SelectFilter
          paramName="bien"
          label="Bien"
          allLabel="Tous les biens"
          options={properties.map((p) => ({ value: p.id, label: `${p.reference} — ${p.name}` }))}
        />
        <ResetFilters />
      </FilterBar>

      {error && (
        <div role="alert" className="card border-bad-100 bg-bad-50 p-4 text-bad-700">
          Impossible de charger les relevés : {error.message}
        </div>
      )}

      {readings.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Gauge className="size-7" />}
            title={filtered ? 'Aucun relevé pour cette sélection' : 'Aucun relevé enregistré'}
            description="Saisissez l'ancien et le nouvel index de chaque compteur : la consommation et le montant à refacturer se calculent automatiquement."
            action={
              user.canWrite && (
                <Link href="/releves/nouveau" className="btn-primary">
                  <Plus className="size-5" aria-hidden />
                  Nouveau relevé
                </Link>
              )
            }
          />
        </div>
      ) : (
        <div className="card reveal table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mois</th><th>Bien</th><th>Locataire</th>
                <th className="text-right">Eau</th>
                <th className="text-right">Électricité</th>
                <th className="text-right">Total</th>
                <th>Relevé le</th>
                {user.canWrite && <th className="no-print"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap font-medium">{monthLabel(r.period_month)}</td>
                  <td>
                    <Link href={`/biens/${r.property_id}`} className="text-ink-800 hover:text-brand-700">
                      {r.property_name}
                    </Link>
                    <span className="block text-sm text-ink-500">{r.property_reference}</span>
                  </td>
                  <td className="whitespace-nowrap">
                    {r.tenant_id ? (
                      <Link href={`/locataires/${r.tenant_id}`} className="text-ink-800 hover:text-brand-700">
                        {r.tenant_first_name} {r.tenant_last_name}
                      </Link>
                    ) : <span className="text-ink-400">—</span>}
                  </td>
                  <td className="num">
                    <span className="block font-semibold text-brand-700">{money(r.water_amount)}</span>
                    <span className="block text-sm text-ink-500">{num(r.water_consumption, 2)} m³</span>
                  </td>
                  <td className="num">
                    <span className="block font-semibold text-warn-700">{money(r.elec_amount)}</span>
                    <span className="block text-sm text-ink-500">{num(r.elec_consumption, 2)} kWh</span>
                  </td>
                  <td className="num font-bold text-ink-900">{money(r.total_amount)}</td>
                  <td className="whitespace-nowrap text-ink-600">{date(r.reading_date)}</td>
                  {user.canWrite && (
                    <td className="no-print">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/releves/${r.id}/modifier`} className="btn-ghost btn-sm text-ink-600">
                          Modifier
                        </Link>
                        <DeleteButton
                          compact
                          action={deleteReading.bind(null, r.id)}
                          title="Supprimer ce relevé"
                          description={`Le relevé de ${monthLabel(r.period_month)} pour ${r.property_name} sera supprimé.`}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total</td>
                <td className="num text-brand-700">{money(sum((r) => r.water_amount))}</td>
                <td className="num text-warn-700">{money(sum((r) => r.elec_amount))}</td>
                <td className="num">{money(sum((r) => r.total_amount))}</td>
                <td />
                {user.canWrite && <td className="no-print" />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
