import type { Metadata } from 'next'
import Link from 'next/link'
import { Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import { requireUser } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatCard } from '@/components/ui/StatCard'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { FilterBar, MonthFilter, ResetFilters, SearchFilter, SelectFilter } from '@/components/ui/Filters'
import { PaymentEditDialog } from '@/components/payments/PaymentEditDialog'
import { ReceiptButton } from '@/components/payments/ReceiptButton'
import { deletePayment } from '@/lib/actions/payments'
import { PAYMENT_METHOD, date, money, monthLabel, shiftMonth } from '@/lib/format'
import type { Payment, Property, Tenant } from '@/lib/types'

export const metadata: Metadata = { title: 'Paiements' }

type PaymentRow = Payment & {
  rents: { period_month: string; amount_due: number; amount_paid: number } | null
  properties: Pick<Property, 'id' | 'name' | 'reference' | 'address'> | null
  tenants: Pick<Tenant, 'id' | 'first_name' | 'last_name' | 'cin'> | null
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mois?: string; mode?: string; bien?: string; locataire?: string }>
}) {
  const { q, mois, mode, bien, locataire } = await searchParams
  const user = await requireUser()
  const supabase = await createClient()

  let query = supabase
    .from('payments')
    .select(`
      *,
      rents(period_month, amount_due, amount_paid),
      properties(id, name, reference, address),
      tenants(id, first_name, last_name, cin)
    `)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)

  // Le filtre "mois" porte sur la date d'encaissement.
  if (mois) {
    query = query.gte('payment_date', mois).lt('payment_date', shiftMonth(mois, 1))
  }
  if (mode) query = query.eq('method', mode)
  if (bien) query = query.eq('property_id', bien)
  if (locataire) query = query.eq('tenant_id', locataire)

  const [{ data, error }, { data: propertyRows }] = await Promise.all([
    query,
    supabase.from('properties').select('id, reference, name').order('reference'),
  ])

  let payments = rows<PaymentRow>(data)
  if (q) {
    const needle = q.toLowerCase()
    payments = payments.filter((p) =>
      [
        p.tenants?.first_name, p.tenants?.last_name, p.tenants?.cin,
        p.properties?.name, p.properties?.reference, p.reference,
      ].some((v) => v?.toLowerCase().includes(needle)),
    )
  }

  const properties = rows<Pick<Property, 'id' | 'reference' | 'name'>>(propertyRows)
  const total = payments.reduce((s, p) => s + Number(p.amount), 0)
  const filtered = Boolean(q || mois || mode || bien || locataire)

  return (
    <>
      <PageHeader
        title="Paiements"
        subtitle={mois ? `Encaissements de ${monthLabel(mois)}` : 'Tous les encaissements'}
      />

      <div className="stagger mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Total encaissé"
          value={money(total)}
          hint={`${payments.length} paiement${payments.length > 1 ? 's' : ''}`}
          tone="ok"
          icon={<Wallet className="size-5" />}
        />
        <StatCard
          label="Paiement moyen"
          value={money(payments.length ? total / payments.length : 0)}
        />
      </div>

      <FilterBar>
        <SearchFilter placeholder="Locataire, bien, référence…" />
        <MonthFilter label="Mois d'encaissement" />
        <SelectFilter
          paramName="mode"
          label="Mode de paiement"
          allLabel="Tous les modes"
          options={Object.entries(PAYMENT_METHOD).map(([value, label]) => ({ value, label }))}
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
          Impossible de charger les paiements : {error.message}
        </div>
      )}

      {payments.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Wallet className="size-7" />}
            title={filtered ? 'Aucun paiement pour cette sélection' : 'Aucun paiement enregistré'}
            description="Les paiements se saisissent depuis la fiche d'un loyer, ce qui met à jour automatiquement le reste à payer et le statut."
            action={<Link href="/loyers" className="btn-primary">Aller aux loyers</Link>}
          />
        </div>
      ) : (
        <div className="card reveal table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th><th>Mois concerné</th><th>Bien</th><th>Locataire</th>
                <th>Mode</th><th>Référence</th><th className="text-right">Montant</th>
                <th className="no-print"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap font-medium">{date(p.payment_date)}</td>
                  <td className="whitespace-nowrap">
                    <Link href={`/loyers/${p.rent_id}`} className="link">
                      {monthLabel(p.rents?.period_month ?? null)}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/biens/${p.property_id}`} className="text-ink-800 hover:text-brand-700">
                      {p.properties?.name ?? '—'}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">
                    <Link href={`/locataires/${p.tenant_id}`} className="text-ink-800 hover:text-brand-700">
                      {p.tenants ? `${p.tenants.first_name} ${p.tenants.last_name}` : '—'}
                    </Link>
                  </td>
                  <td className="text-ink-600">{PAYMENT_METHOD[p.method]}</td>
                  <td className="text-ink-500">{p.reference ?? '—'}</td>
                  <td className="text-right font-semibold tabular-nums text-ok-700">{money(p.amount)}</td>
                  <td className="no-print">
                    <div className="flex items-center justify-end gap-0.5">
                      <ReceiptButton
                        label=""
                        data={{
                          paymentId: p.id,
                          amount: Number(p.amount),
                          paymentDate: p.payment_date,
                          method: p.method,
                          reference: p.reference,
                          periodMonth: p.rents?.period_month ?? p.payment_date,
                          amountDue: Number(p.rents?.amount_due ?? 0),
                          amountPaid: Number(p.rents?.amount_paid ?? 0),
                          balance: Number(p.rents?.amount_due ?? 0) - Number(p.rents?.amount_paid ?? 0),
                          tenantName: p.tenants ? `${p.tenants.first_name} ${p.tenants.last_name}` : '—',
                          tenantCin: p.tenants?.cin ?? null,
                          propertyName: p.properties?.name ?? '—',
                          propertyReference: p.properties?.reference ?? '',
                          propertyAddress: p.properties?.address ?? null,
                        }}
                      />
                      {user.canWrite && (
                        <>
                          <PaymentEditDialog payment={p} />
                          <DeleteButton
                            compact
                            action={deletePayment.bind(null, p.id)}
                            title="Supprimer ce paiement"
                            description={`Le paiement de ${money(p.amount)} du ${date(p.payment_date)} sera supprimé. Le reste à payer du loyer sera recalculé automatiquement.`}
                          />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-ink-50">
                <td colSpan={6} className="px-4 py-3 font-bold text-ink-800">Total</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-ok-700">{money(total)}</td>
                <td className="no-print" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
