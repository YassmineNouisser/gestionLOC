import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export default async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf les ressources publiques.
     *
     * « icon » et « apple-icon » sont générées par Next sans extension de
     * fichier : sans exclusion explicite, le proxy les redirigeait vers /login
     * et l'onglet restait sans icône sur la page de connexion elle-même.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
