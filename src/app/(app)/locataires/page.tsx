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
import type { Contract, ContractDeposit, Property, Tenant, TenantStats } from '@/lib/types'

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

  const [{ data: tenantRows, error }, { data: statRows }, { data: contractRows }, { data: depositRows }] =
    await Promise.all([
      query,
      supabase.from('v_tenant_stats').select('*'),
      supabase.from('contracts')
        .select('id, tenant_id, property_id, monthly_rent, charges, properties(name, reference)')
        .eq('status', 'actif'),
      supabase.from('v_contract_deposits').select('*'),
    ])

  const stats = new Map<string, TenantStats>(
    rows<TenantStats>(statRows).map((s) => [s.tenant_id, s]),
  )
  type ActiveContract = Pick<Contract, 'id' | 'tenant_id' | 'property_id' | 'monthly_rent' | 'charges'> & {
    properties: Pick<Property, 'name' | 'reference'> | null
  }
  const activeByTenant = new Map<string, ActiveContract>(
    rows<ActiveContract>(contractRows).map((c) => [c.tenant_id, c]),
  )

  /*
   * Cautions cumulées par locataire, tous contrats confondus.
   * Elles restent à l'écart des loyers : une caution se verse une fois au
   * début du bail, l'additionner aux loyers mensuels n'aurait aucun sens.
   */
  const depositByTenant = new Map<string, { due: number; paid: number; balance: number }>()
  for (const d of rows<ContractDeposit>(depositRows)) {
    const acc = depositByTenant.get(d.tenant_id) ?? { due: 0, paid: 0, balance: 0 }
    acc.due += Number(d.deposit_due)
    acc.paid += Number(d.deposit_paid)
    acc.balance += Number(d.deposit_balance)
    depositByTenant.set(d.tenant_id, acc)
  }

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
                <th>Contact</th>
                <th>Bien loué</th>
                <th className="text-right">Loyer mensuel</th>
                <th className="text-right">Loyers dus</th>
                <th className="text-right">Loyers payés</th>
                <th className="text-right">Impayés</th>
                <th className="text-right">Caution</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                const s = stats.get(t.id)
                const contract = activeByTenant.get(t.id)
                const impayes = Number(s?.total_impayes ?? 0)
                const deposit = depositByTenant.get(t.id)
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
                    {/* Téléphone et CIN partagent une colonne : deux repères courts
                        qui servent à identifier, pas à être comparés entre lignes. */}
                    <td className="whitespace-nowrap">
                      {t.phone ? (
                        <a href={`tel:${t.phone}`} className="inline-flex items-center gap-1.5 text-ink-700 hover:text-brand-700">
                          <Phone className="size-4 text-ink-400" aria-hidden />
                          {t.phone}
                        </a>
                      ) : (
                        <span className="text-ink-400">Sans téléphone</span>
                      )}
                      <span className="block text-sm tabular-nums text-ink-500">
                        {t.cin ? `CIN ${t.cin}` : 'CIN non renseignée'}
                      </span>
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
                    <td className="num">
                      {contract ? (
                        <>
                          <span className="block font-semibold text-ink-900">
                            {money(Number(contract.monthly_rent) + Number(contract.charges))}
                          </span>
                          {Number(contract.charges) > 0 && (
                            <span className="block text-sm text-ink-500">
                              dont {money(contract.charges)} de charges
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="num text-ink-800">{money(s?.total_du ?? 0)}</td>
                    <td className="num text-ok-700">{money(s?.total_paye ?? 0)}</td>
                    <td className="num">
                      {impayes > 0
                        ? <span className="font-bold text-bad-700">{money(impayes)}</span>
                        : <span className="text-ink-400">—</span>}
                    </td>
                    <td className="num">
                      {deposit && deposit.due > 0 ? (
                        <>
                          <span className="block font-semibold text-ok-700">
                            {money(deposit.paid)}
                          </span>
                          <span className={`block text-sm ${deposit.balance > 0 ? 'text-warn-700' : 'text-ink-400'}`}>
                            {deposit.balance > 0 ? `reste ${money(deposit.balance)}` : 'versée'}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {tenants.length > 1 && (
              <tfoot>
                <tr>
                  <td colSpan={3}>Total</td>
                  <td className="num">
                    {money(tenants.reduce((sum, t) => {
                      const c = activeByTenant.get(t.id)
                      return sum + (c ? Number(c.monthly_rent) + Number(c.charges) : 0)
                    }, 0))}
                  </td>
                  <td className="num">
                    {money(tenants.reduce((sum, t) => sum + Number(stats.get(t.id)?.total_du ?? 0), 0))}
                  </td>
                  <td className="num text-ok-700">
                    {money(tenants.reduce((sum, t) => sum + Number(stats.get(t.id)?.total_paye ?? 0), 0))}
                  </td>
                  <td className="num text-bad-700">
                    {money(tenants.reduce((sum, t) => sum + Number(stats.get(t.id)?.total_impayes ?? 0), 0))}
                  </td>
                  <td className="num text-ok-700">
                    {money(tenants.reduce((sum, t) => sum + (depositByTenant.get(t.id)?.paid ?? 0), 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </>
  )
}
