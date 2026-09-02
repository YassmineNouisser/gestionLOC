import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CalendarDays, CalendarRange, Home } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import { PageHeader } from '@/components/ui/PageHeader'
import { firstOfMonth, money, monthLabel, percent, shiftMonth } from '@/lib/format'
import type { PropertyStats } from '@/lib/types'

export const metadata: Metadata = { title: 'Rapports' }
export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('v_property_stats').select('*')
  const properties = rows<PropertyStats>(data)

  const currentMonth = firstOfMonth()
  const previousMonth = shiftMonth(currentMonth, -1)
  const currentYear = new Date().getFullYear()

  const CARDS = [
    {
      href: `/rapports/mensuel?mois=${currentMonth}`,
      icon: CalendarDays,
      title: 'Rapport mensuel',
      description: 'Loyers prévus et encaissés, montants restants, impayés, dépenses et revenu net du mois.',
      cta: monthLabel(currentMonth),
      secondary: { href: `/rapports/mensuel?mois=${previousMonth}`, label: monthLabel(previousMonth) },
    },
    {
      href: `/rapports/annuel?annee=${currentYear}`,
      icon: CalendarRange,
      title: 'Rapport annuel',
      description: 'Revenus, dépenses et revenu net mois par mois, total annuel et rentabilité du patrimoine.',
      cta: `Année ${currentYear}`,
      secondary: { href: `/rapports/annuel?annee=${currentYear - 1}`, label: `Année ${currentYear - 1}` },
    },
  ]

  return (
    <>
      <PageHeader
        title="Rapports"
        subtitle="Consultez et exportez la situation de votre patrimoine, par mois, par année ou bien par bien."
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        {CARDS.map(({ href, icon: Icon, title, description, cta, secondary }) => (
          <section key={title} className="card flex flex-col p-6">
            <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Icon className="size-6" aria-hidden />
            </span>
            <h2 className="text-lg font-bold text-ink-900">{title}</h2>
            <p className="mt-1.5 flex-1 text-[15px] text-ink-500">{description}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link href={href} className="btn-primary">
                {cta}
                <ArrowRight className="size-4.5" aria-hidden />
              </Link>
              <Link href={secondary.href} className="btn-secondary">{secondary.label}</Link>
            </div>
          </section>
        ))}
      </div>

      <section className="card">
        <div className="flex items-center gap-2 border-b border-ink-100 px-5 py-4">
          <Home className="size-5 text-ink-400" aria-hidden />
          <h2 className="text-[17px] font-bold text-ink-900">Rapport par bien</h2>
        </div>

        {properties.length === 0 ? (
          <p className="px-5 py-8 text-center text-[15px] text-ink-500">
            Aucun bien enregistré pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {properties.map((p) => (
              <li key={p.property_id}>
                <Link
                  href={`/rapports/bien/${p.property_id}`}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 hover:bg-ink-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink-900">{p.name}</span>
                    <span className="block text-sm text-ink-500">
                      {p.reference}{p.city && ` · ${p.city}`}
                    </span>
                  </span>
                  <span className="flex items-center gap-6">
                    <span className="text-right">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-ink-400">Revenu net 12 m</span>
                      <span className="block font-bold tabular-nums text-ink-900">{money(p.revenu_net_12m)}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-ink-400">Rentabilité</span>
                      <span className="block font-bold tabular-nums text-brand-700">{percent(p.rentabilite_nette)}</span>
                    </span>
                    <ArrowRight className="size-5 shrink-0 text-ink-400" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
