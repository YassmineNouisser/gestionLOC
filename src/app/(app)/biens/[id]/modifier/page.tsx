import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { PropertyForm } from '@/components/properties/PropertyForm'
import { updateProperty } from '@/lib/actions/properties'
import type { Property } from '@/lib/types'

export const metadata: Metadata = { title: 'Modifier le bien' }

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('properties').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()

  const property = data as Property
  const action = updateProperty.bind(null, id)

  return (
    <>
      <Link href={`/biens/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour à la fiche
      </Link>
      <PageHeader title={`Modifier — ${property.name}`} subtitle={property.reference} />
      <PropertyForm action={action} property={property} cancelHref={`/biens/${id}`} />
    </>
  )
}
