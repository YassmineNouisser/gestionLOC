import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Home, KeyRound, Pencil, Receipt, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { row, rows } from '@/lib/supabase/rows'
import { requireUser } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { ContractStatusBadge, DepositStatusBadge, RentStatusBadge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { DocumentsPanel } from '@/components/documents/DocumentsPanel'
import { ContractStatusControl } from '@/components/contracts/ContractStatusControl'
import { DepositDialog } from '@/components/deposits/DepositDialog'
import { deleteContract } from '@/lib/actions/contracts'
import { PAYMENT_METHOD, chargesLabel, date, money, monthLabel } from '@/lib/format'
import type {
  Contract, ContractDeposit, DepositPayment, DocumentRow, Property, RentView, Tenant,
} from '@/lib/types'

export const metadata: Metadata = { title: 'Contrat' }

type ContractDetail = Contract & {
  properties: Property | null
  tenants: Tenant | null
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-900">{value}</dd>
    </div>
  )
}

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const supabase = await createClient()

  const { data } = await supabase
    .from('contracts')
    .select('*, properties(*), tenants(*)')
    .eq('id', id)
    .maybeSingle()

  const contract = row<ContractDetail>(data)
  if (!contract) notFound()

  const [{ data: rentRows }, { data: docRows }, { data: depositRow }, { data: depositPayRows }] =
    await Promise.all([
      supabase.from('v_rents').select('*').eq('contract_id', id)
        .order('period_month', { ascending: false }),
      supabase.from('documents').select('*').eq('entity_type', 'contract').eq('entity_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('v_contract_deposits').select('*').eq('contract_id', id).maybeSingle(),
      supabase.from('deposit_payments').select('*').eq('contract_id', id)
        .order('payment_date', { ascending: false }),
    ])

  const rents = rows<RentView>(rentRows)
  const documents = rows<DocumentRow>(docRows)
  const deposit = row<ContractDeposit>(depositRow)
  const depositPayments = rows<DepositPayment>(depositPayRows)

  const totalDu = rents.reduce((s, r) => s + Number(r.amount_due), 0)
  const totalPaye = rents.reduce((s, r) => s + Number(r.amount_paid), 0)
  const totalReste = rents.reduce((s, r) => s + Number(r.balance), 0)
  const tenantLabel = contract.tenants
    ? `${contract.tenants.first_name} ${contract.tenants.last_name}`
    : 'Locataire supprimé'

  return (
    <>
      <Link href="/contrats" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux contrats
      </Link>

      <PageHeader
        title={`${contract.properties?.name ?? 'Bien'} — ${tenantLabel}`}
        subtitle={`Du ${date(contract.start_date)} ${contract.end_date ? `au ${date(contract.end_date)}` : '· durée indéterminée'}`}
        actions={
          user.canWrite && (
            <>
              <ContractStatusControl id={id} status={contract.status} />
              <Link href={`/contrats/${id}/modifier`} className="btn-secondary">
                <Pencil className="size-5" aria-hidden />
                Modifier
              </Link>
              <DeleteButton
                action={deleteContract.bind(null, id)}
                title="Supprimer ce contrat"
                description="Le contrat et tous les loyers générés seront supprimés définitivement. Pour conserver l'historique, préférez la clôture du contrat."
              />
            </>
          )
        }
      />

      <div className="mb-6"><ContractStatusBadge status={contract.status} /></div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Loyer mensuel" value={money(Number(contract.monthly_rent) + Number(contract.charges))}
                  hint={contract.charges > 0 ? `dont ${money(contract.charges)} de charges` : 'sans charges fixes'} />
        <StatCard label="Total dû" value={money(totalDu)} hint={`${rents.length} mois générés`} />
        <StatCard label="Total encaissé" value={money(totalPaye)} tone="ok" />
        <StatCard label="Reste à payer" value={money(totalReste)} tone={totalReste > 0 ? 'bad' : 'default'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="flex items-center gap-2 border-b border-ink-100 px-5 py-4 text-[17px] font-bold text-ink-900">
              <Receipt className="size-5 text-ink-400" aria-hidden />
              Loyers du contrat
            </h2>
            {rents.length === 0 ? (
              <p className="px-5 py-8 text-center text-[15px] text-ink-500">
                Aucun loyer généré pour le moment.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Mois</th><th>Échéance</th><th className="text-right">Dû</th>
                        <th className="text-right">Payé</th><th className="text-right">Reste</th><th>Statut</th></tr>
                  </thead>
                  <tbody>
                    {rents.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium">
                          <Link href={`/loyers/${r.id}`} className="link">{monthLabel(r.period_month)}</Link>
                        </td>
                        <td className="whitespace-nowrap text-ink-600">{date(r.due_date)}</td>
                        <td className="text-right tabular-nums">{money(r.amount_due)}</td>
                        <td className="text-right tabular-nums text-ok-700">{money(r.amount_paid)}</td>
                        <td className={`text-right font-semibold tabular-nums ${r.balance > 0 ? 'text-bad-700' : 'text-ink-400'}`}>
                          {money(r.balance)}
                        </td>
                        <td><RentStatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Caution */}
          {deposit && Number(deposit.deposit_due) > 0 && (
            <section className="card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
                <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink-900">
                  <KeyRound className="size-5 text-ink-400" aria-hidden />
                  Caution
                </h2>
                <div className="flex items-center gap-3">
                  <DepositStatusBadge status={deposit.deposit_status} />
                  {user.canWrite && Number(deposit.deposit_balance) > 0 && (
                    <DepositDialog
                      compact
                      contractId={id}
                      due={Number(deposit.deposit_due)}
                      paid={Number(deposit.deposit_paid)}
                      balance={Number(deposit.deposit_balance)}
                      tenantLabel={tenantLabel}
                      propertyLabel={contract.properties?.name ?? 'Bien'}
                    />
                  )}
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-px border-b border-ink-100 bg-ink-100">
                {[
                  { label: 'Caution due', value: money(deposit.deposit_due), tone: 'text-ink-900' },
                  { label: 'Versé', value: money(deposit.deposit_paid), tone: 'text-ok-700' },
                  {
                    label: 'Reste',
                    value: money(deposit.deposit_balance),
                    tone: Number(deposit.deposit_balance) > 0 ? 'text-warn-700' : 'text-ink-400',
                  },
                ].map((item) => (
                  <div key={item.label} className="bg-white px-5 py-4">
                    <dt className="text-[12px] font-semibold text-ink-500">{item.label}</dt>
                    <dd className={`mt-1 text-lg font-bold tabular-nums ${item.tone}`}>{item.value}</dd>
                  </div>
                ))}
              </dl>

              {depositPayments.length === 0 ? (
                <p className="px-5 py-6 text-center text-[15px] text-ink-500">
                  Aucun versement enregistré.
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Date</th><th>Mode</th><th>Référence</th><th className="text-right">Montant</th></tr>
                    </thead>
                    <tbody>
                      {depositPayments.map((d) => (
                        <tr key={d.id}>
                          <td className="whitespace-nowrap font-medium">{date(d.payment_date)}</td>
                          <td className="text-ink-600">{PAYMENT_METHOD[d.method]}</td>
                          <td className="text-ink-500">{d.reference ?? '—'}</td>
                          <td className="num font-semibold text-ok-700">{money(d.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {(contract.conditions || contract.notes) && (
            <section className="card p-5">
              {contract.conditions && (
                <>
                  <h2 className="mb-2 text-[17px] font-bold text-ink-900">Conditions particulières</h2>
                  <p className="whitespace-pre-wrap text-[15px] text-ink-600">{contract.conditions}</p>
                </>
              )}
              {contract.notes && (
                <>
                  <h2 className={`mb-2 text-[17px] font-bold text-ink-900 ${contract.conditions ? 'mt-5' : ''}`}>
                    Notes internes
                  </h2>
                  <p className="whitespace-pre-wrap text-[15px] text-ink-600">{contract.notes}</p>
                </>
              )}
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-[17px] font-bold text-ink-900">
              <Home className="size-5 text-ink-400" aria-hidden />
              Bien loué
            </h2>
            {contract.properties ? (
              <>
                <Link href={`/biens/${contract.property_id}`} className="font-bold text-ink-900 hover:text-brand-700">
                  {contract.properties.name}
                </Link>
                <p className="text-sm text-ink-500">
                  {contract.properties.reference}
                  {contract.properties.city && ` · ${contract.properties.city}`}
                </p>
                {contract.properties.address && (
                  <p className="mt-1 text-sm text-ink-500">{contract.properties.address}</p>
                )}
              </>
            ) : <p className="text-[15px] text-ink-500">Bien supprimé.</p>}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-[17px] font-bold text-ink-900">
              <User className="size-5 text-ink-400" aria-hidden />
              Locataire
            </h2>
            {contract.tenants ? (
              <>
                <Link href={`/locataires/${contract.tenant_id}`} className="font-bold text-ink-900 hover:text-brand-700">
                  {tenantLabel}
                </Link>
                {contract.tenants.cin && <p className="text-sm text-ink-500">CIN {contract.tenants.cin}</p>}
                {contract.tenants.phone && (
                  <a href={`tel:${contract.tenants.phone}`} className="mt-1 block text-sm text-brand-700 hover:underline">
                    {contract.tenants.phone}
                  </a>
                )}
                {contract.tenants.email && (
                  <a href={`mailto:${contract.tenants.email}`} className="block break-words text-sm text-brand-700 hover:underline">
                    {contract.tenants.email}
                  </a>
                )}
              </>
            ) : <p className="text-[15px] text-ink-500">Locataire supprimé.</p>}
          </section>

          <section className="card p-5">
            <h2 className="mb-1 text-[17px] font-bold text-ink-900">Détails du bail</h2>
            <dl className="divide-y divide-ink-100">
              <InfoRow label="Loyer hors charges" value={money(contract.monthly_rent)} />
              <InfoRow label="Charges" value={chargesLabel(contract.charges)} />
              <InfoRow label="Jour d'échéance" value={`Le ${contract.due_day}`} />
              <InfoRow label="Date de début" value={date(contract.start_date)} />
              <InfoRow label="Date de fin" value={contract.end_date ? date(contract.end_date) : 'Indéterminée'} />
            </dl>
          </section>

          <DocumentsPanel
            entityType="contract"
            entityId={id}
            documents={documents}
            defaultDocType="contrat"
            canWrite={user.canWrite}
          />
        </div>
      </div>
    </>
  )
}
