'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  type ActionState, dateOrNull, numberOr, pgMessage, requiredText, text,
} from './shared'

/**
 * Enregistre un versement de caution. Le solde n'est jamais saisi :
 * la vue le déduit du cumul des versements, comme pour les loyers.
 */
export async function createDepositPayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const contract_id = requiredText(fd, 'contract_id')
  const amount = numberOr(fd, 'amount')
  const payment_date = dateOrNull(fd, 'payment_date')

  if (!contract_id) return { error: 'Contrat introuvable.' }
  if (!(amount > 0)) return { error: 'Le montant doit être supérieur à zéro.' }
  if (!payment_date) return { error: 'La date du versement est obligatoire.' }

  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts').select('property_id, tenant_id').eq('id', contract_id).maybeSingle()
  if (!contract) return { error: 'Contrat introuvable.' }

  const { error } = await supabase.from('deposit_payments').insert({
    contract_id,
    property_id: contract.property_id,
    tenant_id: contract.tenant_id,
    amount,
    payment_date,
    method: requiredText(fd, 'method') || 'especes',
    reference: text(fd, 'reference'),
    note: text(fd, 'note'),
  })

  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  return { error: null, success: 'Versement enregistré.' }
}

export async function deleteDepositPayment(id: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('deposit_payments').delete().eq('id', id)
  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  return { error: null }
}
