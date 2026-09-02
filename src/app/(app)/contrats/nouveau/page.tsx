import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ContractForm } from '@/components/contracts/ContractForm'
import { createContract } from '@/lib/actions/contracts'
import { loadContractOptions } from '@/lib/data/options'

export const metadata: Metadata = { title: 'Nouveau contrat' }

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ bien?: string; locataire?: string }>
}) {
  const { bien, locataire } = await searchParams
  const { properties, tenants } = await loadContractOptions()

  const missing = properties.length === 0 || tenants.length === 0

  return (
    <>
      <Link href="/contrats" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux contrats
      </Link>
      <PageHeader
        title="Nouveau contrat"
        subtitle="Le contrat relie un bien à un locataire et déclenche la génération automatique des loyers."
      />

      {missing ? (
        <div className="card">
          <EmptyState
            title="Il manque des éléments pour créer un contrat"
            description={
              properties.length === 0 && tenants.length === 0
                ? 'Ajoutez au moins un bien et un locataire.'
                : properties.length === 0
                  ? 'Ajoutez au moins un bien.'
                  : 'Ajoutez au moins un locataire.'
            }
            action={
              <div className="flex flex-wrap justify-center gap-3">
                {properties.length === 0 && (
                  <Link href="/biens/nouveau" className="btn-primary">
                    <Plus className="size-5" aria-hidden />
                    Ajouter un bien
                  </Link>
                )}
                {tenants.length === 0 && (
                  <Link href="/locataires/nouveau" className="btn-primary">
                    <Plus className="size-5" aria-hidden />
                    Ajouter un locataire
                  </Link>
                )}
              </div>
            }
          />
        </div>
      ) : (
        <ContractForm
          action={createContract}
          properties={properties}
          tenants={tenants}
          defaultPropertyId={bien}
          defaultTenantId={locataire}
          cancelHref="/contrats"
        />
      )}
    </>
  )
}
