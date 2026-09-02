import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, Home, Receipt, Search, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  ContractStatusBadge, PropertyStatusBadge, RentStatusBadge,
} from '@/components/ui/Badge'
import { PROPERTY_TYPE, date, money, monthLabel } from '@/lib/format'
import type { Contract, Property, RentView, Tenant } from '@/lib/types'

export const metadata: Metadata = { title: 'Recherche' }
export const dynamic = 'force-dynamic'

type ContractResult = Contract & {
  properties: Pick<Property, 'name' | 'reference'> | null
  tenants: Pick<Tenant, 'first_name' | 'last_name'> | null
}

function Section({
  icon, title, count, children,
}: {
  icon: React.ReactNode
  title: string
  count: number
  children: React.ReactNode
}) {
  if (count === 0) return null
  return (
    <section className="card mb-6">
      <h2 className="flex items-center gap-2 border-b border-ink-100 px-5 py-4 text-[17px] font-bold text-ink-900">
        <span className="text-ink-400" aria-hidden>{icon}</span>
        {title}
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-bold text-ink-600">{count}</span>
      </h2>
      {children}
    </section>
  )
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const term = (q ?? '').trim()

  if (term.length < 2) {
    return (
      <>
        <PageHeader title="Recherche" subtitle="Recherchez un locataire, un bien, un contrat ou un loyer." />
        <div className="card">
          <EmptyState
            icon={<Search className="size-7" />}
            title="Saisissez au moins deux caractères"
            description="La recherche porte sur le nom du locataire, sa CIN, son téléphone, la référence et l'adresse d'un bien, ainsi que les contrats et loyers correspondants."
          />
        </div>
      </>
    )
  }

  const like = `%${term}%`
  const supabase = await createClient()

  const [{ data: tenantRows }, { data: propertyRows }, { data: contractRows }, { data: rentRows }] =
    await Promise.all([
      supabase.from('tenants').select('*')
        .or(`first_name.ilike.${like},last_name.ilike.${like},cin.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
        .order('last_name').limit(25),
      supabase.from('properties').select('*')
        .or(`reference.ilike.${like},name.ilike.${like},address.ilike.${like},city.ilike.${like}`)
        .order('reference').limit(25),
      supabase.from('contracts')
        .select('*, properties(name, reference), tenants(first_name, last_name)')
        .order('start_date', { ascending: false }).limit(200),
      supabase.from('v_rents').select('*')
        .order('period_month', { ascending: false }).limit(400),
    ])

  const tenants = rows<Tenant>(tenantRows)
  const properties = rows<Property>(propertyRows)

  // Contrats et loyers : filtrage applicatif car la recherche porte
  // sur les relations imbriquées (bien et locataire).
  const needle = term.toLowerCase()
  const contracts = rows<ContractResult>(contractRows).filter((c) =>
    [c.properties?.name, c.properties?.reference, c.tenants?.first_name, c.tenants?.last_name]
      .some((v) => v?.toLowerCase().includes(needle)),
  ).slice(0, 25)

  const rents = rows<RentView>(rentRows).filter((r) =>
    [r.property_name, r.property_reference, r.tenant_first_name, r.tenant_last_name, r.tenant_cin]
      .some((v) => v?.toLowerCase().includes(needle)),
  ).slice(0, 25)

  const unpaid = rents.filter((r) => r.balance > 0)
  const total = tenants.length + properties.length + contracts.length + rents.length

  return (
    <>
      <PageHeader
        title={`Résultats pour « ${term} »`}
        subtitle={total > 0 ? `${total} résultat${total > 1 ? 's' : ''}` : undefined}
      />

      {total === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Search className="size-7" />}
            title="Aucun résultat"
            description="Vérifiez l'orthographe, ou essayez avec une partie du nom, une référence de bien ou un numéro de CIN."
          />
        </div>
      ) : (
        <>
          <Section icon={<Users className="size-5" />} title="Locataires" count={tenants.length}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Nom</th><th>CIN</th><th>Téléphone</th><th>Email</th></tr></thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/locataires/${t.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                          {t.first_name} {t.last_name}
                        </Link>
                      </td>
                      <td className="tabular-nums text-ink-600">{t.cin ?? '—'}</td>
                      <td className="text-ink-600">{t.phone ?? '—'}</td>
                      <td className="text-ink-600">{t.email ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section icon={<Home className="size-5" />} title="Biens" count={properties.length}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Bien</th><th>Type</th><th>Adresse</th><th className="text-right">Loyer</th><th>Statut</th></tr></thead>
                <tbody>
                  {properties.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/biens/${p.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                          {p.name}
                        </Link>
                        <span className="block text-sm text-ink-500">{p.reference}</span>
                      </td>
                      <td className="text-ink-600">{PROPERTY_TYPE[p.type]}</td>
                      <td className="text-ink-600">{[p.address, p.city].filter(Boolean).join(', ') || '—'}</td>
                      <td className="text-right tabular-nums">{money(p.monthly_rent)}</td>
                      <td><PropertyStatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section icon={<FileText className="size-5" />} title="Contrats" count={contracts.length}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Bien</th><th>Locataire</th><th>Période</th><th className="text-right">Loyer</th><th>Statut</th></tr></thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/contrats/${c.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                          {c.properties?.name ?? '—'}
                        </Link>
                      </td>
                      <td className="text-ink-600">
                        {c.tenants ? `${c.tenants.first_name} ${c.tenants.last_name}` : '—'}
                      </td>
                      <td className="whitespace-nowrap text-ink-600">
                        {date(c.start_date)} → {c.end_date ? date(c.end_date) : 'Indéterminée'}
                      </td>
                      <td className="text-right tabular-nums">{money(c.monthly_rent)}</td>
                      <td><ContractStatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            icon={<Receipt className="size-5" />}
            title={unpaid.length > 0 ? `Loyers (dont ${unpaid.length} non soldé${unpaid.length > 1 ? 's' : ''})` : 'Loyers'}
            count={rents.length}
          >
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Mois</th><th>Bien</th><th>Locataire</th>
                      <th className="text-right">Dû</th><th className="text-right">Reste</th><th>Statut</th></tr>
                </thead>
                <tbody>
                  {rents.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">
                        <Link href={`/loyers/${r.id}`} className="link">{monthLabel(r.period_month)}</Link>
                      </td>
                      <td className="text-ink-600">{r.property_name}</td>
                      <td className="text-ink-600">{r.tenant_first_name} {r.tenant_last_name}</td>
                      <td className="text-right tabular-nums">{money(r.amount_due)}</td>
                      <td className={`text-right font-semibold tabular-nums ${r.balance > 0 ? 'text-bad-700' : 'text-ink-400'}`}>
                        {money(r.balance)}
                      </td>
                      <td><RentStatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </>
  )
}
