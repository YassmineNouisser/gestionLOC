import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { ChartCard } from '@/components/charts/ChartCard'
import { NetIncomeChart, RevenueExpenseChart } from '@/components/charts/MonthlyCharts'
import { VIZ } from '@/components/charts/theme'
import { AnnualReportButton, PrintButton } from '@/components/reports/ExportButtons'
import { YearPicker } from '@/components/reports/PeriodPicker'
import { sumSeries, yearMonths } from '@/lib/data/series'
import { money, monthLabel, percent } from '@/lib/format'
import type { MonthlySummary, Property, Rent, Expense } from '@/lib/types'

export const metadata: Metadata = { title: 'Rapport annuel' }
export const dynamic = 'force-dynamic'

export default async function AnnualReportPage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string }>
}) {
  const { annee } = await searchParams
  const thisYear = new Date().getFullYear()
  const parsed = Number(annee)
  const year = Number.isInteger(parsed) && parsed >= 2000 && parsed <= thisYear + 5 ? parsed : thisYear

  const from = `${year}-01-01`
  const to = `${year}-12-31`
  const supabase = await createClient()

  const [{ data: monthlyRows }, { data: propertyRows }, { data: rentRows }, { data: expenseRows }] =
    await Promise.all([
      supabase.from('v_monthly_summary').select('*').gte('period_month', from).lte('period_month', to),
      supabase.from('properties').select('id, name, reference, total_investment').order('reference'),
      supabase.from('rents').select('property_id, amount_paid').gte('period_month', from).lte('period_month', to),
      supabase.from('expenses').select('property_id, amount').gte('expense_date', from).lte('expense_date', to),
    ])

  const months = yearMonths(rows<MonthlySummary>(monthlyRows), year)
  const totals = sumSeries(months)

  const properties = rows<Pick<Property, 'id' | 'name' | 'reference' | 'total_investment'>>(propertyRows)
  const revenueByProperty = new Map<string, number>()
  for (const r of rows<Pick<Rent, 'property_id' | 'amount_paid'>>(rentRows)) {
    revenueByProperty.set(r.property_id, (revenueByProperty.get(r.property_id) ?? 0) + Number(r.amount_paid))
  }
  const expenseByProperty = new Map<string, number>()
  for (const e of rows<Pick<Expense, 'property_id' | 'amount'>>(expenseRows)) {
    expenseByProperty.set(e.property_id, (expenseByProperty.get(e.property_id) ?? 0) + Number(e.amount))
  }

  const byProperty = properties.map((p) => {
    const revenus = revenueByProperty.get(p.id) ?? 0
    const depenses = expenseByProperty.get(p.id) ?? 0
    const net = revenus - depenses
    const investissement = Number(p.total_investment)
    return {
      id: p.id,
      name: p.name,
      reference: p.reference,
      investissement,
      revenus,
      depenses,
      net,
      rentabilite: investissement > 0 ? Math.round((net / investissement) * 10000) / 100 : null,
    }
  }).sort((a, b) => (b.rentabilite ?? -Infinity) - (a.rentabilite ?? -Infinity))

  const investissementTotal = byProperty.reduce((s, p) => s + p.investissement, 0)
  const rentabiliteGlobale = investissementTotal > 0
    ? Math.round((totals.revenu_net / investissementTotal) * 10000) / 100
    : null

  const pdfData = {
    year,
    months: months.map((m) => ({
      period: m.period_month,
      loyersPrevus: Number(m.loyers_prevus),
      loyersEncaisses: Number(m.loyers_encaisses),
      montantRestant: Number(m.montant_restant),
      depenses: Number(m.depenses),
      revenuNet: Number(m.revenu_net),
    })),
    totals: {
      loyersPrevus: totals.loyers_prevus,
      loyersEncaisses: totals.loyers_encaisses,
      montantRestant: totals.montant_restant,
      depenses: totals.depenses,
      revenuNet: totals.revenu_net,
    },
    investissement: investissementTotal,
    rentabilite: rentabiliteGlobale,
    properties: byProperty.map((p) => ({
      name: p.name,
      revenus: p.revenus,
      depenses: p.depenses,
      net: p.net,
      rentabilite: p.rentabilite,
    })),
  }

  return (
    <>
      <Link href="/rapports" className="no-print mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux rapports
      </Link>

      <PageHeader
        title="Rapport annuel"
        subtitle={`Année ${year}`}
        actions={
          <>
            <YearPicker value={year} min={2015} max={thisYear + 1} />
            <PrintButton />
            <AnnualReportButton data={pdfData} />
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Loyers encaissés" value={money(totals.loyers_encaisses)}
                  hint={`Prévus : ${money(totals.loyers_prevus)}`} tone="ok" />
        <StatCard label="Dépenses" value={money(totals.depenses)} tone="warn" />
        <StatCard label="Revenu net" value={money(totals.revenu_net)}
                  tone={totals.revenu_net >= 0 ? 'ok' : 'bad'} />
        <StatCard label="Rentabilité" value={rentabiliteGlobale != null ? percent(rentabiliteGlobale) : '—'}
                  hint={`Investissement : ${money(investissementTotal)}`} tone="brand" />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Loyers encaissés et dépenses"
          subtitle={`Mois par mois, année ${year}`}
          legend={[
            { label: 'Loyers encaissés', color: VIZ.series1 },
            { label: 'Dépenses', color: VIZ.series2 },
          ]}
        >
          <RevenueExpenseChart data={months} />
        </ChartCard>

        <ChartCard title="Revenu net par mois" subtitle={`Année ${year}`}>
          <NetIncomeChart data={months} />
        </ChartCard>
      </div>

      <section className="card mb-6">
        <h2 className="border-b border-ink-100 px-5 py-4 text-[17px] font-bold text-ink-900">
          Détail mensuel
        </h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mois</th>
                <th className="text-right">Loyers prévus</th>
                <th className="text-right">Encaissés</th>
                <th className="text-right">Restant</th>
                <th className="text-right">Dépenses</th>
                <th className="text-right">Revenu net</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.period_month}>
                  <td className="font-medium">
                    <Link href={`/rapports/mensuel?mois=${m.period_month}`} className="link">
                      {monthLabel(m.period_month)}
                    </Link>
                  </td>
                  <td className="text-right tabular-nums">{money(m.loyers_prevus)}</td>
                  <td className="text-right tabular-nums text-ok-700">{money(m.loyers_encaisses)}</td>
                  <td className="text-right tabular-nums">{money(m.montant_restant)}</td>
                  <td className="text-right tabular-nums text-warn-700">{money(m.depenses)}</td>
                  <td className={`text-right font-semibold tabular-nums ${Number(m.revenu_net) >= 0 ? 'text-ink-900' : 'text-bad-700'}`}>
                    {money(m.revenu_net)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-ink-50">
                <td className="px-4 py-3 font-bold text-ink-800">Total {year}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">{money(totals.loyers_prevus)}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-ok-700">{money(totals.loyers_encaisses)}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">{money(totals.montant_restant)}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-warn-700">{money(totals.depenses)}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">{money(totals.revenu_net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {byProperty.length > 0 && (
        <section className="card">
          <h2 className="border-b border-ink-100 px-5 py-4 text-[17px] font-bold text-ink-900">
            Rentabilité par bien en {year}
          </h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Bien</th>
                  <th className="text-right">Investissement</th>
                  <th className="text-right">Revenus</th>
                  <th className="text-right">Dépenses</th>
                  <th className="text-right">Revenu net</th>
                  <th className="text-right">Rentabilité</th>
                </tr>
              </thead>
              <tbody>
                {byProperty.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/rapports/bien/${p.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                        {p.name}
                      </Link>
                      <span className="block text-sm text-ink-500">{p.reference}</span>
                    </td>
                    <td className="text-right tabular-nums">{money(p.investissement)}</td>
                    <td className="text-right tabular-nums text-ok-700">{money(p.revenus)}</td>
                    <td className="text-right tabular-nums text-warn-700">{money(p.depenses)}</td>
                    <td className={`text-right font-semibold tabular-nums ${p.net >= 0 ? 'text-ink-900' : 'text-bad-700'}`}>
                      {money(p.net)}
                    </td>
                    <td className="text-right font-bold tabular-nums text-brand-700">{percent(p.rentabilite)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
