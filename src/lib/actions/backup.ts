'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import { type ActionState, pgMessage } from './shared'

/** Tables sauvegardées, dans l'ordre des dépendances (parents d'abord). */
const TABLES = [
  'tenants', 'properties', 'contracts', 'rents', 'payments', 'expenses', 'documents',
] as const

type TableName = (typeof TABLES)[number]

export interface BackupFile {
  format: 'gestion-locative-backup'
  version: 1
  exportedAt: string
  counts: Record<string, number>
  data: Record<string, Record<string, unknown>[]>
}

/**
 * Export complet des données métier au format JSON.
 * Les fichiers du stockage (documents) ne sont pas inclus : seules leurs
 * métadonnées le sont, les fichiers restent dans le bucket Supabase.
 */
export async function exportBackup(): Promise<
  { backup: BackupFile; error: null } | { backup: null; error: string }
> {
  const supabase = await createClient()
  const data: Record<string, Record<string, unknown>[]> = {}
  const counts: Record<string, number> = {}

  for (const table of TABLES) {
    const { data: tableRows, error } = await supabase.from(table).select('*')
    if (error) return { backup: null, error: `Export de « ${table} » impossible : ${error.message}` }
    const list = rows<Record<string, unknown>>(tableRows)
    data[table] = list
    counts[table] = list.length
  }

  return {
    backup: {
      format: 'gestion-locative-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      counts,
      data,
    },
    error: null,
  }
}

/** Colonnes calculées par la base : jamais réécrites lors d'une restauration. */
const GENERATED_COLUMNS: Partial<Record<TableName, string[]>> = {
  properties: ['total_investment'],
  rents: ['amount_paid'],
}

/**
 * Restauration par fusion : chaque ligne de la sauvegarde est réinsérée ou
 * mise à jour sur son identifiant. Rien n'est supprimé — les données absentes
 * de la sauvegarde sont conservées telles quelles.
 */
export async function restoreBackup(
  _prev: ActionState & { report?: string[] },
  fd: FormData,
): Promise<ActionState & { report?: string[] }> {
  const confirmation = String(fd.get('confirmation') ?? '').trim()
  if (confirmation !== 'RESTAURER') {
    return { error: 'Tapez RESTAURER en majuscules pour confirmer la restauration.' }
  }

  const file = fd.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Merci de sélectionner un fichier de sauvegarde.' }
  }
  if (file.size > 20 * 1024 * 1024) {
    return { error: 'Le fichier de sauvegarde dépasse 20 Mo.' }
  }

  let parsed: BackupFile
  try {
    parsed = JSON.parse(await file.text()) as BackupFile
  } catch {
    return { error: "Le fichier n'est pas un JSON valide." }
  }

  if (parsed?.format !== 'gestion-locative-backup') {
    return { error: "Ce fichier n'est pas une sauvegarde de Gestion Locative." }
  }

  const supabase = await createClient()
  const report: string[] = []

  for (const table of TABLES) {
    const list = parsed.data?.[table]
    if (!Array.isArray(list) || list.length === 0) continue

    // La restauration des contrats déclenche la génération automatique des
    // loyers : ces loyers neufs occupent (contract_id, period_month) avec un
    // autre identifiant et bloqueraient l'upsert des loyers sauvegardés.
    // On retire uniquement ces doublons générés, jamais un loyer de la sauvegarde.
    if (table === 'rents') {
      const backupIds = new Set(list.map((r) => String(r.id)))
      const backupKeys = new Set(
        list.map((r) => `${String(r.contract_id)}|${String(r.period_month).slice(0, 10)}`),
      )
      const contractIds = [...new Set(list.map((r) => String(r.contract_id)))]

      for (let i = 0; i < contractIds.length; i += 100) {
        const { data: existing } = await supabase
          .from('rents')
          .select('id, contract_id, period_month')
          .in('contract_id', contractIds.slice(i, i + 100))

        const conflicting = rows<{ id: string; contract_id: string; period_month: string }>(existing)
          .filter((r) =>
            !backupIds.has(r.id) &&
            backupKeys.has(`${r.contract_id}|${r.period_month.slice(0, 10)}`),
          )
          .map((r) => r.id)

        if (conflicting.length > 0) {
          const { error } = await supabase.from('rents').delete().in('id', conflicting)
          if (error) {
            return { error: `Nettoyage des loyers générés impossible : ${pgMessage(error)}`, report }
          }
        }
      }
    }

    const drop = GENERATED_COLUMNS[table] ?? []
    const payload = list.map((r) => {
      const copy = { ...r }
      for (const col of drop) delete copy[col]
      return copy
    })

    // Par lots : évite les requêtes trop volumineuses.
    for (let i = 0; i < payload.length; i += 200) {
      const { error } = await supabase
        .from(table)
        .upsert(payload.slice(i, i + 200), { onConflict: 'id' })

      if (error) {
        return {
          error: `Restauration interrompue sur « ${table} » : ${pgMessage(error)}`,
          report,
        }
      }
    }

    report.push(`${table} : ${payload.length} ligne${payload.length > 1 ? 's' : ''} restaurée${payload.length > 1 ? 's' : ''}`)
  }

  // Les loyers dépendent des paiements restaurés : on resynchronise.
  await supabase.rpc('generate_rents')

  revalidatePath('/', 'layout')
  return { error: null, success: 'Restauration terminée.', report }
}
