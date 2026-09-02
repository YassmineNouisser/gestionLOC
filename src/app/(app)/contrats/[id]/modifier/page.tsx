import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { row } from '@/lib/supabase/rows'
import { PageHeader } from '@/components/ui/PageHeader'
import { ContractForm } from '@/components/contracts/ContractForm'
import { updateContract } from '@/lib/actions/contracts'
import { loadContractOptions } from '@/lib/data/options'
import type { Contract } from '@/lib/types'

export const metadata: Metadata = { title: 'Modifier le contrat' }

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data }, options] = await Promise.all([
    supabase.from('contracts').select('*').eq('id', id).maybeSingle(),
    loadContractOptions(),
  ])

  const contract = row<Contract>(data)
  if (!contract) notFound()

  return (
    <>
      <Link href={`/contrats/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour au contrat
      </Link>
      <PageHeader
        title="Modifier le contrat"
        subtitle="Modifier le loyer met à jour les mois à venir non encore réglés. Les mois déjà payés restent inchangés."
      />
      <ContractForm
        action={updateContract.bind(null, id)}
        contract={contract}
        properties={options.properties}
        tenants={options.tenants}
        cancelHref={`/contrats/${id}`}
      />
    </>
  )
}
