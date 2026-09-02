'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, TriangleAlert } from 'lucide-react'
import { signIn, type AuthState } from '@/lib/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary group w-full py-3 text-base" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Connexion en cours…
        </>
      ) : (
        <>
          Se connecter
          <ArrowRight
            className="size-5 transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden
          />
        </>
      )}
    </button>
  )
}

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction] = useActionState<AuthState, FormData>(signIn, { error: null })
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  /** Verrouillage majuscules : première cause de « mot de passe incorrect ». */
  function checkCaps(e: React.KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState?.('CapsLock') ?? false)
  }

  return (
    <form action={formAction} className="stagger space-y-5">
      <input type="hidden" name="redirect" value={redirectTo} />

      {state.error && (
        <div
          role="alert"
          className="reveal flex items-start gap-2.5 rounded-lg bg-bad-50 px-4 py-3 text-[15px] text-bad-700 ring-1 ring-inset ring-bad-100"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <div className="reveal">
        <label htmlFor="email" className="label">Adresse email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="proprietaire@exemple.com"
          className="field h-12"
        />
      </div>

      <div className="reveal">
        <label htmlFor="password" className="label">Mot de passe</label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            onKeyUp={checkCaps}
            onKeyDown={checkCaps}
            placeholder="••••••••"
            className="field h-12 pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-400 transition-colors hover:text-ink-700"
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>

        {capsLock && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-warn-700">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            La touche Verr. Maj est activée.
          </p>
        )}
      </div>

      <div className="reveal pt-1">
        <SubmitButton />
      </div>
    </form>
  )
}
