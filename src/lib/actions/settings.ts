'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  type ActionState, intOrNull, pgMessage, requiredText, text,
} from './shared'

/** Un sujet ntfy vaut mot de passe : quiconque le connaît reçoit les alertes. */
const TOPIC_PATTERN = /^[A-Za-z0-9_-]{12,64}$/

export async function updateNtfySettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const enabled = fd.get('ntfy_enabled') === 'on'
  const topic = text(fd, 'ntfy_topic')
  const server = requiredText(fd, 'ntfy_server') || 'https://ntfy.sh'
  const days = intOrNull(fd, 'overdue_days') ?? 7

  if (enabled && !topic) {
    return { error: 'Indiquez un sujet ntfy avant d’activer les notifications.' }
  }
  if (topic && !TOPIC_PATTERN.test(topic)) {
    return {
      error: 'Le sujet doit faire 12 à 64 caractères, sans espace ni accent (lettres, chiffres, tiret, souligné).',
    }
  }
  if (days < 1 || days > 90) return { error: 'Le délai doit être compris entre 1 et 90 jours.' }
  if (!/^https?:\/\//.test(server)) return { error: 'L’adresse du serveur doit commencer par http:// ou https://' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('app_settings')
    .update({ ntfy_enabled: enabled, ntfy_topic: topic, ntfy_server: server, overdue_days: days })
    .eq('id', 1)

  if (error) return { error: pgMessage(error) }

  revalidatePath('/parametres')
  return { error: null, success: 'Réglages enregistrés.' }
}

/**
 * Envoi de contrôle. Passe par l'application plutôt que par la base : le
 * propriétaire a besoin du code de réponse tout de suite pour savoir si son
 * téléphone est bien abonné.
 */
export async function sendTestNotification(): Promise<ActionState> {
  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('app_settings').select('ntfy_server, ntfy_topic').eq('id', 1).maybeSingle()

  if (!settings?.ntfy_topic) {
    return { error: 'Aucun sujet enregistré. Renseignez-le puis enregistrez avant de tester.' }
  }

  try {
    const res = await fetch(settings.ntfy_server, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: settings.ntfy_topic,
        title: 'Test — Gestion Locative',
        message: 'Si vous lisez ceci sur votre téléphone, les alertes de retard vous parviendront.',
        priority: 3,
        tags: ['white_check_mark'],
      }),
    })

    if (!res.ok) {
      return { error: `Le serveur ntfy a refusé l’envoi (code ${res.status}).` }
    }
    return { error: null, success: 'Notification envoyée. Vérifiez votre téléphone.' }
  } catch {
    return { error: 'Serveur ntfy injoignable. Vérifiez l’adresse et votre connexion.' }
  }
}
