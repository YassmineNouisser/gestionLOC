import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { TenantForm } from '@/components/tenants/TenantForm'
import { updateTenant } from '@/lib/actions/tenants'
import type { Tenant } from '@/lib/types'

export const metadata: Metadata = { title: 'Modifier le locataire' }

export default async function EditTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('tenants').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()

  const tenant = data as Tenant

  return (
    <>
      <Link href={`/locataires/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour à la fiche
      </Link>
      <PageHeader title={`Modifier — ${tenant.first_name} ${tenant.last_name}`} />
      <TenantForm action={updateTenant.bind(null, id)} tenant={tenant} cancelHref={`/locataires/${id}`} />
    </>
  )
}
