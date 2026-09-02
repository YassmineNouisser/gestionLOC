import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Building2, DoorOpen, Home, Plus, Receipt, TrendingUp,
  TriangleAlert, Users, Wallet,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { row, rows } from '@/lib/supabase/rows'
import { requireUser } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatCard } from '@/components/ui/StatCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { CountUp } from '@/components/ui/CountUp'
import { RentStatusBadge } from '@/components/ui/Badge'
import { ChartCard } from '@/components/charts/ChartCard'
import {
  NetIncomeChart, RevenueExpenseChart, UnpaidChart, YieldByPropertyChart,
} from '@/components/charts/MonthlyCharts'
import { VIZ } from '@/components/charts/theme'
import { lastMonths } from '@/lib/data/series'
import { date, dateLong, money, monthLabel, percent, firstOfMonth } from '@/lib/format'
import type { DashboardStats, MonthlySummary, PropertyStats, RentView } from '@/lib/types'

export const metadata: Metadata = { title: 'Tableau de bord' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await requireUser()
  const supabase = await createClient()

  // Filet de sécurité : crée les loyers du mois si un nouveau mois a commencé.
  // Idempotent, et volontairement limité aux écrans où l'absence se verrait.
  await supabase.rpc('generate_rents')

  const [
    { data: statsRow }, { data: monthlyRows }, { data: propertyStatRows }, { data: overdueRows },
  ] = await Promise.all([
    supabase.from('v_dashboard').select('*').maybeSingle(),
    supabase.from('v_monthly_summary').select('*').order('period_month', { ascending: false }).limit(24),
    supabase.from('v_property_stats').select('*'),
    supabase.from('v_rents').select('*').order('due_date', { ascending: true }).limit(300),
  ])

  const stats = row<DashboardStats>(statsRow)
  const monthly = lastMonths(rows<MonthlySummary>(monthlyRows), 12)
  const propertyStats = rows<PropertyStats>(propertyStatRows)
  const allRents = rows<RentView>(overdueRows)
  const overdue = allRents.filter((r) => r.is_overdue).slice(0, 6)

  const currentMonth = firstOfMonth()
  const collectionRate =
    Number(stats?.loyers_prevus_mois ?? 0) > 0
      ? (Number(stats?.loyers_encaisses_mois) / Number(stats?.loyers_prevus_mois)) * 100
      : null

  const yieldData = propertyStats
    .filter((p) => p.rentabilite_nette !== null)
    .map((p) => ({ name: p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name, rentabilite: Number(p.rentabilite_nette) }))
    .sort((a, b) => b.rentabilite - a.rentabilite)
    .slice(0, 10)

  const isEmpty = (stats?.nb_biens ?? 0) === 0

  if (isEmpty) {
    return (
      <>
        <PageHeader title={`Bonjour ${user.fullName.split(' ')[0]}`} subtitle="Bienvenue dans votre application de gestion locative." />
        <div className="card">
          <EmptyState
            icon={<Home className="size-7" />}
            title="Commencez par ajouter votre premier bien"
            description="Ensuite : créez un locataire, reliez-les par un contrat, et les loyers mensuels seront générés automatiquement. Tous les calculs — restes, impayés, rentabilité — se mettent à jour tout seuls."
            action={
              <Link href="/biens/nouveau" className="btn-primary">
                <Plus className="size-5" aria-hidden />
                Ajouter un bien
              </Link>
            }
          />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle={`Situation au ${dateLong(new Date().toISOString())}`}
        actions={
          user.canWrite && (
            <>
              <Link href="/depenses/nouvelle" className="btn-secondary">
                <Plus className="size-5" aria-hidden />
                Dépense
              </Link>
              <Link href="/biens/nouveau" className="btn-primary">
                <Plus className="size-5" aria-hidden />
                Bien
              </Link>
            </>
          )
        }
      />

      {/* Recouvrement du mois : la question la plus fréquente, en premier */}
      <section className="card reveal mb-8 overflow-hidden">
        <span
          className="block h-1 bg-gradient-to-r from-brand-600 via-brand-500 to-gold-400"
          aria-hidden
        />
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center">
          <div className="min-w-0">
            <p className="section-title mb-2">Recouvrement · {monthLabel(currentMonth)}</p>

            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <CountUp
                value={Number(stats?.loyers_encaisses_mois ?? 0)}
                format="money"
                className="font-display text-[2.4rem] leading-none text-ink-900 sm:text-[2.9rem]"
              />
              <span className="text-[15px] text-ink-500">
                encaissés sur {money(stats?.loyers_prevus_mois)} attendus
              </span>
            </p>

            <div className="mt-5 max-w-2xl">
              <ProgressBar
                value={Number(stats?.loyers_encaisses_mois ?? 0)}
                max={Number(stats?.loyers_prevus_mois ?? 0)}
                label={`Loyers encaissés en ${monthLabel(currentMonth)}`}
              />
              <p className="mt-2 flex flex-wrap justify-between gap-x-4 text-[13px] font-semibold text-ink-500">
                <span>
                  {collectionRate !== null
                    ? `${Math.round(collectionRate)} % du montant attendu`
                    : 'Aucun loyer généré ce mois'}
                </span>
                <span>
                  Reste{' '}
                  <span className={Number(stats?.montant_restant_mois ?? 0) > 0 ? 'text-warn-700' : 'text-ok-700'}>
                    {money(stats?.montant_restant_mois)}
                  </span>
                </span>
              </p>
            </div>
          </div>

          {/* Trois repères secondaires, séparés par un filet plutôt que par des cartes */}
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-ink-200">
            {[
              { label: 'Loyers prévus', value: money(stats?.loyers_prevus_mois), tone: 'text-ink-900', href: '/loyers' },
              { label: 'Dépenses', value: money(stats?.depenses_mois), tone: 'text-warn-700', href: '/depenses' },
              {
                label: 'Impayés',
                value: money(stats?.total_impayes),
                tone: Number(stats?.total_impayes ?? 0) > 0 ? 'text-bad-700' : 'text-ink-400',
                href: '/loyers?statut=impaye',
              },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="bg-white px-4 py-4 transition-colors hover:bg-ink-50"
              >
                <dt className="text-[12px] font-semibold text-ink-500">{item.label}</dt>
                <dd className={`mt-1 text-[15px] font-bold tabular-nums ${item.tone}`}>{item.value}</dd>
              </Link>
            ))}
          </dl>
        </div>
      </section>

      {/* Patrimoine */}
      <h2 className="section-title">Patrimoine</h2>
      <div className="stagger mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Biens" value={<CountUp value={stats?.nb_biens ?? 0} format="integer" />}
                  hint={`Investissement ${money(stats?.investissement_total)}`}
                  icon={<Home className="size-5" />} href="/biens" />
        <StatCard label="Biens loués" value={<CountUp value={stats?.nb_biens_loues ?? 0} format="integer" />}
                  hint={`${stats?.nb_contrats_actifs ?? 0} contrat${(stats?.nb_contrats_actifs ?? 0) > 1 ? 's' : ''} actif${(stats?.nb_contrats_actifs ?? 0) > 1 ? 's' : ''}`}
                  tone="ok" icon={<Building2 className="size-5" />} href="/biens?statut=loue" />
        <StatCard label="Biens libres" value={<CountUp value={stats?.nb_biens_libres ?? 0} format="integer" />}
                  hint={(stats?.nb_biens_maintenance ?? 0) > 0 ? `${stats?.nb_biens_maintenance} en maintenance` : 'Aucun en maintenance'}
                  tone="brand" icon={<DoorOpen className="size-5" />} href="/biens?statut=libre" />
        <StatCard label="Locataires" value={<CountUp value={stats?.nb_locataires ?? 0} format="integer" />}
                  icon={<Users className="size-5" />} href="/locataires" />
      </div>

      {/* Résultat */}
      <h2 className="section-title">Résultat</h2>
      <div className="stagger mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Loyers encaissés ce mois" value={<CountUp value={Number(stats?.loyers_encaisses_mois ?? 0)} format="money" />}
                  hint={collectionRate !== null ? `${Math.round(collectionRate)} % du montant attendu` : undefined}
                  tone="ok" icon={<Wallet className="size-5" />} href="/paiements" />
        <StatCard label="Revenu net du mois" value={<CountUp value={Number(stats?.revenu_net_mois ?? 0)} format="money" />}
                  hint="Loyers encaissés − dépenses"
                  tone={Number(stats?.revenu_net_mois ?? 0) >= 0 ? 'ok' : 'bad'}
                  icon={<Receipt className="size-5" />} />
        <StatCard label="Rentabilité globale" value={stats?.rentabilite_globale != null ? percent(stats.rentabilite_globale) : '—'}
                  hint={`Revenu net 12 mois : ${money(stats?.revenu_net_12m)}`}
                  tone="brand" icon={<TrendingUp className="size-5" />} href="/rentabilite" />
        <StatCard label="Loyers en retard" value={<CountUp value={stats?.nb_impayes ?? 0} format="integer" />}
                  hint={`${money(stats?.total_impayes)} à recouvrer`}
                  tone={Number(stats?.total_impayes ?? 0) > 0 ? 'bad' : 'default'}
                  icon={<TriangleAlert className="size-5" />} href="/loyers?statut=impaye" />
      </div>

      {/* Graphiques */}
      <div className="stagger mb-8 grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Loyers encaissés et dépenses"
          subtitle="12 derniers mois"
          legend={[
            { label: 'Loyers encaissés', color: VIZ.series1 },
            { label: 'Dépenses', color: VIZ.series2 },
          ]}
          action={<Link href="/rapports" className="link text-sm">Rapports</Link>}
        >
          <RevenueExpenseChart data={monthly} />
        </ChartCard>

        <ChartCard title="Revenu net par mois" subtitle="Loyers encaissés moins dépenses, 12 derniers mois">
          <NetIncomeChart data={monthly} />
        </ChartCard>

        <ChartCard title="Impayés par mois" subtitle="Montants dus dont l'échéance est dépassée">
          <UnpaidChart data={monthly} />
        </ChartCard>

        <ChartCard
          title="Rentabilité nette par bien"
          subtitle={yieldData.length > 0 ? 'Revenu net des 12 derniers mois rapporté à l’investissement' : undefined}
          action={<Link href="/rentabilite" className="link text-sm">Détail</Link>}
        >
          {yieldData.length > 0 ? (
            <YieldByPropertyChart data={yieldData} />
          ) : (
            <p className="py-12 text-center text-[15px] text-ink-500">
              La rentabilité apparaît dès qu&apos;un bien a un investissement renseigné.
            </p>
          )}
        </ChartCard>
      </div>

      {/* Impayés à traiter */}
      {overdue.length > 0 && (
        <section className="card reveal">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink-900">
              <TriangleAlert className="size-5 text-bad-600" aria-hidden />
              Impayés à traiter
            </h2>
            <Link href="/loyers?statut=impaye" className="link text-sm">Tout voir</Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Mois</th><th>Bien</th><th>Locataire</th><th>Échéance</th>
                    <th className="text-right">Reste</th><th>Statut</th></tr>
              </thead>
              <tbody>
                {overdue.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">
                      <Link href={`/loyers/${r.id}`} className="link">{monthLabel(r.period_month)}</Link>
                    </td>
                    <td className="text-ink-700">{r.property_name}</td>
                    <td className="text-ink-700">{r.tenant_first_name} {r.tenant_last_name}</td>
                    <td className="whitespace-nowrap text-ink-600">
                      {date(r.due_date)}
                      <span className="block text-xs font-semibold text-bad-600">{r.days_overdue} j de retard</span>
                    </td>
                    <td className="text-right font-bold tabular-nums text-bad-700">{money(r.balance)}</td>
                    <td><RentStatusBadge status={r.status} /></td>
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
