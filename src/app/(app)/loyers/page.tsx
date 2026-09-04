import type { Metadata } from 'next'
import Link from 'next/link'
import { KeyRound, Receipt, TriangleAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import { requireUser } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { DepositStatusBadge, RentStatusBadge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { FilterBar, MonthFilter, ResetFilters, SearchFilter, SelectFilter } from '@/components/ui/Filters'
import { PaymentDialog } from '@/components/payments/PaymentDialog'
import { PayRemainingButton } from '@/components/payments/PayRemainingButton'
import { DepositDialog } from '@/components/deposits/DepositDialog'
import { RENT_STATUS, date, firstOfMonth, money, monthLabel } from '@/lib/format'
import type { ContractDeposit, Property, RentView } from '@/lib/types'

export const metadata: Metadata = { title: 'Loyers' }

export default async function RentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mois?: string; statut?: string; bien?: string; locataire?: string }>
}) {
  const { q, mois, statut, bien, locataire } = await searchParams
  const user = await requireUser()
  const supabase = await createClient()

  // Filet de sécurité : crée les loyers du mois si un nouveau mois a commencé.
  // Idempotent, et volontairement limité aux écrans où l'absence se verrait.
  await supabase.rpc('generate_rents')

  // Sans filtre de mois : on affiche le mois courant, sauf si l'on cible
  // explicitement les impayés (qui couvrent toutes les périodes).
  const showAllMonths = mois === 'tous' || statut === 'impaye' || Boolean(locataire || bien)
  const period = mois && mois !== 'tous' ? mois : showAllMonths ? null : firstOfMonth()

  let query = supabase.from('v_rents').select('*')
    .order('period_month', { ascending: false })
    .order('property_reference')

  if (period) query = query.eq('period_month', period)
  if (bien) query = query.eq('property_id', bien)
  if (locataire) query = query.eq('tenant_id', locataire)
  if (statut) {
    // Le statut est calculé dans la vue : on le filtre côté application.
    query = query.limit(2000)
  } else {
    query = query.limit(500)
  }

  const [{ data, error }, { data: propertyRows }, { data: depositRows }] = await Promise.all([
    query,
    supabase.from('properties').select('id, reference, name').order('reference'),
    supabase.from('v_contract_deposits').select('*')
      .eq('contract_status', 'actif')
      .order('property_reference'),
  ])

  let rents = rows<RentView>(data)
  if (statut) rents = rents.filter((r) => r.status === statut)
  if (q) {
    const needle = q.toLowerCase()
    rents = rents.filter((r) =>
      [r.tenant_first_name, r.tenant_last_name, r.property_name, r.property_reference, r.tenant_cin]
        .some((v) => v?.toLowerCase().includes(needle)),
    )
  }

  const properties = rows<Pick<Property, 'id' | 'reference' | 'name'>>(propertyRows)

  // Cautions des contrats en cours. Sans rapport avec le mois affiché :
  // une caution se verse une fois, elle n'est pas mensuelle.
  const deposits = rows<ContractDeposit>(depositRows)
    .filter((d) => Number(d.deposit_due) > 0 || Number(d.deposit_paid) > 0)
  const depositDue = deposits.reduce((s, d) => s + Number(d.deposit_due), 0)
  const depositPaid = deposits.reduce((s, d) => s + Number(d.deposit_paid), 0)
  const depositBalance = deposits.reduce((s, d) => s + Number(d.deposit_balance), 0)

  const totalDu = rents.reduce((s, r) => s + Number(r.amount_due), 0)
  const totalPaye = rents.reduce((s, r) => s + Number(r.amount_paid), 0)
  const totalReste = rents.reduce((s, r) => s + Number(r.balance), 0)
  const totalImpaye = rents.filter((r) => r.is_overdue).reduce((s, r) => s + Number(r.balance), 0)

  const subtitle = period
    ? monthLabel(period)
    : statut === 'impaye' ? 'Tous les impayés' : 'Toutes périodes'

  return (
    <>
      <PageHeader
        title="Loyers"
        subtitle={`${subtitle} · ${rents.length} loyer${rents.length > 1 ? 's' : ''}`}
      />

      <div className="stagger mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total dû" value={money(totalDu)} icon={<Receipt className="size-5" />} />
        <StatCard label="Encaissé" value={money(totalPaye)} tone="ok" />
        <StatCard label="Reste à percevoir" value={money(totalReste)} tone={totalReste > 0 ? 'warn' : 'default'} />
        <StatCard
          label="Dont impayés"
          value={money(totalImpaye)}
          hint="Échéance dépassée"
          tone={totalImpaye > 0 ? 'bad' : 'default'}
          icon={<TriangleAlert className="size-5" />}
        />
      </div>

      {deposits.length > 0 && (
        <section className="card reveal mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink-900">
              <KeyRound className="size-5 text-ink-400" aria-hidden />
              Cautions des contrats en cours
            </h2>
            <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-500">
              <span>Total <strong className="text-ink-900">{money(depositDue)}</strong></span>
              <span>Versé <strong className="text-ok-700">{money(depositPaid)}</strong></span>
              <span>
                Reste{' '}
                <strong className={depositBalance > 0 ? 'text-warn-700' : 'text-ok-700'}>
                  {money(depositBalance)}
                </strong>
              </span>
            </p>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Bien</th><th>Locataire</th>
                  <th className="text-right">Caution</th>
                  <th className="text-right">Versé</th>
                  <th className="text-right">Reste</th>
                  <th>Statut</th>
                  {user.canWrite && <th className="no-print"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {deposits.map((d) => (
                  <tr key={d.contract_id}>
                    <td>
                      <Link href={`/contrats/${d.contract_id}`} className="text-ink-800 hover:text-brand-700">
                        {d.property_name}
                      </Link>
                      <span className="block text-sm text-ink-500">{d.property_reference}</span>
                    </td>
                    <td className="whitespace-nowrap">
                      <Link href={`/locataires/${d.tenant_id}`} className="text-ink-800 hover:text-brand-700">
                        {d.tenant_first_name} {d.tenant_last_name}
                      </Link>
                    </td>
                    <td className="num">{money(d.deposit_due)}</td>
                    <td className="num text-ok-700">{money(d.deposit_paid)}</td>
                    <td className={`num font-semibold ${Number(d.deposit_balance) > 0 ? 'text-warn-700' : 'text-ink-400'}`}>
                      {money(d.deposit_balance)}
                    </td>
                    <td><DepositStatusBadge status={d.deposit_status} /></td>
                    {user.canWrite && (
                      <td className="no-print">
                        {Number(d.deposit_balance) > 0 && (
                          <div className="flex justify-end">
                            <DepositDialog
                              compact
                              contractId={d.contract_id}
                              due={Number(d.deposit_due)}
                              paid={Number(d.deposit_paid)}
                              balance={Number(d.deposit_balance)}
                              tenantLabel={`${d.tenant_first_name} ${d.tenant_last_name}`}
                              propertyLabel={d.property_name}
                            />
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <FilterBar>
        <SearchFilter placeholder="Locataire, bien, CIN…" />
        <MonthFilter />
        <SelectFilter
          paramName="statut"
          label="Statut"
          allLabel="Tous les statuts"
          options={Object.entries(RENT_STATUS).map(([value, label]) => ({ value, label }))}
        />
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
          Impossible de charger les loyers : {error.message}
        </div>
      )}

      {rents.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Receipt className="size-7" />}
            title="Aucun loyer pour cette sélection"
            description="Les loyers sont générés automatiquement chaque mois pour chaque contrat actif. Vérifiez la période sélectionnée ou créez un contrat."
            action={<Link href="/contrats/nouveau" className="btn-primary">Créer un contrat</Link>}
          />
        </div>
      ) : (
        <div className="card reveal table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mois</th><th>Bien</th><th>Locataire</th><th>Échéance</th>
                <th className="text-right">Dû</th><th className="text-right">Payé</th>
                <th className="text-right">Reste</th><th>Statut</th>
                {user.canWrite && <th className="no-print"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {rents.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap font-medium">
                    <Link href={`/loyers/${r.id}`} className="link">{monthLabel(r.period_month)}</Link>
                  </td>
                  <td>
                    <Link href={`/biens/${r.property_id}`} className="text-ink-800 hover:text-brand-700">
                      {r.property_name}
                    </Link>
                    <span className="block text-sm text-ink-500">{r.property_reference}</span>
                  </td>
                  <td className="whitespace-nowrap">
                    <Link href={`/locataires/${r.tenant_id}`} className="text-ink-800 hover:text-brand-700">
                      {r.tenant_first_name} {r.tenant_last_name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-ink-600">
                    {date(r.due_date)}
                    {r.days_overdue > 0 && (
                      <span className="block text-xs font-semibold text-bad-600">
                        {r.days_overdue} j de retard
                      </span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{money(r.amount_due)}</td>
                  <td className="text-right tabular-nums text-ok-700">{money(r.amount_paid)}</td>
                  <td className={`text-right font-semibold tabular-nums ${r.balance > 0 ? 'text-bad-700' : 'text-ink-400'}`}>
                    {money(r.balance)}
                  </td>
                  <td><RentStatusBadge status={r.status} /></td>
                  {user.canWrite && (
                    <td className="no-print">
                      {r.balance > 0 && (
                        <div className="flex items-center justify-end gap-1.5">
                          <PaymentDialog
                            rentId={r.id}
                            periodMonth={r.period_month}
                            balance={Number(r.balance)}
                            amountDue={Number(r.amount_due)}
                            tenantLabel={`${r.tenant_first_name} ${r.tenant_last_name}`}
                            propertyLabel={r.property_name}
                            trigger="compact"
                          />
                          <PayRemainingButton rentId={r.id} />
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
