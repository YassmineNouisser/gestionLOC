import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft, Briefcase, FileText, Gauge, Mail, MapPin, Pencil, Phone, Plus,
  ShieldAlert, TriangleAlert, Wallet,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { ContractStatusBadge, RentStatusBadge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { DocumentsPanel } from '@/components/documents/DocumentsPanel'
import { deleteTenant } from '@/lib/actions/tenants'
import { PAYMENT_METHOD, chargesLabel, date, money, monthLabel, num } from '@/lib/format'
import type {
  Contract, DocumentRow, MeterReadingView, Payment, Property, RentView,
  Tenant, TenantStats,
} from '@/lib/types'

export async function generateMetadata({
  params,
}: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('tenants').select('first_name, last_name').eq('id', id).maybeSingle()
  return { title: data ? `${data.first_name} ${data.last_name}` : 'Locataire' }
}

function InfoLine({ icon, label, value, href }: {
  icon: React.ReactNode; label: string; value: string | null; href?: string
}) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 text-ink-400" aria-hidden>{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</span>
        {href ? (
          <a href={href} className="block break-words font-medium text-brand-700 hover:underline">{value}</a>
        ) : (
          <span className="block break-words font-medium text-ink-900">{value}</span>
        )}
      </span>
    </div>
  )
}

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const supabase = await createClient()

  const { data: tenantRow } = await supabase.from('tenants').select('*').eq('id', id).maybeSingle()
  if (!tenantRow) notFound()
  const tenant = tenantRow as Tenant

  const [
    { data: statsRow }, { data: contractRows }, { data: rentRows },
    { data: paymentRows }, { data: docRows }, { data: readingRows },
  ] = await Promise.all([
    supabase.from('v_tenant_stats').select('*').eq('tenant_id', id).maybeSingle(),
    supabase.from('contracts')
      .select('*, properties(id, name, reference, city)')
      .eq('tenant_id', id).order('start_date', { ascending: false }),
    supabase.from('v_rents').select('*').eq('tenant_id', id)
      .order('period_month', { ascending: false }).limit(24),
    supabase.from('payments')
      .select('*, rents(period_month)')
      .eq('tenant_id', id).order('payment_date', { ascending: false }).limit(15),
    supabase.from('documents').select('*').eq('entity_type', 'tenant').eq('entity_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('v_meter_readings').select('*').eq('tenant_id', id)
      .order('period_month', { ascending: false }).limit(6),
  ])

  const stats = statsRow as TenantStats | null
  type ContractWithProperty = Contract & { properties: Pick<Property, 'id' | 'name' | 'reference' | 'city'> | null }
  const contracts = (contractRows ?? []) as ContractWithProperty[]
  const activeContract = contracts.find((c) => c.status === 'actif') ?? null
  const pastContracts = contracts.filter((c) => c.status !== 'actif')
  const rents = (rentRows ?? []) as RentView[]
  const unpaid = rents.filter((r) => r.balance > 0)
  const payments = (paymentRows ?? []) as (Payment & { rents: { period_month: string } | null })[]
  const documents = (docRows ?? []) as DocumentRow[]
  const readings = (readingRows ?? []) as MeterReadingView[]

  return (
    <>
      <Link href="/locataires" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux locataires
      </Link>

      <PageHeader
        title={`${tenant.first_name} ${tenant.last_name}`}
        subtitle={[tenant.cin && `CIN ${tenant.cin}`, tenant.profession].filter(Boolean).join(' · ') || undefined}
        actions={
          user.canWrite && (
            <>
              {!activeContract && (
                <Link href={`/contrats/nouveau?locataire=${id}`} className="btn-secondary">
                  <Plus className="size-5" aria-hidden />
                  Nouveau contrat
                </Link>
              )}
              <Link href={`/locataires/${id}/modifier`} className="btn-secondary">
                <Pencil className="size-5" aria-hidden />
                Modifier
              </Link>
              <DeleteButton
                action={deleteTenant.bind(null, id)}
                title="Supprimer ce locataire"
                description={`La fiche de ${tenant.first_name} ${tenant.last_name} sera définitivement supprimée.`}
              />
            </>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total dû" value={money(stats?.total_du ?? 0)} hint="Somme des loyers générés" />
        <StatCard label="Total payé" value={money(stats?.total_paye ?? 0)} tone="ok" icon={<Wallet className="size-5" />} />
        <StatCard label="Reste à payer" value={money(stats?.total_restant ?? 0)} tone={Number(stats?.total_restant ?? 0) > 0 ? 'warn' : 'default'} />
        <StatCard
          label="Impayés"
          value={money(stats?.total_impayes ?? 0)}
          hint={`${stats?.nb_impayes ?? 0} loyer${(stats?.nb_impayes ?? 0) > 1 ? 's' : ''} en retard`}
          tone={Number(stats?.total_impayes ?? 0) > 0 ? 'bad' : 'default'}
          icon={<TriangleAlert className="size-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Contrat actuel */}
          <section className="card">
            <h2 className="flex items-center gap-2 border-b border-ink-100 px-5 py-4 text-[17px] font-bold text-ink-900">
              <FileText className="size-5 text-ink-400" aria-hidden />
              Contrat actuel
            </h2>
            {activeContract ? (
              <div className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Link href={`/biens/${activeContract.property_id}`} className="text-lg font-bold text-ink-900 hover:text-brand-700">
                      {activeContract.properties?.name}
                    </Link>
                    <p className="text-sm text-ink-500">
                      {activeContract.properties?.reference}
                      {activeContract.properties?.city && ` · ${activeContract.properties.city}`}
                    </p>
                  </div>
                  <Link href={`/contrats/${activeContract.id}`} className="btn-secondary btn-sm">Voir le contrat</Link>
                </div>
                <dl className="mt-4 grid gap-x-8 border-t border-ink-100 pt-3 sm:grid-cols-2">
                  {[
                    ['Loyer mensuel', money(activeContract.monthly_rent)],
                    ['Charges', chargesLabel(activeContract.charges)],
                    ['Début', date(activeContract.start_date)],
                    ['Fin', activeContract.end_date ? date(activeContract.end_date) : 'Indéterminée'],
                    ['Caution', money(activeContract.deposit)],
                    ["Jour d'échéance", `Le ${activeContract.due_day}`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-4 py-2">
                      <dt className="text-sm text-ink-500">{label}</dt>
                      <dd className="font-medium text-ink-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-[15px] text-ink-500">Ce locataire n&apos;a pas de contrat actif.</p>
                {user.canWrite && (
                  <Link href={`/contrats/nouveau?locataire=${id}`} className="btn-primary mt-4">
                    <Plus className="size-5" aria-hidden />
                    Créer un contrat
                  </Link>
                )}
              </div>
            )}
          </section>

          {/* Impayés */}
          {unpaid.length > 0 && (
            <section className="card border-bad-100">
              <h2 className="flex items-center gap-2 border-b border-ink-100 bg-bad-50 px-5 py-4 text-[17px] font-bold text-bad-800">
                <TriangleAlert className="size-5" aria-hidden />
                Loyers non soldés ({unpaid.length})
              </h2>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Mois</th><th>Bien</th><th>Dû</th><th>Payé</th><th>Reste</th><th>Statut</th></tr></thead>
                  <tbody>
                    {unpaid.map((r) => (
                      <tr key={r.id}>
                        <td><Link href={`/loyers/${r.id}`} className="link">{monthLabel(r.period_month)}</Link></td>
                        <td className="text-ink-600">{r.property_name}</td>
                        <td className="tabular-nums">{money(r.amount_due)}</td>
                        <td className="tabular-nums text-ok-700">{money(r.amount_paid)}</td>
                        <td className="font-bold tabular-nums text-bad-700">{money(r.balance)}</td>
                        <td><RentStatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Historique des paiements */}
          <section className="card">
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink-900">
                <Wallet className="size-5 text-ink-400" aria-hidden />
                Derniers paiements
              </h2>
              <Link href={`/paiements?locataire=${id}`} className="link text-sm">Tout voir</Link>
            </div>
            {payments.length === 0 ? (
              <p className="px-5 py-8 text-center text-[15px] text-ink-500">Aucun paiement enregistré.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Date</th><th>Mois concerné</th><th>Mode</th><th>Référence</th><th className="text-right">Montant</th></tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap">{date(p.payment_date)}</td>
                        <td className="text-ink-600">{monthLabel(p.rents?.period_month ?? null)}</td>
                        <td className="text-ink-600">{PAYMENT_METHOD[p.method]}</td>
                        <td className="text-ink-500">{p.reference ?? '—'}</td>
                        <td className="text-right font-semibold tabular-nums text-ok-700">{money(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Eau et électricité refacturées */}
          {readings.length > 0 && (
            <section className="card">
              <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
                <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink-900">
                  <Gauge className="size-5 text-ink-400" aria-hidden />
                  Eau et électricité
                </h2>
                <Link href={`/releves?q=${encodeURIComponent(tenant.last_name)}`} className="link text-sm">
                  Tout voir
                </Link>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mois</th><th>Bien</th>
                      <th className="text-right">Eau</th>
                      <th className="text-right">Électricité</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readings.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap font-medium">
                          <Link href={`/releves/${r.id}/modifier`} className="link">
                            {monthLabel(r.period_month)}
                          </Link>
                        </td>
                        <td className="text-ink-600">{r.property_name}</td>
                        <td className="num">
                          <span className="block font-semibold text-brand-700">{money(r.water_amount)}</span>
                          <span className="block text-sm text-ink-500">{num(r.water_consumption, 2)} m³</span>
                        </td>
                        <td className="num">
                          <span className="block font-semibold text-warn-700">{money(r.elec_amount)}</span>
                          <span className="block text-sm text-ink-500">{num(r.elec_consumption, 2)} kWh</span>
                        </td>
                        <td className="num font-bold text-ink-900">{money(r.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4}>Total refacturé</td>
                      <td className="num">
                        {money(readings.reduce((s, r) => s + Number(r.total_amount), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}

          {/* Anciens contrats */}
          {pastContracts.length > 0 && (
            <section className="card">
              <h2 className="border-b border-ink-100 px-5 py-4 text-[17px] font-bold text-ink-900">Anciens contrats</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Bien</th><th>Période</th><th>Loyer</th><th>Statut</th></tr></thead>
                  <tbody>
                    {pastContracts.map((c) => (
                      <tr key={c.id}>
                        <td><Link href={`/contrats/${c.id}`} className="link">{c.properties?.name ?? '—'}</Link></td>
                        <td className="whitespace-nowrap text-ink-600">
                          {date(c.start_date)} → {c.end_date ? date(c.end_date) : '—'}
                        </td>
                        <td className="tabular-nums">{money(c.monthly_rent)}</td>
                        <td><ContractStatusBadge status={c.status} /></td>
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
            <h2 className="mb-1 text-[17px] font-bold text-ink-900">Coordonnées</h2>
            <div className="divide-y divide-ink-100">
              <InfoLine icon={<Phone className="size-4.5" />} label="Téléphone" value={tenant.phone}
                        href={tenant.phone ? `tel:${tenant.phone}` : undefined} />
              <InfoLine icon={<Mail className="size-4.5" />} label="Email" value={tenant.email}
                        href={tenant.email ? `mailto:${tenant.email}` : undefined} />
              <InfoLine icon={<MapPin className="size-4.5" />} label="Adresse" value={tenant.address} />
              <InfoLine icon={<Briefcase className="size-4.5" />} label="Profession" value={tenant.profession} />
              <InfoLine
                icon={<ShieldAlert className="size-4.5" />}
                label="Contact d'urgence"
                value={[tenant.emergency_contact_name, tenant.emergency_contact_phone].filter(Boolean).join(' — ') || null}
              />
            </div>
            {!tenant.phone && !tenant.email && !tenant.address && !tenant.profession && (
              <p className="py-3 text-[15px] text-ink-500">Aucune coordonnée renseignée.</p>
            )}
          </section>

          {tenant.notes && (
            <section className="card p-5">
              <h2 className="mb-2 text-[17px] font-bold text-ink-900">Notes</h2>
              <p className="whitespace-pre-wrap text-[15px] text-ink-600">{tenant.notes}</p>
            </section>
          )}

          <DocumentsPanel
            entityType="tenant"
            entityId={id}
            documents={documents}
            defaultDocType="cin"
            canWrite={user.canWrite}
          />
        </div>
      </div>
    </>
  )
}
