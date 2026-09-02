'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { type ActionState, pgMessage, requiredText } from './shared'

export async function updateProfile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const fullName = requiredText(fd, 'full_name')
  if (!fullName) return { error: 'Le nom est obligatoire.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Session expirée. Reconnectez-vous.' }

  const { error } = await supabase
    .from('profiles').update({ full_name: fullName }).eq('id', user.id)

  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  return { error: null, success: 'Profil mis à jour.' }
}
