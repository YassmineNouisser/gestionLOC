import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { row, rows } from '@/lib/supabase/rows'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { CategoryBadge, RentStatusBadge } from '@/components/ui/Badge'
import { PrintButton, PropertyReportButton } from '@/components/reports/ExportButtons'
import {
  EXPENSE_CATEGORY, RENT_STATUS, date, money, monthLabel, percent,
} from '@/lib/format'
import type { Expense, Property, PropertyStats, RentView } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('properties').select('name').eq('id', id).maybeSingle()
  return { title: data ? `Rapport — ${data.name}` : 'Rapport par bien' }
}

export default async function PropertyReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: propertyRow }, { data: statsRow }, { data: rentRows }, { data: expenseRows }] =
    await Promise.all([
      supabase.from('properties').select('*').eq('id', id).maybeSingle(),
      supabase.from('v_property_stats').select('*').eq('property_id', id).maybeSingle(),
      supabase.from('v_rents').select('*').eq('property_id', id).order('period_month', { ascending: false }),
      supabase.from('expenses').select('*').eq('property_id', id).order('expense_date', { ascending: false }),
    ])

  const property = row<Property>(propertyRow)
  if (!property) notFound()

  const stats = row<PropertyStats>(statsRow)
  const rents = rows<RentView>(rentRows)
  const expenses = rows<Expense>(expenseRows)

  const totalRevenus = Number(stats?.total_revenus ?? 0)
  const totalDepenses = Number(stats?.total_depenses ?? 0)
  const revenuNet = totalRevenus - totalDepenses
  const address = [property.address, property.city].filter(Boolean).join(', ')

  const pdfData = {
    property: {
      name: property.name,
      reference: property.reference,
      address,
      investissement: Number(property.total_investment),
      revenus: totalRevenus,
      depenses: totalDepenses,
      net: revenuNet,
      rentabiliteNette: stats?.rentabilite_nette ?? null,
      rentabiliteBrute: stats?.rentabilite_brute ?? null,
    },
    rents: rents.map((r) => ({
      period: r.period_month,
      due: Number(r.amount_due),
      paid: Number(r.amount_paid),
      balance: Number(r.balance),
      status: RENT_STATUS[r.status],
    })),
    expenses: expenses.map((e) => ({
      date: e.expense_date,
      category: EXPENSE_CATEGORY[e.category],
      description: e.description ?? '',
      amount: Number(e.amount),
    })),
  }

  return (
    <>
      <Link href="/rapports" className="no-print mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux rapports
      </Link>

      <PageHeader
        title={`Rapport — ${property.name}`}
        subtitle={[property.reference, address].filter(Boolean).join(' · ')}
        actions={
          <>
            <Link href={`/biens/${id}`} className="btn-secondary">Voir la fiche</Link>
            <PrintButton />
            <PropertyReportButton data={pdfData} />
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Investissement total" value={money(property.total_investment)}
                  hint="Achat + frais + travaux" />
        <StatCard label="Revenus" value={money(totalRevenus)} hint="Loyers encaissés depuis l'origine" tone="ok" />
        <StatCard label="Dépenses" value={money(totalDepenses)} tone="warn" />
        <StatCard label="Revenu net" value={money(revenuNet)} tone={revenuNet >= 0 ? 'ok' : 'bad'} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Rentabilité nette (12 mois)"
                  value={stats?.rentabilite_nette != null ? percent(stats.rentabilite_nette) : '—'}
                  hint={`Revenu net 12 mois : ${money(stats?.revenu_net_12m ?? 0)}`} tone="brand" />
        <StatCard label="Rentabilité brute"
                  value={stats?.rentabilite_brute != null ? percent(stats.rentabilite_brute) : '—'}
                  hint={`Loyer de référence × 12 : ${money(Number(property.monthly_rent) * 12)}`} />
      </div>

      <section className="card mb-6">
        <h2 className="border-b border-ink-100 px-5 py-4 text-[17px] font-bold text-ink-900">
          Historique des loyers
        </h2>
        {rents.length === 0 ? (
          <p className="px-5 py-8 text-center text-[15px] text-ink-500">Aucun loyer généré pour ce bien.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mois</th><th>Locataire</th><th>Échéance</th>
                  <th className="text-right">Dû</th><th className="text-right">Payé</th>
                  <th className="text-right">Reste</th><th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {rents.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap font-medium">
                      <Link href={`/loyers/${r.id}`} className="link">{monthLabel(r.period_month)}</Link>
                    </td>
                    <td className="text-ink-600">{r.tenant_first_name} {r.tenant_last_name}</td>
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
              <tfoot>
                <tr className="bg-ink-50">
                  <td colSpan={3} className="px-4 py-3 font-bold text-ink-800">Total</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">
                    {money(rents.reduce((s, r) => s + Number(r.amount_due), 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-ok-700">{money(totalRevenus)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-bad-700">
                    {money(rents.reduce((s, r) => s + Number(r.balance), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="border-b border-ink-100 px-5 py-4 text-[17px] font-bold text-ink-900">
          Historique des dépenses
        </h2>
        {expenses.length === 0 ? (
          <p className="px-5 py-8 text-center text-[15px] text-ink-500">Aucune dépense enregistrée pour ce bien.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Catégorie</th><th>Description</th><th className="text-right">Montant</th></tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap font-medium">{date(e.expense_date)}</td>
                    <td><CategoryBadge category={e.category} /></td>
                    <td className="max-w-md text-ink-600">{e.description ?? '—'}</td>
                    <td className="text-right font-semibold tabular-nums">{money(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-ink-50">
                  <td colSpan={3} className="px-4 py-3 font-bold text-ink-800">Total</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{money(totalDepenses)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
