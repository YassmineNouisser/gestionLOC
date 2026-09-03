import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ReadingForm } from '@/components/readings/ReadingForm'
import { createReading } from '@/lib/actions/readings'
import { loadReadingOptions } from '@/lib/data/readings'

export const metadata: Metadata = { title: 'Nouveau relevé' }
export const dynamic = 'force-dynamic'

export default async function NewReadingPage({
  searchParams,
}: {
  searchParams: Promise<{ bien?: string }>
}) {
  const { bien } = await searchParams
  const properties = await loadReadingOptions()

  return (
    <>
      <Link href="/releves" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux relevés
      </Link>
      <PageHeader
        title="Nouveau relevé"
        subtitle="Saisissez les index : la consommation et les montants se calculent au fur et à mesure."
      />

      {properties.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Aucun bien enregistré"
            description="Ajoutez d'abord un bien pour pouvoir y relever des compteurs."
            action={
              <Link href="/biens/nouveau" className="btn-primary">
                <Plus className="size-5" aria-hidden />
                Ajouter un bien
              </Link>
            }
          />
        </div>
      ) : (
        <ReadingForm
          action={createReading}
          properties={properties}
          defaultPropertyId={bien}
          cancelHref="/releves"
        />
      )}
    </>
  )
}
