import type { Metadata } from 'next'
import Link from 'next/link'
import { Home, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterBar, ResetFilters, SearchFilter, SelectFilter } from '@/components/ui/Filters'
import { PropertyCard } from '@/components/properties/PropertyCard'
import { PROPERTY_STATUS, PROPERTY_TYPE, money } from '@/lib/format'
import type { Property, PropertyStats } from '@/lib/types'

export const metadata: Metadata = { title: 'Biens' }

const STATUS_OPTIONS = Object.entries(PROPERTY_STATUS).map(([value, label]) => ({ value, label }))
const TYPE_OPTIONS = Object.entries(PROPERTY_TYPE).map(([value, label]) => ({ value, label }))

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; type?: string; ville?: string }>
}) {
  const { q, statut, type, ville } = await searchParams
  const supabase = await createClient()

  let query = supabase.from('properties').select('*').order('reference')

  if (q) {
    const like = `%${q}%`
    query = query.or(
      `reference.ilike.${like},name.ilike.${like},address.ilike.${like},city.ilike.${like}`,
    )
  }
  if (statut) query = query.eq('status', statut)
  if (type) query = query.eq('type', type)
  if (ville) query = query.eq('city', ville)

  const [{ data: properties, error }, { data: stats }, { data: allCities }] = await Promise.all([
    query,
    supabase.from('v_property_stats').select('*'),
    supabase.from('properties').select('city').not('city', 'is', null),
  ])

  const list = (properties ?? []) as Property[]
  const statsById = new Map<string, PropertyStats>(
    ((stats ?? []) as PropertyStats[]).map((s) => [s.property_id, s]),
  )

  const cities = [...new Set((allCities ?? []).map((c) => c.city as string).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'fr'))

  const filtered = Boolean(q || statut || type || ville)
  const totalInvest = list.reduce((s, p) => s + Number(p.total_investment ?? 0), 0)

  return (
    <>
      <PageHeader
        title="Biens"
        subtitle={
          list.length > 0
            ? `${list.length} bien${list.length > 1 ? 's' : ''} · Investissement total ${money(totalInvest)}`
            : 'Votre patrimoine immobilier'
        }
        actions={
          <Link href="/biens/nouveau" className="btn-primary">
            <Plus className="size-5" aria-hidden />
            Ajouter un bien
          </Link>
        }
      />

      <FilterBar>
        <SearchFilter placeholder="Référence, nom, adresse, ville…" />
        <SelectFilter paramName="statut" label="Statut" options={STATUS_OPTIONS} allLabel="Tous les statuts" />
        <SelectFilter paramName="type" label="Type" options={TYPE_OPTIONS} allLabel="Tous les types" />
        {cities.length > 1 && (
          <SelectFilter
            paramName="ville"
            label="Ville"
            options={cities.map((c) => ({ value: c, label: c }))}
            allLabel="Toutes les villes"
          />
        )}
        <ResetFilters />
      </FilterBar>

      {error && (
        <div role="alert" className="card border-bad-100 bg-bad-50 p-4 text-bad-700">
          Impossible de charger les biens : {error.message}
        </div>
      )}

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Home className="size-7" />}
            title={filtered ? 'Aucun bien ne correspond à cette recherche' : 'Aucun bien enregistré'}
            description={
              filtered
                ? 'Modifiez ou réinitialisez les filtres pour voir davantage de résultats.'
                : "Commencez par ajouter votre premier bien : l'investissement total, la rentabilité et le suivi des loyers en découleront automatiquement."
            }
            action={
              !filtered && (
                <Link href="/biens/nouveau" className="btn-primary">
                  <Plus className="size-5" aria-hidden />
                  Ajouter un bien
                </Link>
              )
            }
          />
        </div>
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <PropertyCard key={p.id} property={p} stats={statsById.get(p.id)} />
          ))}
        </div>
      )}
    </>
  )
}
