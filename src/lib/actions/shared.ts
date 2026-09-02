import type { PostgrestError } from '@supabase/supabase-js'

export type ActionState = { error: string | null; success?: string | null }

export const OK: ActionState = { error: null }

/** Champ texte optionnel : chaîne vide -> null. */
export function text(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? '').trim()
  return v === '' ? null : v
}

/** Champ texte obligatoire. */
export function requiredText(fd: FormData, key: string): string {
  return String(fd.get(key) ?? '').trim()
}

/** Nombre optionnel : chaîne vide -> null. */
export function numberOrNull(fd: FormData, key: string): number | null {
  const raw = String(fd.get(key) ?? '').trim().replace(',', '.')
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Nombre avec valeur par défaut (montants : 0). */
export function numberOr(fd: FormData, key: string, fallback = 0): number {
  return numberOrNull(fd, key) ?? fallback
}

export function intOrNull(fd: FormData, key: string): number | null {
  const n = numberOrNull(fd, key)
  return n === null ? null : Math.trunc(n)
}

/** Date optionnelle au format ISO (input type=date). */
export function dateOrNull(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

/**
 * Traduit les erreurs Postgres/Supabase en messages compréhensibles.
 * Les codes proviennent de PostgreSQL (23505 = doublon, 23503 = clé étrangère…).
 */
export function pgMessage(error: PostgrestError, context: Record<string, string> = {}): string {
  const detail = `${error.message} ${error.details ?? ''}`.toLowerCase()

  if (error.code === '23505') {
    if (detail.includes('uq_contract_active_per_property'))
      return "Ce bien a déjà un contrat actif. Terminez ou résiliez le contrat en cours avant d'en créer un nouveau."
    if (detail.includes('properties_reference_key'))
      return 'Cette référence de bien est déjà utilisée. Choisissez-en une autre.'
    if (detail.includes('tenants_cin_key'))
      return 'Ce numéro de CIN est déjà enregistré pour un autre locataire.'
    if (detail.includes('uq_rent_contract_period'))
      return 'Un loyer existe déjà pour ce contrat et ce mois.'
    return context.duplicate ?? 'Cet enregistrement existe déjà.'
  }

  if (error.code === '23503') {
    return context.fk ?? "Suppression impossible : cet élément est encore utilisé ailleurs (contrat, paiement ou dépense)."
  }

  if (error.code === '23514') {
    if (detail.includes('contracts_dates_check'))
      return 'La date de fin doit être postérieure à la date de début.'
    if (detail.includes('contracts_closed_needs_end'))
      return "Un contrat terminé ou résilié doit avoir une date de fin."
    if (detail.includes('payments_amount_check'))
      return 'Le montant du paiement doit être supérieur à zéro.'
    return 'Certaines valeurs saisies ne sont pas valides.'
  }

  if (error.code === '42501' || detail.includes('row-level security')) {
    return "Vous n'avez pas les droits nécessaires pour effectuer cette action."
  }

  return error.message || "Une erreur est survenue. Merci de réessayer."
}
