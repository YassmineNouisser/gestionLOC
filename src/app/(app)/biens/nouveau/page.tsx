import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { PropertyForm } from '@/components/properties/PropertyForm'
import { createProperty } from '@/lib/actions/properties'

export const metadata: Metadata = { title: 'Nouveau bien' }

export default function NewPropertyPage() {
  return (
    <>
      <Link href="/biens" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux biens
      </Link>
      <PageHeader title="Ajouter un bien" subtitle="Les champs marqués d'une étoile sont obligatoires." />
      <PropertyForm action={createProperty} cancelHref="/biens" />
    </>
  )
}
