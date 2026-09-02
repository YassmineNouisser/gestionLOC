'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  type ActionState, dateOrNull, intOrNull, numberOr, pgMessage, requiredText, text,
} from './shared'

function parse(fd: FormData) {
  return {
    property_id: requiredText(fd, 'property_id'),
    tenant_id: requiredText(fd, 'tenant_id'),
    start_date: dateOrNull(fd, 'start_date'),
    end_date: dateOrNull(fd, 'end_date'),
    monthly_rent: numberOr(fd, 'monthly_rent'),
    deposit: numberOr(fd, 'deposit'),
    due_day: intOrNull(fd, 'due_day') ?? 5,
    charges: numberOr(fd, 'charges'),
    conditions: text(fd, 'conditions'),
    status: requiredText(fd, 'status') || 'actif',
    notes: text(fd, 'notes'),
  }
}

function validate(v: ReturnType<typeof parse>): string | null {
  if (!v.property_id) return 'Merci de sélectionner un bien.'
  if (!v.tenant_id) return 'Merci de sélectionner un locataire.'
  if (!v.start_date) return 'La date de début est obligatoire.'
  if (v.end_date && v.end_date < v.start_date)
    return 'La date de fin doit être postérieure à la date de début.'
  if (v.monthly_rent <= 0) return 'Le loyer mensuel doit être supérieur à zéro.'
  if (v.due_day < 1 || v.due_day > 31) return "Le jour d'échéance doit être compris entre 1 et 31."
  if (v.status !== 'actif' && !v.end_date)
    return 'Un contrat terminé ou résilié doit avoir une date de fin.'
  return null
}

export async function createContract(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = parse(fd)
  const invalid = validate(values)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const { data, error } = await supabase.from('contracts').insert(values).select('id').single()
  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  redirect(`/contrats/${data.id}`)
}

export async function updateContract(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = parse(fd)
  const invalid = validate(values)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const { error } = await supabase.from('contracts').update(values).eq('id', id)
  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  redirect(`/contrats/${id}`)
}

/**
 * Clôture un contrat. Le bien repasse automatiquement en « Libre »
 * via le trigger de synchronisation.
 */
export async function closeContract(
  id: string,
  status: 'termine' | 'resilie',
  endDate: string,
): Promise<ActionState> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { error: 'Merci d’indiquer une date de fin valide.' }
  }

  const supabase = await createClient()
  const { data: contract } = await supabase
    .from('contracts').select('start_date').eq('id', id).maybeSingle()

  if (!contract) return { error: 'Contrat introuvable.' }
  if (endDate < contract.start_date) {
    return { error: 'La date de fin doit être postérieure à la date de début du contrat.' }
  }

  const { error } = await supabase
    .from('contracts').update({ status, end_date: endDate }).eq('id', id)

  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  return { error: null }
}

/** Réactive un contrat clôturé (correction d'une erreur de saisie). */
export async function reopenContract(id: string): Promise<ActionState> {
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts').select('property_id').eq('id', id).maybeSingle()
  if (!contract) return { error: 'Contrat introuvable.' }

  const { count } = await supabase
    .from('contracts').select('id', { count: 'exact', head: true })
    .eq('property_id', contract.property_id).eq('status', 'actif')

  if ((count ?? 0) > 0) {
    return { error: "Ce bien a déjà un contrat actif. Clôturez-le avant de réactiver celui-ci." }
  }

  const { error } = await supabase
    .from('contracts').update({ status: 'actif', end_date: null }).eq('id', id)
  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  return { error: null }
}

export async function deleteContract(id: string): Promise<ActionState> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('payments').select('id', { count: 'exact', head: true }).eq('contract_id', id)

  if ((count ?? 0) > 0) {
    return {
      error: `Ce contrat comporte ${count} paiement${count! > 1 ? 's' : ''} enregistré${count! > 1 ? 's' : ''}. Supprimez-les d'abord, ou résiliez le contrat pour conserver l'historique.`,
    }
  }

  const { error } = await supabase.from('contracts').delete().eq('id', id)
  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  redirect('/contrats')
}
