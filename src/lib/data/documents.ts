import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import type { DocEntity, DocumentRow } from '@/lib/types'

export interface DocumentWithOwner extends DocumentRow {
  ownerLabel: string
  ownerHref: string | null
}

const PATHS: Record<DocEntity, string> = {
  property: 'biens',
  tenant: 'locataires',
  contract: 'contrats',
  payment: 'loyers',
  expense: 'depenses',
}

export const ENTITY_LABEL: Record<DocEntity, string> = {
  property: 'Bien',
  tenant: 'Locataire',
  contract: 'Contrat',
  payment: 'Paiement',
  expense: 'Dépense',
}

/**
 * Les documents sont polymorphes (pas de clé étrangère unique) : on résout
 * le libellé du propriétaire de chaque document en une requête par type.
 */
export async function attachOwners(documents: DocumentRow[]): Promise<DocumentWithOwner[]> {
  if (documents.length === 0) return []

  const supabase = await createClient()
  const idsByType = new Map<DocEntity, string[]>()
  for (const d of documents) {
    const list = idsByType.get(d.entity_type) ?? []
    list.push(d.entity_id)
    idsByType.set(d.entity_type, list)
  }

  const labels = new Map<string, string>()

  await Promise.all(
    [...idsByType].map(async ([type, ids]) => {
      const unique = [...new Set(ids)]

      if (type === 'property') {
        const { data } = await supabase.from('properties').select('id, name, reference').in('id', unique)
        for (const p of rows<{ id: string; name: string; reference: string }>(data)) {
          labels.set(`property:${p.id}`, `${p.name} (${p.reference})`)
        }
      } else if (type === 'tenant') {
        const { data } = await supabase.from('tenants').select('id, first_name, last_name').in('id', unique)
        for (const t of rows<{ id: string; first_name: string; last_name: string }>(data)) {
          labels.set(`tenant:${t.id}`, `${t.first_name} ${t.last_name}`)
        }
      } else if (type === 'contract') {
        const { data } = await supabase
          .from('contracts')
          .select('id, properties(name), tenants(first_name, last_name)')
          .in('id', unique)
        type Row = {
          id: string
          properties: { name: string } | null
          tenants: { first_name: string; last_name: string } | null
        }
        for (const c of rows<Row>(data)) {
          const tenant = c.tenants ? `${c.tenants.first_name} ${c.tenants.last_name}` : '—'
          labels.set(`contract:${c.id}`, `${c.properties?.name ?? '—'} — ${tenant}`)
        }
      } else if (type === 'payment') {
        // Les justificatifs de paiement sont rattachés au loyer concerné.
        const { data } = await supabase
          .from('v_rents').select('id, period_month, property_name, tenant_last_name').in('id', unique)
        type Row = { id: string; period_month: string; property_name: string; tenant_last_name: string }
        for (const r of rows<Row>(data)) {
          labels.set(`payment:${r.id}`, `${r.property_name} — ${r.tenant_last_name} (${r.period_month.slice(0, 7)})`)
        }
      } else if (type === 'expense') {
        const { data } = await supabase
          .from('expenses').select('id, expense_date, properties(name)').in('id', unique)
        type Row = { id: string; expense_date: string; properties: { name: string } | null }
        for (const e of rows<Row>(data)) {
          labels.set(`expense:${e.id}`, `${e.properties?.name ?? '—'} (${e.expense_date})`)
        }
      }
    }),
  )

  return documents.map((d) => {
    const key = `${d.entity_type}:${d.entity_id}`
    return {
      ...d,
      ownerLabel: labels.get(key) ?? 'Élément supprimé',
      ownerHref: labels.has(key) ? `/${PATHS[d.entity_type]}/${d.entity_id}` : null,
    }
  })
}
