import type { Metadata } from 'next'
import { Building2 } from 'lucide-react'
import { LoginForm } from './LoginForm'
import { Showcase } from '@/components/login/Showcase'

export const metadata: Metadata = { title: 'Connexion' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect } = await searchParams

  return (
    <main className="relative z-10 grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Colonne du formulaire */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14 xl:px-20">
        <div className="reveal mx-auto w-full max-w-[26rem]">
          <span className="relative inline-flex size-12 items-center justify-center rounded-[0.85rem] bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-lg">
            <Building2 className="size-6" aria-hidden />
            <span
              className="absolute inset-x-2.5 bottom-[4px] h-px rounded-full bg-gold-300/70"
              aria-hidden
            />
          </span>

          <h1 className="font-display mt-6 text-[1.85rem] leading-none text-ink-900">
            Gestion Locative
          </h1>
          <p className="mt-2.5 text-[15px] text-ink-500">
            Connectez-vous pour accéder à votre patrimoine.
          </p>

          <div className="mt-8">
            <LoginForm redirectTo={redirect ?? '/'} />
          </div>

          <p className="mt-10 text-sm text-ink-400">
            Application interne — accès réservé au propriétaire.
          </p>
        </div>
      </div>

      {/* Panneau vitrine */}
      <Showcase />
    </main>
  )
}
