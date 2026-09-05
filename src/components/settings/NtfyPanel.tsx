'use client'

import { useActionState, useState, useTransition } from 'react'
import { CheckCircle2, Loader2, RefreshCw, Send, Smartphone } from 'lucide-react'
import {
  Field, FormError, FormGrid, FormSuccess, Input, SubmitButton,
} from '@/components/ui/Form'
import { sendTestNotification, updateNtfySettings } from '@/lib/actions/settings'
import { dateTime } from '@/lib/format'
import type { AppSettings, NotificationDelivery } from '@/lib/types'

/** Sujet aléatoire : il tient lieu de mot de passe, il doit être imprévisible. */
function generateTopic() {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `gestionloc-${suffix}`
}

function TestButton() {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  function run() {
    setResult(null)
    start(async () => {
      const res = await sendTestNotification()
      setResult({ ok: !res.error, text: res.error ?? res.success ?? '' })
    })
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={run} disabled={pending} className="btn-secondary">
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
        {pending ? 'Envoi…' : 'Envoyer une notification de test'}
      </button>
      {result && (
        <p
          role={result.ok ? 'status' : 'alert'}
          className={`flex items-start gap-2 text-sm ${result.ok ? 'text-ok-700' : 'text-bad-700'}`}
        >
          {result.ok && <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {result.text}
        </p>
      )}
    </div>
  )
}

export function NtfyPanel({
  settings, deliveries,
}: {
  settings: AppSettings | null
  deliveries: NotificationDelivery[]
}) {
  const [state, formAction] = useActionState(updateNtfySettings, { error: null, success: null })
  const [topic, setTopic] = useState(settings?.ntfy_topic ?? '')

  return (
    <div className="space-y-6">
      <ol className="space-y-2 rounded-xl bg-ink-50 px-5 py-4 text-[15px] text-ink-600">
        <li>
          <strong className="text-ink-800">1.</strong> Installez l&apos;application{' '}
          <span className="font-semibold text-ink-800">ntfy</span> sur votre téléphone
          (App Store ou Google Play).
        </li>
        <li>
          <strong className="text-ink-800">2.</strong> Dans l&apos;application, abonnez-vous
          au sujet ci-dessous.
        </li>
        <li>
          <strong className="text-ink-800">3.</strong> Envoyez une notification de test
          pour vérifier la réception.
        </li>
      </ol>

      <form action={formAction} className="space-y-5">
        <FormError message={state.error} />
        <FormSuccess message={state.success} />

        <label className="flex items-start gap-3 rounded-lg border border-ink-200 px-4 py-3.5">
          <input
            type="checkbox"
            name="ntfy_enabled"
            defaultChecked={settings?.ntfy_enabled ?? false}
            className="mt-0.5 size-5 shrink-0 accent-brand-600"
          />
          <span>
            <span className="block font-semibold text-ink-900">Activer les alertes de retard</span>
            <span className="block text-sm text-ink-500">
              La base envoie la notification chaque matin, même si personne n&apos;ouvre
              l&apos;application. Un même loyer n&apos;alerte qu&apos;une seule fois.
            </span>
          </span>
        </label>

        <Field
          label="Sujet ntfy"
          name="ntfy_topic"
          hint="Il tient lieu de mot de passe : quiconque le connaît reçoit vos alertes. Gardez-le secret."
        >
          <div className="flex gap-2">
            <Input
              name="ntfy_topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="gestionloc-…"
              className="font-mono"
            />
            <button
              type="button"
              onClick={() => setTopic(generateTopic())}
              className="btn-secondary shrink-0"
              title="Générer un sujet aléatoire"
            >
              <RefreshCw className="size-4.5" aria-hidden />
              Générer
            </button>
          </div>
        </Field>

        <FormGrid>
          <Field
            label="Délai avant alerte"
            name="overdue_days"
            required
            hint="Nombre de jours après l'échéance."
          >
            <Input
              name="overdue_days"
              type="number"
              min={1}
              max={90}
              defaultValue={settings?.overdue_days ?? 7}
              required
            />
          </Field>
          <Field
            label="Serveur ntfy"
            name="ntfy_server"
            hint="Laissez la valeur par défaut, sauf serveur auto-hébergé."
          >
            <Input name="ntfy_server" defaultValue={settings?.ntfy_server ?? 'https://ntfy.sh'} />
          </Field>
        </FormGrid>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <SubmitButton>Enregistrer</SubmitButton>
        </div>
      </form>

      <div className="border-t border-ink-100 pt-6">
        <TestButton />
      </div>

      {deliveries.length > 0 && (
        <div className="border-t border-ink-100 pt-6">
          <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-ink-900">
            <Smartphone className="size-4.5 text-ink-400" aria-hidden />
            Dernières alertes envoyées
          </h3>
          <ul className="space-y-2">
            {deliveries.map((d) => (
              <li key={d.id} className="rounded-lg bg-ink-50 px-4 py-3">
                <p className="whitespace-pre-line text-[15px] text-ink-700">{d.message}</p>
                <p className="mt-1 text-sm text-ink-400">{dateTime(d.sent_at)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
