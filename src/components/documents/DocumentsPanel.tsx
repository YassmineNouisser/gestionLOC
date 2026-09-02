'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import {
  Download, Eye, FileText, Image as ImageIcon, Loader2, Paperclip, Upload,
} from 'lucide-react'
import { Field, FormError, FormSuccess, Select, SubmitButton } from '@/components/ui/Form'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { Modal } from '@/components/ui/Modal'
import { deleteDocument, getDocumentUrl, uploadDocument } from '@/lib/actions/documents'
import { DOC_TYPE, date, fileSize } from '@/lib/format'
import type { DocEntity, DocumentRow } from '@/lib/types'

const TYPE_OPTIONS = Object.entries(DOC_TYPE).map(([value, label]) => ({ value, label }))

function DocIcon({ mime }: { mime: string | null }) {
  const isImage = mime?.startsWith('image/')
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
      {isImage ? <ImageIcon className="size-5" aria-hidden /> : <FileText className="size-5" aria-hidden />}
    </span>
  )
}

function OpenButton({ id, name, download }: { id: string; name: string; download: boolean }) {
  const [pending, start] = useTransition()

  function open() {
    start(async () => {
      const { url, error } = await getDocumentUrl(id, download)
      if (url) window.open(url, '_blank', 'noopener')
      else alert(error ?? 'Document indisponible.')
    })
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      className="btn-ghost btn-sm text-ink-600"
      aria-label={`${download ? 'Télécharger' : 'Ouvrir'} ${name}`}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden />
               : download ? <Download className="size-4" aria-hidden />
               : <Eye className="size-4" aria-hidden />}
    </button>
  )
}

export function DocumentsPanel({
  entityType, entityId, documents, defaultDocType = 'autre', title = 'Documents', canWrite = true,
}: {
  entityType: DocEntity
  entityId: string
  documents: DocumentRow[]
  defaultDocType?: string
  title?: string
  canWrite?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(uploadDocument, { error: null, success: null })
  const [fileName, setFileName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink-900">
          <Paperclip className="size-5 text-ink-400" aria-hidden />
          {title}
          {documents.length > 0 && (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-bold text-ink-600">
              {documents.length}
            </span>
          )}
        </h2>
        {canWrite && (
          <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm">
            <Upload className="size-4" aria-hidden />
            Ajouter
          </button>
        )}
      </div>

      {documents.length === 0 ? (
        <p className="px-5 py-8 text-center text-[15px] text-ink-500">
          Aucun document associé pour le moment.
        </p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-3.5">
              <DocIcon mime={d.mime_type} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink-900">{d.name}</p>
                <p className="text-sm text-ink-500">
                  {DOC_TYPE[d.doc_type]} · {fileSize(d.size_bytes)} · {date(d.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <OpenButton id={d.id} name={d.name} download={false} />
                <OpenButton id={d.id} name={d.name} download />
                {canWrite && (
                  <DeleteButton
                    compact
                    action={deleteDocument.bind(null, d.id)}
                    title="Supprimer ce document"
                    description={`Le fichier « ${d.name} » sera définitivement supprimé. Cette action est irréversible.`}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ajouter un document"
        description="Formats acceptés : PDF, images, documents bureautiques (25 Mo maximum)."
        size="sm"
      >
        <form
          action={(fd) => { formAction(fd); setFileName('') }}
          className="space-y-5"
        >
          <input type="hidden" name="entity_type" value={entityType} />
          <input type="hidden" name="entity_id" value={entityId} />

          <FormError message={state.error} />
          <FormSuccess message={state.success} />

          <Field label="Fichier" name="file" required>
            <input
              ref={inputRef}
              id="file"
              name="file"
              type="file"
              required
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
              className="field cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink-700"
            />
          </Field>

          <Field label="Type de document" name="doc_type" required>
            <Select name="doc_type" defaultValue={defaultDocType} options={TYPE_OPTIONS} required />
          </Field>

          <Field label="Nom affiché" name="name" hint="Laissez vide pour utiliser le nom du fichier.">
            <input name="name" className="field" placeholder={fileName || 'Contrat signé, quittance…'} />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Fermer</button>
            <SubmitButton pendingLabel="Envoi en cours…">Ajouter le document</SubmitButton>
          </div>
        </form>
      </Modal>
    </section>
  )
}
