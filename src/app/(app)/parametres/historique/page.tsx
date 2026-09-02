import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, History } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { FilterBar, ResetFilters, SelectFilter } from '@/components/ui/Filters'
import { AUDIT_ACTION, AUDIT_TABLE, dateTime, money } from '@/lib/format'
import type { AuditEntry } from '@/lib/types'

export const metadata: Metadata = { title: 'Historique' }
export const dynamic = 'force-dynamic'

const TONE = { INSERT: 'ok', UPDATE: 'info', DELETE: 'bad' } as const

/** Résumé lisible d'une ligne d'historique, selon la table concernée. */
function describe(entry: AuditEntry): string {
  const data = (entry.new_data ?? entry.old_data ?? {}) as Record<string, unknown>
  const str = (k: string) => (data[k] == null ? '' : String(data[k]))

  switch (entry.table_name) {
    case 'properties':
      return [str('reference'), str('name')].filter(Boolean).join(' — ') || '—'
    case 'tenants':
      return [str('first_name'), str('last_name')].filter(Boolean).join(' ') || '—'
    case 'contracts':
      return `Contrat du ${str('start_date') || '—'} · ${money(Number(data.monthly_rent ?? 0))}`
    case 'payments':
      return `${money(Number(data.amount ?? 0))} le ${str('payment_date') || '—'}`
    case 'expenses':
      return `${money(Number(data.amount ?? 0))} · ${str('category') || '—'}`
    default:
      return '—'
  }
}

/** Champs réellement modifiés entre l'ancienne et la nouvelle version. */
function changedFields(entry: AuditEntry): string[] {
  if (entry.action !== 'UPDATE' || !entry.old_data || !entry.new_data) return []
  const skip = new Set(['updated_at', 'created_at'])

  return Object.keys(entry.new_data)
    .filter((k) => !skip.has(k))
    .filter((k) => JSON.stringify(entry.old_data![k]) !== JSON.stringify(entry.new_data![k]))
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; action?: string }>
}) {
  const { table, action } = await searchParams
  const supabase = await createClient()

  let query = supabase.from('audit_log').select('*')
    .order('created_at', { ascending: false }).limit(300)

  if (table) query = query.eq('table_name', table)
  if (action) query = query.eq('action', action)

  const { data, error } = await query
  const entries = rows<AuditEntry>(data)

  return (
    <>
      <Link href="/parametres" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux paramètres
      </Link>

      <PageHeader
        title="Historique des modifications"
        subtitle="300 dernières opérations enregistrées, les plus récentes en premier."
      />

      <FilterBar>
        <SelectFilter
          paramName="table"
          label="Type d'élément"
          allLabel="Tous les éléments"
          options={Object.entries(AUDIT_TABLE).map(([value, label]) => ({ value, label }))}
        />
        <SelectFilter
          paramName="action"
          label="Opération"
          allLabel="Toutes les opérations"
          options={Object.entries(AUDIT_ACTION).map(([value, label]) => ({ value, label }))}
        />
        <ResetFilters />
      </FilterBar>

      {error && (
        <div role="alert" className="card border-bad-100 bg-bad-50 p-4 text-bad-700">
          Impossible de charger l&apos;historique : {error.message}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<History className="size-7" />}
            title="Aucune opération enregistrée"
            description="L'historique se remplit automatiquement dès la première création ou modification."
          />
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Élément</th><th>Opération</th><th>Détail</th><th>Champs modifiés</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const changed = changedFields(e)
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-ink-600">{dateTime(e.created_at)}</td>
                    <td className="font-medium text-ink-800">
                      {AUDIT_TABLE[e.table_name] ?? e.table_name}
                    </td>
                    <td>
                      <Badge tone={TONE[e.action] ?? 'neutral'}>{AUDIT_ACTION[e.action]}</Badge>
                    </td>
                    <td className="text-ink-700">{describe(e)}</td>
                    <td className="max-w-xs text-sm text-ink-500">
                      {changed.length > 0 ? changed.join(', ') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
