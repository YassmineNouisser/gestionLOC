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
    period_month: dateOrNull(fd, 'period_month'),
    reading_date: dateOrNull(fd, 'reading_date'),
    water_previous_index: numberOr(fd, 'water_previous_index'),
    water_current_index: numberOr(fd, 'water_current_index'),
    water_rate: numberOr(fd, 'water_rate'),
    elec_previous_index: numberOr(fd, 'elec_previous_index'),
    elec_current_index: numberOr(fd, 'elec_current_index'),
    elec_rate: numberOr(fd, 'elec_rate'),
    notes: text(fd, 'notes'),
  }
}

function validate(v: ReturnType<typeof parse>): string | null {
  if (!v.property_id) return 'Merci de sélectionner un bien.'
  if (!v.period_month) return 'Le mois concerné est obligatoire.'
  if (!v.reading_date) return 'La date du relevé est obligatoire.'
  if (v.water_current_index < v.water_previous_index)
    return "Le nouvel index d'eau est inférieur à l'ancien. Vérifiez la saisie."
  if (v.elec_current_index < v.elec_previous_index)
    return "Le nouvel index d'électricité est inférieur à l'ancien. Vérifiez la saisie."
  if (v.water_rate < 0 || v.elec_rate < 0) return 'Les tarifs ne peuvent pas être négatifs.'
  return null
}

const CONTEXT = {
  duplicate: 'Un relevé existe déjà pour ce bien et ce mois. Modifiez-le plutôt que d’en créer un second.',
}

export async function createReading(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = parse(fd)
  const invalid = validate(values)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const { error } = await supabase.from('meter_readings').insert(values)
  if (error) return { error: pgMessage(error, CONTEXT) }

  revalidatePath('/', 'layout')
  redirect(`/releves?bien=${values.property_id}`)
}

export async function updateReading(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = parse(fd)
  const invalid = validate(values)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const { error } = await supabase.from('meter_readings').update(values).eq('id', id)
  if (error) return { error: pgMessage(error, CONTEXT) }

  revalidatePath('/', 'layout')
  return { error: null, success: 'Relevé modifié.' }
}

export async function deleteReading(id: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('meter_readings').delete().eq('id', id)
  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  return { error: null }
}
