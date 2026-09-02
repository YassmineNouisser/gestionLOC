import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { CategoryBadge, RentStatusBadge } from '@/components/ui/Badge'
import { MonthlyReportButton, PrintButton } from '@/components/reports/ExportButtons'
import { MonthPicker } from '@/components/reports/PeriodPicker'
import {
  EXPENSE_CATEGORY, RENT_STATUS, date, firstOfMonth, money, monthLabel, shiftMonth,
} from '@/lib/format'
import type { Expense, Property, RentView } from '@/lib/types'

export const metadata: Metadata = { title: 'Rapport mensuel' }
export const dynamic = 'force-dynamic'

type ExpenseRow = Expense & { properties: Pick<Property, 'name' | 'reference'> | null }

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>
}) {
  const { mois } = await searchParams
  const period = /^\d{4}-\d{2}-\d{2}$/.test(mois ?? '') ? mois! : firstOfMonth()
  const supabase = await createClient()

  const [{ data: rentRows }, { data: expenseRows }] = await Promise.all([
    supabase.from('v_rents').select('*').eq('period_month', period).order('property_reference'),
    supabase.from('expenses').select('*, properties(name, reference)')
      .gte('expense_date', period).lt('expense_date', shiftMonth(period, 1))
      .order('expense_date'),
  ])

  const rents = rows<RentView>(rentRows)
  const expenses = rows<ExpenseRow>(expenseRows)

  const totals = {
    loyersPrevus: rents.reduce((s, r) => s + Number(r.amount_due), 0),
    loyersEncaisses: rents.reduce((s, r) => s + Number(r.amount_paid), 0),
    montantRestant: rents.reduce((s, r) => s + Number(r.balance), 0),
    impayes: rents.filter((r) => r.is_overdue).reduce((s, r) => s + Number(r.balance), 0),
    depenses: expenses.reduce((s, e) => s + Number(e.amount), 0),
    revenuNet: 0,
  }
  totals.revenuNet = totals.loyersEncaisses - totals.depenses

  const pdfData = {
    period,
    totals,
    rents: rents.map((r) => ({
      property: r.property_name,
      tenant: `${r.tenant_first_name} ${r.tenant_last_name}`,
      due: Number(r.amount_due),
      paid: Number(r.amount_paid),
      balance: Number(r.balance),
      status: RENT_STATUS[r.status],
    })),
    expenses: expenses.map((e) => ({
      property: e.properties?.name ?? '—',
      category: EXPENSE_CATEGORY[e.category],
      date: e.expense_date,
      description: e.description ?? '',
      amount: Number(e.amount),
    })),
  }

  const isEmpty = rents.length === 0 && expenses.length === 0

  return (
    <>
      <Link href="/rapports" className="no-print mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux rapports
      </Link>

      <PageHeader
        title="Rapport mensuel"
        subtitle={monthLabel(period)}
        actions={
          <>
            <MonthPicker value={period} />
            <PrintButton />
            <MonthlyReportButton data={pdfData} />
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Loyers prévus" value={money(totals.loyersPrevus)}
                  hint={`${rents.length} loyer${rents.length > 1 ? 's' : ''} généré${rents.length > 1 ? 's' : ''}`} />
        <StatCard label="Loyers encaissés" value={money(totals.loyersEncaisses)} tone="ok" />
        <StatCard label="Montant restant" value={money(totals.montantRestant)}
                  tone={totals.montantRestant > 0 ? 'warn' : 'default'} />
        <StatCard label="Dont impayés" value={money(totals.impayes)}
                  hint="Échéance dépassée" tone={totals.impayes > 0 ? 'bad' : 'default'} />
        <StatCard label="Dépenses du mois" value={money(totals.depenses)}
                  hint={`${expenses.length} dépense${expenses.length > 1 ? 's' : ''}`} tone="warn" />
        <StatCard label="Revenu net" value={money(totals.revenuNet)}
                  hint="Loyers encaissés − dépenses"
                  tone={totals.revenuNet >= 0 ? 'ok' : 'bad'} />
      </div>

      {isEmpty && (
        <div className="card p-8 text-center">
          <p className="text-[15px] text-ink-500">
            Aucun loyer ni dépense enregistré pour {monthLabel(period)}.
          </p>
        </div>
      )}

      {rents.length > 0 && (
        <section className="card mb-6">
          <h2 className="border-b border-ink-100 px-5 py-4 text-[17px] font-bold text-ink-900">
            Détail des loyers
          </h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Bien</th><th>Locataire</th><th>Échéance</th>
                  <th className="text-right">Dû</th><th className="text-right">Payé</th>
                  <th className="text-right">Reste</th><th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {rents.map((r) => (
                  <tr key={r.id}>
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
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{money(totals.loyersPrevus)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-ok-700">{money(totals.loyersEncaisses)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-bad-700">{money(totals.montantRestant)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {expenses.length > 0 && (
        <section className="card">
          <h2 className="border-b border-ink-100 px-5 py-4 text-[17px] font-bold text-ink-900">
            Détail des dépenses
          </h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Bien</th><th>Catégorie</th><th>Description</th><th className="text-right">Montant</th></tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{date(e.expense_date)}</td>
                    <td>
                      <Link href={`/biens/${e.property_id}`} className="text-ink-800 hover:text-brand-700">
                        {e.properties?.name ?? '—'}
                      </Link>
                    </td>
                    <td><CategoryBadge category={e.category} /></td>
                    <td className="max-w-sm text-ink-600">{e.description ?? '—'}</td>
                    <td className="text-right font-semibold tabular-nums">{money(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-ink-50">
                  <td colSpan={4} className="px-4 py-3 font-bold text-ink-800">Total</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{money(totals.depenses)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
