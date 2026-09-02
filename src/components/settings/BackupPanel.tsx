'use client'

import { useActionState, useState, useTransition } from 'react'
import {
  CheckCircle2, Download, Loader2, RefreshCw, TriangleAlert, Upload,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Field, FormError, FormSuccess, Input, SubmitButton } from '@/components/ui/Form'
import { exportBackup, restoreBackup } from '@/lib/actions/backup'
import { regenerateRents } from '@/lib/actions/payments'

/** Télécharge la sauvegarde JSON produite côté serveur. */
export function ExportBackupButton() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  function run() {
    setError(null)
    setDone(null)
    start(async () => {
      const res = await exportBackup()
      if (res.error || !res.backup) {
        setError(res.error ?? 'Export impossible.')
        return
      }

      const blob = new Blob([JSON.stringify(res.backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sauvegarde-gestion-locative-${res.backup.exportedAt.slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      const total = Object.values(res.backup.counts).reduce((s, n) => s + n, 0)
      setDone(`${total} enregistrement${total > 1 ? 's' : ''} exporté${total > 1 ? 's' : ''}.`)
    })
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={run} disabled={pending} className="btn-primary">
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Download className="size-5" aria-hidden />}
        {pending ? 'Export en cours…' : 'Télécharger la sauvegarde'}
      </button>
      {error && <p role="alert" className="text-sm text-bad-700">{error}</p>}
      {done && (
        <p role="status" className="flex items-center gap-2 text-sm text-ok-700">
          <CheckCircle2 className="size-4" aria-hidden />
          {done}
        </p>
      )}
    </div>
  )
}

export function RestoreBackupButton() {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(restoreBackup, { error: null, success: null })

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        <Upload className="size-5" aria-hidden />
        Restaurer une sauvegarde
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Restaurer une sauvegarde"
        size="md"
      >
        <form action={formAction} className="space-y-5">
          <div className="flex gap-3 rounded-lg bg-warn-50 px-4 py-3 text-[15px] text-warn-800 ring-1 ring-inset ring-warn-100">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Ce que fait la restauration</p>
              <p className="mt-1">
                Chaque enregistrement de la sauvegarde est réinséré ou mis à jour sur son
                identifiant. <strong>Aucune donnée n&apos;est supprimée</strong> : ce qui existe
                aujourd&apos;hui et ne figure pas dans la sauvegarde est conservé. Les
                enregistrements portant le même identifiant sont écrasés par les valeurs
                de la sauvegarde.
              </p>
            </div>
          </div>

          <FormError message={state.error} />
          <FormSuccess message={state.success} />

          {state.report && state.report.length > 0 && (
            <ul className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600">
              {state.report.map((line) => <li key={line}>{line}</li>)}
            </ul>
          )}

          <Field label="Fichier de sauvegarde" name="file" required
                 hint="Le fichier JSON téléchargé depuis cette page.">
            <input
              id="file"
              name="file"
              type="file"
              accept="application/json,.json"
              required
              className="field cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink-700"
            />
          </Field>

          <Field label="Confirmation" name="confirmation" required
                 hint="Tapez RESTAURER en majuscules pour confirmer.">
            <Input name="confirmation" required placeholder="RESTAURER" autoComplete="off" />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Fermer</button>
            <SubmitButton pendingLabel="Restauration…">Restaurer les données</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  )
}

/** Relance la génération des loyers manquants (normalement automatique). */
export function RegenerateRentsButton() {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function run() {
    setError(null)
    setMessage(null)
    start(async () => {
      const res = await regenerateRents()
      if (res.error) setError(res.error)
      else {
        setMessage(
          res.created && res.created > 0
            ? `${res.created} loyer${res.created > 1 ? 's' : ''} généré${res.created > 1 ? 's' : ''}.`
            : 'Tous les loyers sont déjà à jour.',
        )
      }
    })
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={run} disabled={pending} className="btn-secondary">
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <RefreshCw className="size-5" aria-hidden />}
        {pending ? 'Génération…' : 'Générer les loyers manquants'}
      </button>
      {error && <p role="alert" className="text-sm text-bad-700">{error}</p>}
      {message && (
        <p role="status" className="flex items-center gap-2 text-sm text-ok-700">
          <CheckCircle2 className="size-4" aria-hidden />
          {message}
        </p>
      )}
    </div>
  )
}
