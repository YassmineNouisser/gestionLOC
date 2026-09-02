import type { Metadata } from 'next'
import { BellOff, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { NotificationCard } from '@/components/notifications/NotificationCard'
import { loadNotifications } from '@/lib/data/notifications'
import type { Notification } from '@/lib/types'

export const metadata: Metadata = { title: 'Notifications' }
export const dynamic = 'force-dynamic'

const GROUPS: { key: Notification['type'][]; title: string; description: string }[] = [
  {
    key: ['impaye'],
    title: 'Loyers impayés',
    description: "L'échéance est dépassée et aucun paiement n'a été reçu.",
  },
  {
    key: ['partiel'],
    title: 'Paiements partiels',
    description: 'Un paiement a été reçu mais le loyer n’est pas soldé.',
  },
  {
    key: ['echeance'],
    title: 'Loyers bientôt dus',
    description: 'Échéance dans les 7 prochains jours.',
  },
  {
    key: ['contrat', 'assurance'],
    title: 'Échéances à préparer',
    description: 'Contrats et assurances arrivant à expiration dans les 60 jours.',
  },
  {
    key: ['maintenance'],
    title: 'Maintenance',
    description: 'Biens actuellement indisponibles à la location.',
  },
]

export default async function NotificationsPage() {
  const { active, dismissed } = await loadNotifications()

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={
          active.length > 0
            ? `${active.length} alerte${active.length > 1 ? 's' : ''} en attente`
            : 'Tout est à jour'
        }
      />

      {active.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<CheckCircle2 className="size-7" />}
            title="Aucune alerte en attente"
            description="Les loyers impayés, paiements partiels, échéances proches et contrats expirants apparaîtront ici automatiquement."
          />
        </div>
      ) : (
        GROUPS.map((group) => {
          const items = active.filter((n) => group.key.includes(n.type))
          if (items.length === 0) return null
          return (
            <section key={group.title} className="mb-8">
              <h2 className="text-lg font-bold text-ink-900">
                {group.title}
                <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-bold text-ink-600">
                  {items.length}
                </span>
              </h2>
              <p className="mb-3 mt-0.5 text-sm text-ink-500">{group.description}</p>
              <ul className="space-y-3">
                {items.map((n) => <NotificationCard key={n.key} notification={n} />)}
              </ul>
            </section>
          )
        })
      )}

      {dismissed.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink-700">
            <BellOff className="size-5 text-ink-400" aria-hidden />
            Alertes masquées
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-bold text-ink-600">
              {dismissed.length}
            </span>
          </h2>
          <p className="mb-3 mt-0.5 text-sm text-ink-500">
            Ces alertes restent actives mais ne sont plus comptabilisées dans le badge.
          </p>
          <ul className="space-y-3">
            {dismissed.map((n) => (
              <NotificationCard key={n.key} notification={n} isDismissed />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
