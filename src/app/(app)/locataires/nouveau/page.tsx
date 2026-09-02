import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { TenantForm } from '@/components/tenants/TenantForm'
import { createTenant } from '@/lib/actions/tenants'

export const metadata: Metadata = { title: 'Nouveau locataire' }

export default function NewTenantPage() {
  return (
    <>
      <Link href="/locataires" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux locataires
      </Link>
      <PageHeader title="Ajouter un locataire" subtitle="Les champs marqués d'une étoile sont obligatoires." />
      <TenantForm action={createTenant} cancelHref="/locataires" />
    </>
  )
}
