import { Shell } from '@/components/Shell'
import { requireUser } from '@/lib/auth'
import { USER_ROLE } from '@/lib/format'
import { loadNotifications } from '@/lib/data/notifications'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  /*
   * Les deux appels partent ensemble : la session est vérifiée localement,
   * les alertes sont lues en base. Les enchaîner ajoutait un aller-retour
   * réseau complet à chaque navigation.
   *
   * La génération des loyers n'est volontairement pas ici : le déclencheur
   * SQL s'en charge à la création d'un contrat, et les écrans concernés
   * (tableau de bord, loyers) l'appellent eux-mêmes. L'exécuter sur chaque
   * page faisait payer un appel de fonction distant pour rien.
   */
  const [user, { active }] = await Promise.all([
    requireUser(),
    loadNotifications(),
  ])

  return (
    <Shell
      userName={user.fullName}
      userEmail={user.email}
      userRole={USER_ROLE[user.role]}
      alertCount={active.length}
    >
      {children}
    </Shell>
  )
}
