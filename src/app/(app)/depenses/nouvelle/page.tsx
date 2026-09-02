import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { createExpense } from '@/lib/actions/expenses'
import type { Property } from '@/lib/types'

export const metadata: Metadata = { title: 'Nouvelle dépense' }

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ bien?: string }>
}) {
  const { bien } = await searchParams
  const supabase = await createClient()
  const { data } = await supabase.from('properties').select('id, reference, name').order('reference')
  const properties = rows<Pick<Property, 'id' | 'reference' | 'name'>>(data)

  return (
    <>
      <Link href="/depenses" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux dépenses
      </Link>
      <PageHeader
        title="Nouvelle dépense"
        subtitle="Chaque dépense est rattachée à un bien et déduite automatiquement de sa rentabilité."
      />

      {properties.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Aucun bien enregistré"
            description="Ajoutez d'abord un bien pour pouvoir lui rattacher une dépense."
            action={
              <Link href="/biens/nouveau" className="btn-primary">
                <Plus className="size-5" aria-hidden />
                Ajouter un bien
              </Link>
            }
          />
        </div>
      ) : (
        <ExpenseForm
          action={createExpense}
          properties={properties}
          defaultPropertyId={bien}
          cancelHref="/depenses"
        />
      )}
    </>
  )
}
