'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { type ActionState, pgMessage, requiredText, text } from './shared'
import type { DocEntity } from '@/lib/types'

const MAX_SIZE = 25 * 1024 * 1024 // 25 Mo — aligné sur le bucket Supabase

/** Nettoie un nom de fichier pour un chemin de stockage sûr. */
function safeName(name: string): string {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return normalized.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
}

export async function uploadDocument(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const entityType = requiredText(fd, 'entity_type') as DocEntity
  const entityId = requiredText(fd, 'entity_id')
  const docType = requiredText(fd, 'doc_type') || 'autre'
  const file = fd.get('file')

  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Merci de sélectionner un fichier.' }
  }
  if (file.size > MAX_SIZE) {
    return { error: 'Le fichier dépasse 25 Mo. Compressez-le ou choisissez un fichier plus léger.' }
  }

  const supabase = await createClient()
  const label = text(fd, 'name') ?? file.name
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const path = `${entityType}/${entityId}/${stamp}-${safeName(file.name)}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (uploadError) {
    return { error: `Envoi du fichier impossible : ${uploadError.message}` }
  }

  const { error } = await supabase.from('documents').insert({
    entity_type: entityType,
    entity_id: entityId,
    doc_type: docType,
    name: label,
    storage_path: path,
    mime_type: file.type || null,
    size_bytes: file.size,
  })

  if (error) {
    // On ne laisse pas de fichier orphelin dans le stockage.
    await supabase.storage.from('documents').remove([path])
    return { error: pgMessage(error) }
  }

  revalidatePath('/documents')
  revalidatePath(`/${entityPath(entityType)}/${entityId}`)
  return { error: null, success: 'Document ajouté.' }
}

export async function deleteDocument(id: string): Promise<ActionState> {
  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path, entity_type, entity_id')
    .eq('id', id)
    .maybeSingle()

  if (!doc) return { error: 'Document introuvable.' }

  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) return { error: pgMessage(error) }

  await supabase.storage.from('documents').remove([doc.storage_path])

  revalidatePath('/documents')
  revalidatePath(`/${entityPath(doc.entity_type as DocEntity)}/${doc.entity_id}`)
  return { error: null }
}

/** URL signée temporaire (10 min) pour consulter ou télécharger un document. */
export async function getDocumentUrl(
  id: string,
  download = false,
): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path, name')
    .eq('id', id)
    .maybeSingle()

  if (!doc) return { url: null, error: 'Document introuvable.' }

  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(doc.storage_path, 600, download ? { download: doc.name } : undefined)

  if (error || !data) return { url: null, error: "Lien de téléchargement indisponible." }
  return { url: data.signedUrl, error: null }
}

function entityPath(entity: DocEntity): string {
  return {
    property: 'biens',
    tenant: 'locataires',
    contract: 'contrats',
    payment: 'paiements',
    expense: 'depenses',
  }[entity]
}
