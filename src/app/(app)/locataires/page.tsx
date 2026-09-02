import type { Metadata } from 'next'
import Link from 'next/link'
import { Phone, Plus, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { FilterBar, ResetFilters, SearchFilter, SelectFilter } from '@/components/ui/Filters'
import { money } from '@/lib/format'
import type { Contract, Property, Tenant, TenantStats } from '@/lib/types'

export const metadata: Metadata = { title: 'Locataires' }

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; etat?: string }>
}) {
  const { q, etat } = await searchParams
  const supabase = await createClient()

  let query = supabase.from('tenants').select('*').order('last_name').order('first_name')

  if (q) {
    const like = `%${q}%`
    query = query.or(
      `first_name.ilike.${like},last_name.ilike.${like},cin.ilike.${like},phone.ilike.${like},email.ilike.${like}`,
    )
  }

  const [{ data: tenantRows, error }, { data: statRows }, { data: contractRows }] = await Promise.all([
    query,
    supabase.from('v_tenant_stats').select('*'),
    supabase.from('contracts')
      .select('id, tenant_id, property_id, monthly_rent, properties(name, reference)')
      .eq('status', 'actif'),
  ])

  const stats = new Map<string, TenantStats>(
    rows<TenantStats>(statRows).map((s) => [s.tenant_id, s]),
  )
  type ActiveContract = Pick<Contract, 'id' | 'tenant_id' | 'property_id' | 'monthly_rent'> & {
    properties: Pick<Property, 'name' | 'reference'> | null
  }
  const activeByTenant = new Map<string, ActiveContract>(
    rows<ActiveContract>(contractRows).map((c) => [c.tenant_id, c]),
  )

  let tenants = rows<Tenant>(tenantRows)
  if (etat === 'actif') tenants = tenants.filter((t) => activeByTenant.has(t.id))
  if (etat === 'sans_contrat') tenants = tenants.filter((t) => !activeByTenant.has(t.id))
  if (etat === 'impaye') tenants = tenants.filter((t) => (stats.get(t.id)?.total_impayes ?? 0) > 0)

  const filtered = Boolean(q || etat)

  return (
    <>
      <PageHeader
        title="Locataires"
        subtitle={tenants.length > 0 ? `${tenants.length} locataire${tenants.length > 1 ? 's' : ''}` : 'Vos locataires actuels et passés'}
        actions={
          <Link href="/locataires/nouveau" className="btn-primary">
            <Plus className="size-5" aria-hidden />
            Ajouter un locataire
          </Link>
        }
      />

      <FilterBar>
        <SearchFilter placeholder="Nom, CIN, téléphone, email…" />
        <SelectFilter
          paramName="etat"
          label="Situation"
          allLabel="Tous les locataires"
          options={[
            { value: 'actif', label: 'Avec contrat actif' },
            { value: 'sans_contrat', label: 'Sans contrat actif' },
            { value: 'impaye', label: 'Avec impayés' },
          ]}
        />
        <ResetFilters />
      </FilterBar>

      {error && (
        <div role="alert" className="card border-bad-100 bg-bad-50 p-4 text-bad-700">
          Impossible de charger les locataires : {error.message}
        </div>
      )}

      {tenants.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users className="size-7" />}
            title={filtered ? 'Aucun locataire ne correspond à cette recherche' : 'Aucun locataire enregistré'}
            description={
              filtered
                ? 'Modifiez ou réinitialisez les filtres pour voir davantage de résultats.'
                : 'Ajoutez un locataire, puis créez un contrat pour le rattacher à un bien.'
            }
            action={
              !filtered && (
                <Link href="/locataires/nouveau" className="btn-primary">
                  <Plus className="size-5" aria-hidden />
                  Ajouter un locataire
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
                <th>Locataire</th>
                <th>CIN</th>
                <th>Téléphone</th>
                <th>Bien loué</th>
                <th className="text-right">Total payé</th>
                <th className="text-right">Impayés</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                const s = stats.get(t.id)
                const contract = activeByTenant.get(t.id)
                const impayes = Number(s?.total_impayes ?? 0)
                return (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/locataires/${t.id}`} className="flex items-center gap-3 group">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                          {t.first_name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink-900 group-hover:text-brand-700">
                            {t.first_name} {t.last_name}
                          </span>
                          {t.profession && <span className="block truncate text-sm text-ink-500">{t.profession}</span>}
                        </span>
                      </Link>
                    </td>
                    <td className="tabular-nums text-ink-600">{t.cin ?? '—'}</td>
                    <td className="whitespace-nowrap text-ink-600">
                      {t.phone ? (
                        <a href={`tel:${t.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand-700">
                          <Phone className="size-4 text-ink-400" aria-hidden />
                          {t.phone}
                        </a>
                      ) : '—'}
                    </td>
                    <td>
                      {contract ? (
                        <Link href={`/biens/${contract.property_id}`} className="link">
                          {contract.properties?.name ?? contract.properties?.reference}
                        </Link>
                      ) : (
                        <Badge tone="neutral" dot={false}>Sans contrat</Badge>
                      )}
                    </td>
                    <td className="text-right tabular-nums text-ok-700">{money(s?.total_paye ?? 0)}</td>
                    <td className="text-right tabular-nums">
                      {impayes > 0
                        ? <span className="font-bold text-bad-700">{money(impayes)}</span>
                        : <span className="text-ink-400">—</span>}
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
