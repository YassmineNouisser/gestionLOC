import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { row, rows } from '@/lib/supabase/rows'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatCard } from '@/components/ui/StatCard'
import { PropertyStatusBadge } from '@/components/ui/Badge'
import { FilterBar, SelectFilter } from '@/components/ui/Filters'
import { ChartCard } from '@/components/charts/ChartCard'
import { YieldByPropertyChart } from '@/components/charts/MonthlyCharts'
import { money, percent } from '@/lib/format'
import type { DashboardStats, PropertyStats } from '@/lib/types'

export const metadata: Metadata = { title: 'Rentabilité' }
export const dynamic = 'force-dynamic'

type SortKey = 'rentabilite' | 'revenu_net' | 'revenus' | 'depenses' | 'investissement' | 'nom'

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'rentabilite', label: 'Rentabilité nette (décroissante)' },
  { value: 'revenu_net', label: 'Revenu net (décroissant)' },
  { value: 'revenus', label: 'Revenus (décroissants)' },
  { value: 'depenses', label: 'Dépenses (décroissantes)' },
  { value: 'investissement', label: 'Investissement (décroissant)' },
  { value: 'nom', label: 'Nom du bien (A → Z)' },
]

function sortProperties(list: PropertyStats[], key: SortKey): PropertyStats[] {
  const byNumber = (get: (p: PropertyStats) => number | null) =>
    [...list].sort((a, b) => {
      const av = get(a)
      const bv = get(b)
      // Les biens sans valeur calculable restent en fin de classement.
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return bv - av
    })

  switch (key) {
    case 'revenu_net': return byNumber((p) => Number(p.revenu_net_12m))
    case 'revenus': return byNumber((p) => Number(p.revenus_12m))
    case 'depenses': return byNumber((p) => Number(p.depenses_12m))
    case 'investissement': return byNumber((p) => Number(p.total_investment))
    case 'nom': return [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    default: return byNumber((p) => (p.rentabilite_nette === null ? null : Number(p.rentabilite_nette)))
  }
}

export default async function ProfitabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ tri?: string }>
}) {
  const { tri } = await searchParams
  const supabase = await createClient()

  const [{ data: statRows, error }, { data: dashRow }] = await Promise.all([
    supabase.from('v_property_stats').select('*'),
    supabase.from('v_dashboard').select('*').maybeSingle(),
  ])

  const sortKey = (SORTS.find((s) => s.value === tri)?.value ?? 'rentabilite') as SortKey
  const properties = sortProperties(rows<PropertyStats>(statRows), sortKey)
  const dash = row<DashboardStats>(dashRow)

  const totals = properties.reduce(
    (acc, p) => ({
      investissement: acc.investissement + Number(p.total_investment),
      revenus: acc.revenus + Number(p.revenus_12m),
      depenses: acc.depenses + Number(p.depenses_12m),
      net: acc.net + Number(p.revenu_net_12m),
    }),
    { investissement: 0, revenus: 0, depenses: 0, net: 0 },
  )

  const chartData = properties
    .filter((p) => p.rentabilite_nette !== null)
    .map((p) => ({
      name: p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name,
      rentabilite: Number(p.rentabilite_nette),
    }))

  const best = properties.find((p) => p.rentabilite_nette !== null)

  return (
    <>
      <PageHeader
        title="Rentabilité"
        subtitle="Calculs sur les 12 derniers mois glissants · Rentabilité nette = revenu net annuel ÷ investissement total × 100"
      />

      {error && (
        <div role="alert" className="card mb-6 border-bad-100 bg-bad-50 p-4 text-bad-700">
          Impossible de charger la rentabilité : {error.message}
        </div>
      )}

      <div className="stagger mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Investissement total" value={money(totals.investissement)}
                  icon={<Building2 className="size-5" />} />
        <StatCard label="Revenus (12 mois)" value={money(totals.revenus)} tone="ok" />
        <StatCard label="Dépenses (12 mois)" value={money(totals.depenses)} tone="warn" />
        <StatCard label="Rentabilité globale"
                  value={dash?.rentabilite_globale != null ? percent(dash.rentabilite_globale) : '—'}
                  hint={`Revenu net : ${money(totals.net)}`}
                  tone="brand" icon={<TrendingUp className="size-5" />} />
      </div>

      {properties.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<TrendingUp className="size-7" />}
            title="Aucun bien à analyser"
            description="Ajoutez un bien avec son prix d'achat pour voir sa rentabilité se calculer automatiquement."
            action={<Link href="/biens/nouveau" className="btn-primary">Ajouter un bien</Link>}
          />
        </div>
      ) : (
        <>
          {chartData.length > 0 && (
            <div className="mb-6">
              <ChartCard
                title="Classement par rentabilité nette"
                subtitle={best ? `Meilleur rendement : ${best.name} (${percent(best.rentabilite_nette)})` : undefined}
              >
                <YieldByPropertyChart data={chartData} />
              </ChartCard>
            </div>
          )}

          <FilterBar>
            <SelectFilter paramName="tri" label="Trier par" options={SORTS} allLabel="Rentabilité nette (décroissante)" />
          </FilterBar>

          <div className="card reveal table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Bien</th><th>Statut</th>
                  <th className="text-right">Investissement</th>
                  <th className="text-right">Revenus 12 m</th>
                  <th className="text-right">Dépenses 12 m</th>
                  <th className="text-right">Revenu net</th>
                  <th className="text-right">Rent. nette</th>
                  <th className="text-right">Rent. brute</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr key={p.property_id}>
                    <td>
                      <Link href={`/biens/${p.property_id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                        {p.name}
                      </Link>
                      <span className="block text-sm text-ink-500">{p.reference}{p.city && ` · ${p.city}`}</span>
                    </td>
                    <td><PropertyStatusBadge status={p.status} /></td>
                    <td className="text-right tabular-nums">{money(p.total_investment)}</td>
                    <td className="text-right tabular-nums text-ok-700">{money(p.revenus_12m)}</td>
                    <td className="text-right tabular-nums text-warn-700">{money(p.depenses_12m)}</td>
                    <td className={`text-right font-semibold tabular-nums ${Number(p.revenu_net_12m) >= 0 ? 'text-ink-900' : 'text-bad-700'}`}>
                      {money(p.revenu_net_12m)}
                    </td>
                    <td className="text-right font-bold tabular-nums">
                      {p.rentabilite_nette != null
                        ? <span className={Number(p.rentabilite_nette) >= 0 ? 'text-brand-700' : 'text-bad-700'}>
                            {percent(p.rentabilite_nette)}
                          </span>
                        : <span className="text-ink-400">—</span>}
                    </td>
                    <td className="text-right tabular-nums text-ink-600">{percent(p.rentabilite_brute)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-ink-50">
                  <td colSpan={2} className="px-4 py-3 font-bold text-ink-800">Total du patrimoine</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{money(totals.investissement)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-ok-700">{money(totals.revenus)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-warn-700">{money(totals.depenses)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{money(totals.net)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-brand-700">
                    {dash?.rentabilite_globale != null ? percent(dash.rentabilite_globale) : '—'}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </>
  )
}
