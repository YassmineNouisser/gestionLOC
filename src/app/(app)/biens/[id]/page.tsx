import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft, Building2, FileText, Pencil, Plus, Receipt, TrendingUp, User, Wallet,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { PropertyStatusBadge, RentStatusBadge, CategoryBadge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { DocumentsPanel } from '@/components/documents/DocumentsPanel'
import { PropertyStatusControl } from '@/components/properties/PropertyStatusControl'
import { deleteProperty } from '@/lib/actions/properties'
import {
  PROPERTY_TYPE, date, money, monthLabel, num, percent, tenantName,
} from '@/lib/format'
import type {
  Contract, DocumentRow, Expense, Property, PropertyStats, RentView, Tenant,
} from '@/lib/types'

export async function generateMetadata({
  params,
}: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('properties').select('name').eq('id', id).maybeSingle()
  return { title: data?.name ?? 'Bien' }
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-900">{value}</dd>
    </div>
  )
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()
  const supabase = await createClient()

  const { data: propertyRow } = await supabase
    .from('properties').select('*').eq('id', id).maybeSingle()
  if (!propertyRow) notFound()
  const property = propertyRow as Property

  const [
    { data: statsRow }, { data: contractRows }, { data: rentRows },
    { data: expenseRows }, { data: docRows },
  ] = await Promise.all([
    supabase.from('v_property_stats').select('*').eq('property_id', id).maybeSingle(),
    supabase.from('contracts')
      .select('*, tenants(id, first_name, last_name, phone, email)')
      .eq('property_id', id)
      .order('start_date', { ascending: false }),
    supabase.from('v_rents').select('*').eq('property_id', id)
      .order('period_month', { ascending: false }).limit(12),
    supabase.from('expenses').select('*').eq('property_id', id)
      .order('expense_date', { ascending: false }).limit(10),
    supabase.from('documents').select('*').eq('entity_type', 'property').eq('entity_id', id)
      .order('created_at', { ascending: false }),
  ])

  const stats = statsRow as PropertyStats | null
  type ContractWithTenant = Contract & { tenants: Pick<Tenant, 'id' | 'first_name' | 'last_name' | 'phone' | 'email'> | null }
  const contracts = (contractRows ?? []) as ContractWithTenant[]
  const activeContract = contracts.find((c) => c.status === 'actif') ?? null
  const pastContracts = contracts.filter((c) => c.status !== 'actif')
  const rents = (rentRows ?? []) as RentView[]
  const expenses = (expenseRows ?? []) as Expense[]
  const documents = (docRows ?? []) as DocumentRow[]

  return (
    <>
      <Link href="/biens" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux biens
      </Link>

      <PageHeader
        title={property.name}
        subtitle={`${property.reference} · ${[property.address, property.city].filter(Boolean).join(', ') || 'Adresse non renseignée'}`}
        actions={
          user.canWrite && (
            <>
              <PropertyStatusControl id={property.id} status={property.status} />
              <Link href={`/biens/${id}/modifier`} className="btn-secondary">
                <Pencil className="size-5" aria-hidden />
                Modifier
              </Link>
              <DeleteButton
                action={deleteProperty.bind(null, id)}
                title="Supprimer ce bien"
                description={`Le bien « ${property.name} » et ses dépenses associées seront supprimés définitivement.`}
              />
            </>
          )
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <PropertyStatusBadge status={property.status} />
        <span className="text-sm text-ink-500">{PROPERTY_TYPE[property.type]}</span>
        {property.surface != null && <span className="text-sm text-ink-500">{num(property.surface, 0)} m²</span>}
        {property.rooms != null && <span className="text-sm text-ink-500">{property.rooms} chambre{property.rooms > 1 ? 's' : ''}</span>}
      </div>

      {/* Indicateurs financiers */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Investissement total"
          value={money(property.total_investment)}
          hint="Achat + frais + travaux"
          icon={<Building2 className="size-5" />}
        />
        <StatCard
          label="Loyers encaissés (12 mois)"
          value={money(stats?.revenus_12m ?? 0)}
          hint={`Total historique : ${money(stats?.total_revenus ?? 0)}`}
          tone="ok"
          icon={<Wallet className="size-5" />}
        />
        <StatCard
          label="Dépenses (12 mois)"
          value={money(stats?.depenses_12m ?? 0)}
          hint={`Total historique : ${money(stats?.total_depenses ?? 0)}`}
          tone="warn"
          icon={<Receipt className="size-5" />}
        />
        <StatCard
          label="Rentabilité nette"
          value={stats?.rentabilite_nette != null ? percent(stats.rentabilite_nette) : '—'}
          hint={`Revenu net 12 mois : ${money(stats?.revenu_net_12m ?? 0)}`}
          tone="brand"
          icon={<TrendingUp className="size-5" />}
        />
      </div>

      {(stats?.total_impayes ?? 0) > 0 && (
        <div className="mb-6 card border-bad-100 bg-bad-50 p-4">
          <p className="font-semibold text-bad-800">
            Impayés en cours : {money(stats?.total_impayes)}
          </p>
          <Link href={`/loyers?bien=${id}&statut=impaye`} className="mt-1 inline-block text-sm font-semibold text-bad-700 underline">
            Voir les loyers concernés
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="space-y-6 lg:col-span-2">
          {/* Contrat actuel */}
          <section className="card">
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink-900">
                <FileText className="size-5 text-ink-400" aria-hidden />
                Contrat en cours
              </h2>
              {!activeContract && user.canWrite && (
                <Link href={`/contrats/nouveau?bien=${id}`} className="btn-secondary btn-sm">
                  <Plus className="size-4" aria-hidden />
                  Créer un contrat
                </Link>
              )}
            </div>

            {activeContract ? (
              <div className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <Link href={`/locataires/${activeContract.tenant_id}`} className="flex items-center gap-3 group">
                    <span className="flex size-11 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
                      {(activeContract.tenants?.first_name ?? '?').slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      <span className="block font-bold text-ink-900 group-hover:text-brand-700">
                        {tenantName(activeContract.tenants)}
                      </span>
                      <span className="block text-sm text-ink-500">
                        {activeContract.tenants?.phone ?? 'Téléphone non renseigné'}
                      </span>
                    </span>
                  </Link>
                  <Link href={`/contrats/${activeContract.id}`} className="btn-secondary btn-sm">
                    Voir le contrat
                  </Link>
                </div>

                <dl className="mt-4 grid gap-x-8 border-t border-ink-100 pt-2 sm:grid-cols-2">
                  <InfoRow label="Loyer mensuel" value={money(activeContract.monthly_rent)} />
                  <InfoRow label="Charges" value={money(activeContract.charges)} />
                  <InfoRow label="Début" value={date(activeContract.start_date)} />
                  <InfoRow label="Fin" value={activeContract.end_date ? date(activeContract.end_date) : 'Indéterminée'} />
                  <InfoRow label="Jour d'échéance" value={`Le ${activeContract.due_day} de chaque mois`} />
                  <InfoRow label="Caution" value={money(activeContract.deposit)} />
                </dl>
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-[15px] text-ink-500">
                Ce bien n&apos;a pas de contrat actif.
              </p>
            )}
          </section>

          {/* Historique des loyers */}
          <section className="card">
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink-900">
                <Receipt className="size-5 text-ink-400" aria-hidden />
                Derniers loyers
              </h2>
              <Link href={`/loyers?bien=${id}`} className="link text-sm">Tout voir</Link>
            </div>

            {rents.length === 0 ? (
              <p className="px-5 py-8 text-center text-[15px] text-ink-500">
                Aucun loyer généré. Les loyers apparaissent automatiquement dès qu&apos;un contrat est actif.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mois</th><th>Dû</th><th>Payé</th><th>Reste</th><th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rents.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium">
                          <Link href={`/loyers/${r.id}`} className="link">{monthLabel(r.period_month)}</Link>
                        </td>
                        <td className="tabular-nums">{money(r.amount_due)}</td>
                        <td className="tabular-nums text-ok-700">{money(r.amount_paid)}</td>
                        <td className={`tabular-nums font-semibold ${r.balance > 0 ? 'text-bad-700' : 'text-ink-400'}`}>
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

          {/* Dépenses */}
          <section className="card">
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink-900">
                <Wallet className="size-5 text-ink-400" aria-hidden />
                Dernières dépenses
              </h2>
              <div className="flex items-center gap-2">
                <Link href={`/depenses?bien=${id}`} className="link text-sm">Tout voir</Link>
                {user.canWrite && (
                  <Link href={`/depenses/nouvelle?bien=${id}`} className="btn-secondary btn-sm">
                    <Plus className="size-4" aria-hidden />
                    Ajouter
                  </Link>
                )}
              </div>
            </div>

            {expenses.length === 0 ? (
              <p className="px-5 py-8 text-center text-[15px] text-ink-500">
                Aucune dépense enregistrée pour ce bien.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Date</th><th>Catégorie</th><th>Description</th><th className="text-right">Montant</th></tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id}>
                        <td className="whitespace-nowrap">{date(e.expense_date)}</td>
                        <td><CategoryBadge category={e.category} /></td>
                        <td className="max-w-xs truncate text-ink-600">{e.description ?? '—'}</td>
                        <td className="text-right font-semibold tabular-nums">{money(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Anciens contrats */}
          {pastContracts.length > 0 && (
            <section className="card">
              <h2 className="border-b border-ink-100 px-5 py-4 text-[17px] font-bold text-ink-900">
                Anciens contrats
              </h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Locataire</th><th>Période</th><th>Loyer</th><th>Statut</th></tr>
                  </thead>
                  <tbody>
                    {pastContracts.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/contrats/${c.id}`} className="link">{tenantName(c.tenants)}</Link>
                        </td>
                        <td className="whitespace-nowrap text-ink-600">
                          {date(c.start_date)} → {c.end_date ? date(c.end_date) : '—'}
                        </td>
                        <td className="tabular-nums">{money(c.monthly_rent)}</td>
                        <td className="text-ink-600">{c.status === 'termine' ? 'Terminé' : 'Résilié'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-1 text-[17px] font-bold text-ink-900">Fiche du bien</h2>
            <dl className="divide-y divide-ink-100">
              <InfoRow label="Référence" value={property.reference} />
              <InfoRow label="Type" value={PROPERTY_TYPE[property.type]} />
              <InfoRow label="Ville" value={property.city ?? '—'} />
              <InfoRow label="Surface" value={property.surface != null ? `${num(property.surface, 0)} m²` : '—'} />
              <InfoRow label="Chambres" value={property.rooms ?? '—'} />
              <InfoRow label="Loyer de référence" value={money(property.monthly_rent)} />
              <InfoRow label="Charges" value={money(property.charges)} />
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="mb-1 text-[17px] font-bold text-ink-900">Investissement</h2>
            <dl className="divide-y divide-ink-100">
              <InfoRow label="Prix d'achat" value={money(property.purchase_price)} />
              <InfoRow label="Frais d'achat" value={money(property.purchase_fees)} />
              <InfoRow label="Travaux initiaux" value={money(property.initial_works)} />
              <InfoRow label="Date d'achat" value={date(property.purchase_date)} />
              <div className="flex items-baseline justify-between gap-4 border-t-2 border-ink-200 pt-3 mt-1">
                <dt className="font-semibold text-ink-700">Total</dt>
                <dd className="text-lg font-bold tabular-nums text-brand-700">{money(property.total_investment)}</dd>
              </div>
              <InfoRow label="Rentabilité brute" value={percent(stats?.rentabilite_brute ?? null)} />
              {property.insurance_expiry && (
                <InfoRow label="Assurance jusqu'au" value={date(property.insurance_expiry)} />
              )}
            </dl>
          </section>

          {property.notes && (
            <section className="card p-5">
              <h2 className="mb-2 text-[17px] font-bold text-ink-900">Notes</h2>
              <p className="whitespace-pre-wrap text-[15px] text-ink-600">{property.notes}</p>
            </section>
          )}

          <DocumentsPanel
            entityType="property"
            entityId={id}
            documents={documents}
            defaultDocType="photo"
            title="Documents et photos"
            canWrite={user.canWrite}
          />
        </div>
      </div>
    </>
  )
}
