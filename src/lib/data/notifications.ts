import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import type { Notification } from '@/lib/types'

export interface NotificationList {
  active: Notification[]
  dismissed: Notification[]
}

const SEVERITY_ORDER: Record<Notification['severity'], number> = {
  danger: 0, warning: 1, info: 2,
}

/**
 * Alertes calculées en direct par la vue v_notifications, moins celles que
 * l'utilisateur a masquées. Une alerte masquée réapparaît si la situation
 * se reproduit avec une clé différente.
 */
export async function loadNotifications(): Promise<NotificationList> {
  const supabase = await createClient()

  const [{ data: notificationRows }, { data: dismissalRows }] = await Promise.all([
    supabase.from('v_notifications').select('*'),
    supabase.from('notification_dismissals').select('notification_key'),
  ])

  const dismissedKeys = new Set(
    rows<{ notification_key: string }>(dismissalRows).map((d) => d.notification_key),
  )

  const all = rows<Notification>(notificationRows).sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (bySeverity !== 0) return bySeverity
    return a.ref_date.localeCompare(b.ref_date)
  })

  return {
    active: all.filter((n) => !dismissedKeys.has(n.key)),
    dismissed: all.filter((n) => dismissedKeys.has(n.key)),
  }
}
