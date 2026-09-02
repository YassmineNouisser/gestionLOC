'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type ActionState, pgMessage, requiredText, text } from './shared'

function parse(fd: FormData) {
  return {
    first_name: requiredText(fd, 'first_name'),
    last_name: requiredText(fd, 'last_name'),
    cin: text(fd, 'cin'),
    phone: text(fd, 'phone'),
    email: text(fd, 'email'),
    address: text(fd, 'address'),
    profession: text(fd, 'profession'),
    emergency_contact_name: text(fd, 'emergency_contact_name'),
    emergency_contact_phone: text(fd, 'emergency_contact_phone'),
    notes: text(fd, 'notes'),
  }
}

function validate(v: ReturnType<typeof parse>): string | null {
  if (!v.first_name) return 'Le prénom est obligatoire.'
  if (!v.last_name) return 'Le nom est obligatoire.'
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))
    return "L'adresse email n'est pas valide."
  return null
}

export async function createTenant(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = parse(fd)
  const invalid = validate(values)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const { data, error } = await supabase.from('tenants').insert(values).select('id').single()
  if (error) return { error: pgMessage(error) }

  revalidatePath('/locataires')
  revalidatePath('/')
  redirect(`/locataires/${data.id}`)
}

export async function updateTenant(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = parse(fd)
  const invalid = validate(values)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const { error } = await supabase.from('tenants').update(values).eq('id', id)
  if (error) return { error: pgMessage(error) }

  revalidatePath('/locataires')
  revalidatePath(`/locataires/${id}`)
  redirect(`/locataires/${id}`)
}

export async function deleteTenant(id: string): Promise<ActionState> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('contracts').select('id', { count: 'exact', head: true }).eq('tenant_id', id)

  if ((count ?? 0) > 0) {
    return {
      error: "Ce locataire est rattaché à un ou plusieurs contrats. Supprimez d'abord ces contrats, ou conservez la fiche pour garder l'historique.",
    }
  }

  const { error } = await supabase.from('tenants').delete().eq('id', id)
  if (error) return { error: pgMessage(error) }

  revalidatePath('/locataires')
  revalidatePath('/')
  redirect('/locataires')
}
