import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, Files, Image as ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import { requireUser } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { FilterBar, ResetFilters, SearchFilter, SelectFilter } from '@/components/ui/Filters'
import { DocumentOpenButtons } from '@/components/documents/DocumentActions'
import { attachOwners, ENTITY_LABEL } from '@/lib/data/documents'
import { deleteDocument } from '@/lib/actions/documents'
import { DOC_TYPE, date, fileSize } from '@/lib/format'
import type { DocEntity, DocumentRow } from '@/lib/types'

export const metadata: Metadata = { title: 'Documents' }
export const dynamic = 'force-dynamic'

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; rattachement?: string }>
}) {
  const { q, type, rattachement } = await searchParams
  const user = await requireUser()
  const supabase = await createClient()

  let query = supabase.from('documents').select('*')
    .order('created_at', { ascending: false }).limit(500)

  if (type) query = query.eq('doc_type', type)
  if (rattachement) query = query.eq('entity_type', rattachement)
  if (q) query = query.ilike('name', `%${q}%`)

  const { data, error } = await query
  const documents = await attachOwners(rows<DocumentRow>(data))

  const filtered = Boolean(q || type || rattachement)
  const totalSize = documents.reduce((s, d) => s + Number(d.size_bytes ?? 0), 0)

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle={
          documents.length > 0
            ? `${documents.length} document${documents.length > 1 ? 's' : ''} · ${fileSize(totalSize)}`
            : 'Contrats, CIN, factures, reçus, photos et documents administratifs'
        }
      />

      <FilterBar>
        <SearchFilter placeholder="Nom du document…" />
        <SelectFilter
          paramName="type"
          label="Type de document"
          allLabel="Tous les types"
          options={Object.entries(DOC_TYPE).map(([value, label]) => ({ value, label }))}
        />
        <SelectFilter
          paramName="rattachement"
          label="Rattaché à"
          allLabel="Tous les rattachements"
          options={Object.entries(ENTITY_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <ResetFilters />
      </FilterBar>

      {error && (
        <div role="alert" className="card border-bad-100 bg-bad-50 p-4 text-bad-700">
          Impossible de charger les documents : {error.message}
        </div>
      )}

      {documents.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Files className="size-7" />}
            title={filtered ? 'Aucun document pour cette sélection' : 'Aucun document enregistré'}
            description="Les documents s'ajoutent depuis la fiche d'un bien, d'un locataire, d'un contrat, d'un loyer ou d'une dépense. Ils restent rattachés à cet élément."
            action={
              !filtered && <Link href="/biens" className="btn-primary">Aller aux biens</Link>
            }
          />
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Document</th><th>Type</th><th>Rattaché à</th>
                <th>Taille</th><th>Ajouté le</th>
                <th className="no-print"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id}>
                  <td>
                    <span className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                        {d.mime_type?.startsWith('image/')
                          ? <ImageIcon className="size-4.5" aria-hidden />
                          : <FileText className="size-4.5" aria-hidden />}
                      </span>
                      <span className="min-w-0 truncate font-semibold text-ink-900">{d.name}</span>
                    </span>
                  </td>
                  <td><Badge tone="neutral" dot={false}>{DOC_TYPE[d.doc_type]}</Badge></td>
                  <td>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {ENTITY_LABEL[d.entity_type as DocEntity]}
                    </span>
                    {d.ownerHref ? (
                      <Link href={d.ownerHref} className="link">{d.ownerLabel}</Link>
                    ) : (
                      <span className="text-ink-500">{d.ownerLabel}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-ink-600">{fileSize(d.size_bytes)}</td>
                  <td className="whitespace-nowrap text-ink-600">{date(d.created_at)}</td>
                  <td className="no-print">
                    <div className="flex items-center justify-end gap-0.5">
                      <DocumentOpenButtons id={d.id} name={d.name} />
                      {user.canWrite && (
                        <DeleteButton
                          compact
                          action={deleteDocument.bind(null, d.id)}
                          title="Supprimer ce document"
                          description={`Le fichier « ${d.name} » sera définitivement supprimé du stockage.`}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
