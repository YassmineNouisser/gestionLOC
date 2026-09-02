import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types'

export interface SessionUser {
  id: string
  email: string
  fullName: string
  role: UserRole
  canWrite: boolean
}

/**
 * Utilisateur connecté, ou redirection vers /login.
 *
 * Enveloppé dans cache() : la mise en page et la page appellent toutes deux
 * cette fonction pendant le même rendu. Sans déduplication, chaque navigation
 * payait deux fois la vérification de session et deux fois la lecture du profil.
 */
export const requireUser = cache(async (): Promise<SessionUser> => {
  const supabase = await createClient()

  /*
   * getClaims() vérifie le jeton localement à partir des clés publiques du
   * projet (mises en cache), là où getUser() fait systématiquement un aller
   * -retour réseau vers le serveur d'authentification. Le rafraîchissement
   * de session reste assuré. On retombe sur getUser() si la vérification
   * locale n'est pas disponible.
   */
  let userId: string | null = null
  let email = ''

  try {
    const { data } = await supabase.auth.getClaims()
    if (data?.claims?.sub) {
      userId = data.claims.sub
      email = typeof data.claims.email === 'string' ? data.claims.email : ''
    }
  } catch {
    // Vérification locale indisponible : on bascule sur l'appel réseau.
  }

  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')
    userId = user.id
    email = user.email ?? ''
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', userId)
    .maybeSingle()

  const role = (profile?.role ?? 'proprietaire') as UserRole

  return {
    id: userId,
    email,
    fullName: profile?.full_name || email.split('@')[0] || 'Utilisateur',
    role,
    canWrite: role === 'proprietaire' || role === 'gestionnaire',
  }
})
