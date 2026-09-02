import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Client Supabase pour les Server Components et les Server Actions.
 * Les cookies ne sont modifiables que depuis une action ou un route handler :
 * l'écriture est donc encapsulée dans un try/catch silencieux.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Appelé depuis un Server Component : le refresh de session
            // est déjà pris en charge par le middleware.
          }
        },
      },
    },
  )
}
