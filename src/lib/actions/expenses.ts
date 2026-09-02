'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  type ActionState, dateOrNull, numberOr, pgMessage, requiredText, text,
} from './shared'

function parse(fd: FormData) {
  return {
    property_id: requiredText(fd, 'property_id'),
    category: requiredText(fd, 'category') || 'autres',
    amount: numberOr(fd, 'amount'),
    expense_date: dateOrNull(fd, 'expense_date'),
    description: text(fd, 'description'),
  }
}

function validate(v: ReturnType<typeof parse>): string | null {
  if (!v.property_id) return 'Merci de sélectionner un bien.'
  if (!(v.amount > 0)) return 'Le montant doit être supérieur à zéro.'
  if (!v.expense_date) return 'La date de la dépense est obligatoire.'
  return null
}

export async function createExpense(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = parse(fd)
  const invalid = validate(values)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const { error } = await supabase.from('expenses').insert(values)
  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  redirect(`/depenses?bien=${values.property_id}`)
}

export async function updateExpense(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = parse(fd)
  const invalid = validate(values)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const { error } = await supabase.from('expenses').update(values).eq('id', id)
  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  return { error: null, success: 'Dépense modifiée.' }
}

export async function deleteExpense(id: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  return { error: null }
}
