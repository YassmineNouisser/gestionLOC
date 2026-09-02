import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge, ContractStatusBadge } from '@/components/ui/Badge'
import { FilterBar, ResetFilters, SearchFilter, SelectFilter } from '@/components/ui/Filters'
import { CONTRACT_STATUS, date, money } from '@/lib/format'
import type { Contract, Property, Tenant } from '@/lib/types'

export const metadata: Metadata = { title: 'Contrats' }

type ContractRow = Contract & {
  properties: Pick<Property, 'id' | 'name' | 'reference'> | null
  tenants: Pick<Tenant, 'id' | 'first_name' | 'last_name' | 'phone'> | null
}

/** Nombre de jours avant expiration, ou null si sans date de fin. */
function daysLeft(endDate: string | null): number | null {
  if (!endDate) return null
  const end = new Date(`${endDate}T00:00:00Z`).getTime()
  const today = new Date()
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((end - start) / 86_400_000)
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; bien?: string }>
}) {
  const { q, statut, bien } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('contracts')
    .select('*, properties(id, name, reference), tenants(id, first_name, last_name, phone)')
    .order('status')
    .order('start_date', { ascending: false })

  if (statut) query = query.eq('status', statut)
  if (bien) query = query.eq('property_id', bien)

  const { data, error } = await query
  let contracts = rows<ContractRow>(data)

  // Recherche sur le nom du locataire et du bien (relations imbriquées :
  // le filtrage se fait côté application pour rester simple et prévisible).
  if (q) {
    const needle = q.toLowerCase()
    contracts = contracts.filter((c) =>
      [
        c.properties?.name, c.properties?.reference,
        c.tenants?.first_name, c.tenants?.last_name, c.tenants?.phone,
      ].some((v) => v?.toLowerCase().includes(needle)),
    )
  }

  const filtered = Boolean(q || statut || bien)
  const activeCount = contracts.filter((c) => c.status === 'actif').length

  return (
    <>
      <PageHeader
        title="Contrats"
        subtitle={contracts.length > 0 ? `${contracts.length} contrat${contracts.length > 1 ? 's' : ''} · ${activeCount} actif${activeCount > 1 ? 's' : ''}` : 'Les baux reliant vos biens à vos locataires'}
        actions={
          <Link href="/contrats/nouveau" className="btn-primary">
            <Plus className="size-5" aria-hidden />
            Nouveau contrat
          </Link>
        }
      />

      <FilterBar>
        <SearchFilter placeholder="Locataire, bien, téléphone…" />
        <SelectFilter
          paramName="statut"
          label="Statut"
          allLabel="Tous les statuts"
          options={Object.entries(CONTRACT_STATUS).map(([value, label]) => ({ value, label }))}
        />
        <ResetFilters />
      </FilterBar>

      {error && (
        <div role="alert" className="card border-bad-100 bg-bad-50 p-4 text-bad-700">
          Impossible de charger les contrats : {error.message}
        </div>
      )}

      {contracts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FileText className="size-7" />}
            title={filtered ? 'Aucun contrat ne correspond à cette recherche' : 'Aucun contrat enregistré'}
            description={
              filtered
                ? 'Modifiez ou réinitialisez les filtres pour voir davantage de résultats.'
                : "Créez un contrat pour relier un bien à un locataire. Les loyers mensuels seront générés automatiquement."
            }
            action={
              !filtered && (
                <Link href="/contrats/nouveau" className="btn-primary">
                  <Plus className="size-5" aria-hidden />
                  Nouveau contrat
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
                <th>Bien</th><th>Locataire</th><th>Période</th>
                <th className="text-right">Loyer + charges</th><th>Échéance</th><th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const left = c.status === 'actif' ? daysLeft(c.end_date) : null
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/contrats/${c.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                        {c.properties?.name ?? '—'}
                      </Link>
                      <span className="block text-sm text-ink-500">{c.properties?.reference}</span>
                    </td>
                    <td className="whitespace-nowrap">
                      <Link href={`/locataires/${c.tenant_id}`} className="link">
                        {c.tenants ? `${c.tenants.first_name} ${c.tenants.last_name}` : '—'}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-ink-600">
                      {date(c.start_date)} → {c.end_date ? date(c.end_date) : 'Indéterminée'}
                    </td>
                    <td className="text-right font-semibold tabular-nums">
                      {money(Number(c.monthly_rent) + Number(c.charges))}
                    </td>
                    <td className="whitespace-nowrap text-ink-600">Le {c.due_day}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ContractStatusBadge status={c.status} />
                        {left !== null && left >= 0 && left <= 60 && (
                          <Badge tone="warn">Expire dans {left} j</Badge>
                        )}
                        {left !== null && left < 0 && <Badge tone="bad">Expiré</Badge>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
