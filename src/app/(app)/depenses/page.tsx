import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, CalendarRange, Plus, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import { requireUser } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { CategoryBadge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { FilterBar, MonthFilter, ResetFilters, SearchFilter, SelectFilter } from '@/components/ui/Filters'
import { ExpenseEditDialog } from '@/components/expenses/ExpenseEditDialog'
import { deleteExpense } from '@/lib/actions/expenses'
import { EXPENSE_CATEGORY, date, firstOfMonth, money, monthLabel, shiftMonth } from '@/lib/format'
import type { Expense, Property } from '@/lib/types'

export const metadata: Metadata = { title: 'Dépenses' }

type ExpenseRow = Expense & {
  properties: Pick<Property, 'id' | 'name' | 'reference'> | null
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mois?: string; categorie?: string; bien?: string }>
}) {
  const { q, mois, categorie, bien } = await searchParams
  const user = await requireUser()
  const supabase = await createClient()

  const currentMonth = firstOfMonth()
  const year = Number((mois ?? currentMonth).slice(0, 4))

  let query = supabase
    .from('expenses')
    .select('*, properties(id, name, reference)')
    .order('expense_date', { ascending: false })
    .limit(500)

  if (mois) query = query.gte('expense_date', mois).lt('expense_date', shiftMonth(mois, 1))
  if (categorie) query = query.eq('category', categorie)
  if (bien) query = query.eq('property_id', bien)

  const [{ data, error }, { data: propertyRows }, { data: monthTotalRows }, { data: yearTotalRows }] =
    await Promise.all([
      query,
      supabase.from('properties').select('id, reference, name').order('reference'),
      supabase.from('expenses').select('amount')
        .gte('expense_date', currentMonth).lt('expense_date', shiftMonth(currentMonth, 1)),
      supabase.from('expenses').select('amount')
        .gte('expense_date', `${year}-01-01`).lte('expense_date', `${year}-12-31`),
    ])

  let expenses = rows<ExpenseRow>(data)
  if (q) {
    const needle = q.toLowerCase()
    expenses = expenses.filter((e) =>
      [e.description, e.properties?.name, e.properties?.reference, EXPENSE_CATEGORY[e.category]]
        .some((v) => v?.toLowerCase().includes(needle)),
    )
  }

  const properties = rows<Pick<Property, 'id' | 'reference' | 'name'>>(propertyRows)
  const sum = (list: { amount: number }[]) => list.reduce((s, e) => s + Number(e.amount), 0)

  const totalSelection = sum(expenses)
  const totalMonth = sum(rows<{ amount: number }>(monthTotalRows))
  const totalYear = sum(rows<{ amount: number }>(yearTotalRows))

  // Répartition par catégorie sur la sélection courante.
  const byCategory = [...expenses.reduce((acc, e) => {
    acc.set(e.category, (acc.get(e.category) ?? 0) + Number(e.amount))
    return acc
  }, new Map<string, number>())].sort((a, b) => b[1] - a[1])

  const filtered = Boolean(q || mois || categorie || bien)

  return (
    <>
      <PageHeader
        title="Dépenses"
        subtitle={mois ? monthLabel(mois) : 'Toutes les dépenses liées à vos biens'}
        actions={
          user.canWrite && (
            <Link href="/depenses/nouvelle" className="btn-primary">
              <Plus className="size-5" aria-hidden />
              Ajouter une dépense
            </Link>
          )
        }
      />

      <div className="stagger mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total de la sélection"
          value={money(totalSelection)}
          hint={`${expenses.length} dépense${expenses.length > 1 ? 's' : ''}`}
          icon={<Receipt className="size-5" />}
        />
        <StatCard label={`Mois en cours (${monthLabel(currentMonth)})`} value={money(totalMonth)} tone="warn"
                  icon={<CalendarRange className="size-5" />} />
        <StatCard label={`Année ${year}`} value={money(totalYear)} tone="warn"
                  icon={<Building2 className="size-5" />} />
      </div>

      <FilterBar>
        <SearchFilter placeholder="Description, bien, catégorie…" />
        <MonthFilter />
        <SelectFilter
          paramName="categorie"
          label="Catégorie"
          allLabel="Toutes les catégories"
          options={Object.entries(EXPENSE_CATEGORY).map(([value, label]) => ({ value, label }))}
        />
        <SelectFilter
          paramName="bien"
          label="Bien"
          allLabel="Tous les biens"
          options={properties.map((p) => ({ value: p.id, label: `${p.reference} — ${p.name}` }))}
        />
        <ResetFilters />
      </FilterBar>

      {error && (
        <div role="alert" className="card border-bad-100 bg-bad-50 p-4 text-bad-700">
          Impossible de charger les dépenses : {error.message}
        </div>
      )}

      {byCategory.length > 1 && (
        <section className="card mb-6 p-5">
          <h2 className="mb-3 text-[15px] font-bold text-ink-900">Répartition par catégorie</h2>
          <ul className="flex flex-wrap gap-2">
            {byCategory.map(([cat, amount]) => (
              <li key={cat} className="rounded-lg bg-ink-50 px-3.5 py-2">
                <span className="block text-xs font-semibold text-ink-500">
                  {EXPENSE_CATEGORY[cat as keyof typeof EXPENSE_CATEGORY]}
                </span>
                <span className="block font-bold tabular-nums text-ink-900">{money(amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {expenses.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Receipt className="size-7" />}
            title={filtered ? 'Aucune dépense pour cette sélection' : 'Aucune dépense enregistrée'}
            description="Enregistrez vos réparations, charges et taxes : elles sont automatiquement déduites du revenu net et de la rentabilité de chaque bien."
            action={
              user.canWrite && (
                <Link href="/depenses/nouvelle" className="btn-primary">
                  <Plus className="size-5" aria-hidden />
                  Ajouter une dépense
                </Link>
              )
            }
          />
        </div>
      ) : (
        <div className="card reveal table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th><th>Bien</th><th>Catégorie</th><th>Description</th>
                <th className="text-right">Montant</th>
                {user.canWrite && <th className="no-print"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap font-medium">{date(e.expense_date)}</td>
                  <td>
                    <Link href={`/biens/${e.property_id}`} className="text-ink-800 hover:text-brand-700">
                      {e.properties?.name ?? '—'}
                    </Link>
                  </td>
                  <td><CategoryBadge category={e.category} /></td>
                  <td className="max-w-sm text-ink-600">{e.description ?? '—'}</td>
                  <td className="text-right font-semibold tabular-nums">{money(e.amount)}</td>
                  {user.canWrite && (
                    <td className="no-print">
                      <div className="flex items-center justify-end gap-0.5">
                        <ExpenseEditDialog expense={e} properties={properties} />
                        <DeleteButton
                          compact
                          action={deleteExpense.bind(null, e.id)}
                          title="Supprimer cette dépense"
                          description={`La dépense de ${money(e.amount)} du ${date(e.expense_date)} sera supprimée. La rentabilité du bien sera recalculée.`}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-ink-50">
                <td colSpan={4} className="px-4 py-3 font-bold text-ink-800">Total</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">{money(totalSelection)}</td>
                {user.canWrite && <td className="no-print" />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
