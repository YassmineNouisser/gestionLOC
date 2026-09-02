'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Bell, CalendarClock, EyeOff, FileText, Loader2, RotateCcw, ShieldAlert,
  TriangleAlert, Wallet, Wrench,
} from 'lucide-react'
import { dismissNotification, restoreNotification } from '@/lib/actions/notifications'
import { date, money } from '@/lib/format'
import type { Notification } from '@/lib/types'

const ICONS: Record<Notification['type'], React.ElementType> = {
  impaye: TriangleAlert,
  partiel: Wallet,
  echeance: CalendarClock,
  contrat: FileText,
  assurance: ShieldAlert,
  maintenance: Wrench,
}

const TONE: Record<Notification['severity'], { wrap: string; icon: string }> = {
  danger:  { wrap: 'border-bad-100 bg-bad-50',   icon: 'bg-bad-100 text-bad-700' },
  warning: { wrap: 'border-warn-100 bg-warn-50', icon: 'bg-warn-100 text-warn-700' },
  info:    { wrap: 'border-ink-200 bg-white',    icon: 'bg-brand-50 text-brand-600' },
}

/**
 * Phrase de l'alerte, composée à l'affichage.
 * Les montants passent par money() : « 1 580 DT », comme partout ailleurs.
 */
function describe(n: Notification): string {
  const amount = n.amount === null ? '' : money(n.amount)
  switch (n.type) {
    case 'impaye':
      return `${n.subject} : ${amount} dus depuis le ${date(n.ref_date)}`
    case 'partiel':
      return `${n.subject} : il reste ${amount} à percevoir`
    case 'echeance':
      return `${n.subject} : ${amount} à régler le ${date(n.ref_date)}`
    case 'contrat':
      return `${n.subject} — le bail se termine le ${date(n.ref_date)}`
    case 'assurance':
      return `${n.subject} — l'assurance expire le ${date(n.ref_date)}`
    case 'maintenance':
      return `${n.subject} — indisponible à la location`
    default:
      return n.subject
  }
}

/** Lien vers l'élément concerné par l'alerte. */
function hrefFor(n: Notification): string {
  switch (n.entity_type) {
    case 'rents': return `/loyers/${n.entity_id}`
    case 'contracts': return `/contrats/${n.entity_id}`
    case 'properties': return `/biens/${n.entity_id}`
    default: return '/'
  }
}

export function NotificationCard({
  notification: n, isDismissed = false,
}: {
  notification: Notification
  isDismissed?: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const Icon = ICONS[n.type] ?? Bell
  const tone = TONE[n.severity]

  function toggle() {
    setError(null)
    start(async () => {
      const res = isDismissed
        ? await restoreNotification(n.key)
        : await dismissNotification(n.key)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <li className={`card flex flex-wrap items-start gap-4 border p-4 ${isDismissed ? 'border-ink-200 bg-ink-50 opacity-75' : tone.wrap}`}>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${isDismissed ? 'bg-ink-200 text-ink-500' : tone.icon}`}>
        <Icon className="size-5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink-900">{n.title}</p>
        <p className="mt-0.5 text-[15px] text-ink-600">{describe(n)}</p>
        {error && <p role="alert" className="mt-2 text-sm text-bad-700">{error}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link href={hrefFor(n)} className="btn-secondary btn-sm">Ouvrir</Link>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className="btn-ghost btn-sm text-ink-600"
          aria-label={isDismissed ? 'Réafficher cette alerte' : 'Masquer cette alerte'}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden />
                   : isDismissed ? <RotateCcw className="size-4" aria-hidden />
                   : <EyeOff className="size-4" aria-hidden />}
          {isDismissed ? 'Réafficher' : 'Masquer'}
        </button>
      </div>
    </li>
  )
}
