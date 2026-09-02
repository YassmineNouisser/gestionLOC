'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  type ActionState, dateOrNull, numberOr, pgMessage, requiredText, text,
} from './shared'

function parse(fd: FormData) {
  return {
    rent_id: requiredText(fd, 'rent_id'),
    amount: numberOr(fd, 'amount'),
    payment_date: dateOrNull(fd, 'payment_date'),
    method: requiredText(fd, 'method') || 'especes',
    reference: text(fd, 'reference'),
    note: text(fd, 'note'),
  }
}

/**
 * Enregistre un paiement. Le trigger SQL recalcule immédiatement
 * le montant payé, le reste et le statut du loyer concerné.
 */
export async function createPayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = parse(fd)

  if (!values.rent_id) return { error: 'Loyer introuvable.' }
  if (!(values.amount > 0)) return { error: 'Le montant doit être supérieur à zéro.' }
  if (!values.payment_date) return { error: 'La date de paiement est obligatoire.' }

  const supabase = await createClient()

  const { data: rent } = await supabase
    .from('rents')
    .select('contract_id, property_id, tenant_id')
    .eq('id', values.rent_id)
    .maybeSingle()

  if (!rent) return { error: 'Loyer introuvable.' }

  const { error } = await supabase.from('payments').insert({ ...values, ...rent })
  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  return { error: null, success: 'Paiement enregistré.' }
}

export async function updatePayment(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const amount = numberOr(fd, 'amount')
  const payment_date = dateOrNull(fd, 'payment_date')

  if (!(amount > 0)) return { error: 'Le montant doit être supérieur à zéro.' }
  if (!payment_date) return { error: 'La date de paiement est obligatoire.' }

  const supabase = await createClient()
  const { error } = await supabase.from('payments').update({
    amount,
    payment_date,
    method: requiredText(fd, 'method') || 'especes',
    reference: text(fd, 'reference'),
    note: text(fd, 'note'),
  }).eq('id', id)

  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  return { error: null, success: 'Paiement modifié.' }
}

export async function deletePayment(id: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  return { error: null }
}

/** Raccourci : encaisser en une fois la totalité du reste dû. */
export async function payRemaining(rentId: string, method = 'especes'): Promise<ActionState> {
  const supabase = await createClient()

  const { data: rent } = await supabase
    .from('v_rents')
    .select('balance, contract_id, property_id, tenant_id')
    .eq('id', rentId)
    .maybeSingle()

  if (!rent) return { error: 'Loyer introuvable.' }
  const balance = Number(rent.balance)
  if (!(balance > 0)) return { error: 'Ce loyer est déjà entièrement réglé.' }

  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const { error } = await supabase.from('payments').insert({
    rent_id: rentId,
    contract_id: rent.contract_id,
    property_id: rent.property_id,
    tenant_id: rent.tenant_id,
    amount: balance,
    payment_date: iso,
    method,
  })

  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  return { error: null, success: 'Solde encaissé.' }
}

/** Regénère les loyers manquants (bouton manuel dans les paramètres). */
export async function regenerateRents(): Promise<ActionState & { created?: number }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_rents')
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { error: null, created: Number(data ?? 0) }
}
