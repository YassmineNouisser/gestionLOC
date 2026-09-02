'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  type ActionState, dateOrNull, intOrNull, numberOr, numberOrNull, pgMessage, requiredText, text,
} from './shared'

function parse(fd: FormData) {
  return {
    reference: requiredText(fd, 'reference'),
    name: requiredText(fd, 'name'),
    address: text(fd, 'address'),
    city: text(fd, 'city'),
    type: requiredText(fd, 'type') || 'appartement',
    surface: numberOrNull(fd, 'surface'),
    rooms: intOrNull(fd, 'rooms'),
    purchase_price: numberOr(fd, 'purchase_price'),
    purchase_date: dateOrNull(fd, 'purchase_date'),
    purchase_fees: numberOr(fd, 'purchase_fees'),
    initial_works: numberOr(fd, 'initial_works'),
    monthly_rent: numberOr(fd, 'monthly_rent'),
    charges: numberOr(fd, 'charges'),
    insurance_expiry: dateOrNull(fd, 'insurance_expiry'),
    notes: text(fd, 'notes'),
  }
}

function validate(v: ReturnType<typeof parse>): string | null {
  if (!v.reference) return 'La référence du bien est obligatoire.'
  if (!v.name) return 'Le nom du bien est obligatoire.'
  if (v.surface !== null && v.surface < 0) return 'La surface ne peut pas être négative.'
  if (v.rooms !== null && v.rooms < 0) return 'Le nombre de chambres ne peut pas être négatif.'
  return null
}

export async function createProperty(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = parse(fd)
  const invalid = validate(values)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('properties')
    .insert(values)
    .select('id')
    .single()

  if (error) return { error: pgMessage(error) }

  revalidatePath('/biens')
  revalidatePath('/')
  redirect(`/biens/${data.id}`)
}

export async function updateProperty(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const values = parse(fd)
  const invalid = validate(values)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const { error } = await supabase.from('properties').update(values).eq('id', id)

  if (error) return { error: pgMessage(error) }

  revalidatePath('/biens')
  revalidatePath(`/biens/${id}`)
  revalidatePath('/')
  redirect(`/biens/${id}`)
}

/**
 * Statut manuel du bien. Un bien avec contrat actif reste "Loué" :
 * le trigger de synchronisation fait foi.
 */
export async function setPropertyStatus(id: string, status: string): Promise<ActionState> {
  const supabase = await createClient()

  if (status !== 'maintenance') {
    const { count } = await supabase
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', id)
      .eq('status', 'actif')

    if ((count ?? 0) > 0 && status === 'libre') {
      return { error: "Ce bien a un contrat actif : il reste marqué comme loué tant que le contrat n'est pas terminé." }
    }
  }

  const { error } = await supabase.from('properties').update({ status }).eq('id', id)
  if (error) return { error: pgMessage(error) }

  revalidatePath('/biens')
  revalidatePath(`/biens/${id}`)
  revalidatePath('/')
  return { error: null }
}

export async function deleteProperty(id: string): Promise<ActionState> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('contracts')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', id)

  if ((count ?? 0) > 0) {
    return {
      error: "Ce bien est rattaché à un ou plusieurs contrats. Supprimez d'abord ces contrats, ou conservez le bien pour garder l'historique.",
    }
  }

  const { error } = await supabase.from('properties').delete().eq('id', id)
  if (error) return { error: pgMessage(error) }

  revalidatePath('/biens')
  revalidatePath('/')
  redirect('/biens')
}
