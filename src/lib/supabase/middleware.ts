import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Routes accessibles sans être connecté. */
const PUBLIC_PATHS = ['/login', '/auth']

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  /*
   * IMPORTANT : ne rien insérer entre createServerClient et la vérification
   * de session — c'est elle qui rafraîchit le jeton et réécrit les cookies.
   *
   * getClaims() valide la signature du jeton localement à partir des clés
   * publiques du projet, mises en cache après le premier appel. getUser()
   * faisait un aller-retour réseau vers le serveur d'authentification à
   * chaque requête, y compris pour de simples navigations : c'était le poste
   * de latence le plus lourd du proxy.
   */
  let isAuthenticated = false

  try {
    const { data } = await supabase.auth.getClaims()
    isAuthenticated = Boolean(data?.claims?.sub)
  } catch {
    const { data: { user } } = await supabase.auth.getUser()
    isAuthenticated = Boolean(user)
  }

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!isAuthenticated && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthenticated && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
