'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { type ActionState, pgMessage } from './shared'

/** Masque une alerte pour l'utilisateur courant. */
export async function dismissNotification(key: string): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Session expirée. Reconnectez-vous.' }

  const { error } = await supabase
    .from('notification_dismissals')
    .upsert({ notification_key: key, user_id: user.id }, { onConflict: 'notification_key,user_id' })

  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  return { error: null }
}

/** Réaffiche une alerte précédemment masquée. */
export async function restoreNotification(key: string): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Session expirée. Reconnectez-vous.' }

  const { error } = await supabase
    .from('notification_dismissals')
    .delete()
    .eq('notification_key', key)
    .eq('user_id', user.id)

  if (error) return { error: pgMessage(error) }

  revalidatePath('/', 'layout')
  return { error: null }
}
