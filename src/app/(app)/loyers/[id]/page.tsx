import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarClock, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { row, rows } from '@/lib/supabase/rows'
import { requireUser } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { RentStatusBadge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { DocumentsPanel } from '@/components/documents/DocumentsPanel'
import { PaymentDialog } from '@/components/payments/PaymentDialog'
import { PaymentEditDialog } from '@/components/payments/PaymentEditDialog'
import { ReceiptButton } from '@/components/payments/ReceiptButton'
import { deletePayment } from '@/lib/actions/payments'
import { PAYMENT_METHOD, date, money, monthLabel } from '@/lib/format'
import type { DocumentRow, Payment, RentView } from '@/lib/types'

export const metadata: Metadata = { title: 'Loyer' }

export default async function RentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const supabase = await createClient()

  const { data } = await supabase.from('v_rents').select('*').eq('id', id).maybeSingle()
  const rent = row<RentView>(data)
  if (!rent) notFound()

  const [{ data: paymentRows }, { data: propertyRow }, { data: docRows }] = await Promise.all([
    supabase.from('payments').select('*').eq('rent_id', id)
      .order('payment_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('properties').select('address').eq('id', rent.property_id).maybeSingle(),
    supabase.from('documents').select('*').eq('entity_type', 'payment').eq('entity_id', id)
      .order('created_at', { ascending: false }),
  ])

  const payments = rows<Payment>(paymentRows)
  const documents = rows<DocumentRow>(docRows)
  const tenantLabel = `${rent.tenant_first_name} ${rent.tenant_last_name}`
  const address = (propertyRow as { address: string | null } | null)?.address ?? null

  return (
    <>
      <Link href="/loyers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux loyers
      </Link>

      <PageHeader
        title={`Loyer de ${monthLabel(rent.period_month)}`}
        subtitle={`${rent.property_name} · ${tenantLabel}`}
        actions={
          user.canWrite && rent.balance > 0 && (
            <PaymentDialog
              rentId={rent.id}
              periodMonth={rent.period_month}
              balance={Number(rent.balance)}
              amountDue={Number(rent.amount_due)}
              tenantLabel={tenantLabel}
              propertyLabel={rent.property_name}
            />
          )
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <RentStatusBadge status={rent.status} />
        <span className="flex items-center gap-1.5 text-sm text-ink-500">
          <CalendarClock className="size-4" aria-hidden />
          Échéance le {date(rent.due_date)}
        </span>
        {rent.days_overdue > 0 && (
          <span className="text-sm font-semibold text-bad-700">{rent.days_overdue} jours de retard</span>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Montant dû" value={money(rent.amount_due)} />
        <StatCard
          label="Total payé"
          value={money(rent.amount_paid)}
          hint={`${payments.length} paiement${payments.length > 1 ? 's' : ''}`}
          tone="ok"
          icon={<Wallet className="size-5" />}
        />
        <StatCard
          label="Reste à payer"
          value={money(rent.balance)}
          hint="Reste = Montant dû − Total des paiements"
          tone={rent.balance > 0 ? (rent.is_overdue ? 'bad' : 'warn') : 'ok'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <section className="card">
            <h2 className="border-b border-ink-100 px-5 py-4 text-[17px] font-bold text-ink-900">
              Paiements enregistrés
            </h2>

            {payments.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-[15px] text-ink-500">Aucun paiement pour ce mois.</p>
                {user.canWrite && (
                  <div className="mt-4 flex justify-center">
                    <PaymentDialog
                      rentId={rent.id}
                      periodMonth={rent.period_month}
                      balance={Number(rent.balance)}
                      amountDue={Number(rent.amount_due)}
                      tenantLabel={tenantLabel}
                      propertyLabel={rent.property_name}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Mode</th><th>Référence</th>
                      <th className="text-right">Montant</th>
                      <th className="no-print"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap font-medium">{date(p.payment_date)}</td>
                        <td className="text-ink-600">{PAYMENT_METHOD[p.method]}</td>
                        <td className="text-ink-500">
                          {p.reference ?? '—'}
                          {p.note && <span className="block text-xs text-ink-400">{p.note}</span>}
                        </td>
                        <td className="text-right font-semibold tabular-nums text-ok-700">{money(p.amount)}</td>
                        <td className="no-print">
                          <div className="flex items-center justify-end gap-0.5">
                            <ReceiptButton
                              data={{
                                paymentId: p.id,
                                amount: Number(p.amount),
                                paymentDate: p.payment_date,
                                method: p.method,
                                reference: p.reference,
                                periodMonth: rent.period_month,
                                amountDue: Number(rent.amount_due),
                                amountPaid: Number(rent.amount_paid),
                                balance: Number(rent.balance),
                                tenantName: tenantLabel,
                                tenantCin: rent.tenant_cin,
                                propertyName: rent.property_name,
                                propertyReference: rent.property_reference,
                                propertyAddress: address,
                              }}
                            />
                            {user.canWrite && (
                              <>
                                <PaymentEditDialog payment={p} />
                                <DeleteButton
                                  compact
                                  action={deletePayment.bind(null, p.id)}
                                  title="Supprimer ce paiement"
                                  description={`Le paiement de ${money(p.amount)} du ${date(p.payment_date)} sera supprimé. Le reste à payer sera recalculé automatiquement.`}
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
                      <td colSpan={3} className="px-4 py-3 font-bold text-ink-800">Total encaissé</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-ok-700">
                        {money(rent.amount_paid)}
                      </td>
                      <td className="no-print" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 text-[17px] font-bold text-ink-900">Détails</h2>
            <dl className="divide-y divide-ink-100">
              {[
                ['Période', monthLabel(rent.period_month)],
                ['Bien', rent.property_name],
                ['Référence', rent.property_reference],
                ['Locataire', tenantLabel],
                ['Téléphone', rent.tenant_phone ?? '—'],
                ['Échéance', date(rent.due_date)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="shrink-0 text-sm text-ink-500">{label}</dt>
                  <dd className="text-right font-medium text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/biens/${rent.property_id}`} className="btn-secondary btn-sm">Voir le bien</Link>
              <Link href={`/locataires/${rent.tenant_id}`} className="btn-secondary btn-sm">Voir le locataire</Link>
              <Link href={`/contrats/${rent.contract_id}`} className="btn-secondary btn-sm">Voir le contrat</Link>
            </div>
          </section>

          <DocumentsPanel
            entityType="payment"
            entityId={id}
            documents={documents}
            defaultDocType="recu"
            title="Justificatifs"
            canWrite={user.canWrite}
          />
        </div>
      </div>
    </>
  )
}
