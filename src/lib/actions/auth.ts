'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type AuthState = { error: string | null; success?: string | null }

/** Traduit les messages d'erreur Supabase en français. */
function translate(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (m.includes('email not confirmed')) return "Cet email n'a pas encore été confirmé."
  if (m.includes('too many requests') || m.includes('rate limit'))
    return 'Trop de tentatives. Merci de réessayer dans quelques minutes.'
  if (m.includes('failed to fetch') || m.includes('fetch failed'))
    return 'Connexion au serveur impossible. Vérifiez votre connexion Internet.'
  return "Connexion impossible. Vérifiez vos identifiants puis réessayez."
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const redirectTo = String(formData.get('redirect') ?? '/')

  if (!email || !password) {
    return { error: 'Merci de saisir votre email et votre mot de passe.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: translate(error.message) }

  revalidatePath('/', 'layout')
  redirect(redirectTo.startsWith('/') ? redirectTo : '/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  if (password.length < 8) return { error: 'Le mot de passe doit contenir au moins 8 caractères.' }
  if (password !== confirm) return { error: 'Les deux mots de passe ne correspondent pas.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: translate(error.message) }

  return { error: null, success: 'Mot de passe modifié.' }
}
