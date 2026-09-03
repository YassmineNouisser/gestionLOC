import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { row } from '@/lib/supabase/rows'
import { PageHeader } from '@/components/ui/PageHeader'
import { ReadingForm } from '@/components/readings/ReadingForm'
import { updateReading } from '@/lib/actions/readings'
import { loadReadingOptions } from '@/lib/data/readings'
import { monthLabel } from '@/lib/format'
import type { MeterReading } from '@/lib/types'

export const metadata: Metadata = { title: 'Modifier le relevé' }
export const dynamic = 'force-dynamic'

export default async function EditReadingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data }, properties] = await Promise.all([
    supabase.from('meter_readings').select('*').eq('id', id).maybeSingle(),
    loadReadingOptions(),
  ])

  const reading = row<MeterReading>(data)
  if (!reading) notFound()

  return (
    <>
      <Link href="/releves" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux relevés
      </Link>
      <PageHeader title={`Relevé de ${monthLabel(reading.period_month)}`} />
      <ReadingForm
        action={updateReading.bind(null, id)}
        reading={reading}
        properties={properties}
        cancelHref="/releves"
      />
    </>
  )
}
