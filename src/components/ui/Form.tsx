'use client'

import { useFormStatus } from 'react-dom'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

/** Grille de formulaire responsive : 1 colonne sur mobile, 2 sur écran large. */
export function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2">{children}</div>
}

export function FormSection({
  title, description, children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-ink-100 pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-bold text-ink-900">{title}</h2>
      {description && <p className="mb-4 mt-1 text-sm text-ink-500">{description}</p>}
      <div className={description ? '' : 'mt-4'}>{children}</div>
    </section>
  )
}

export function Field({
  label, name, hint, required, className = '', children,
}: {
  label: string
  name: string
  hint?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label}
        {required && <span className="ml-0.5 text-bad-600" aria-hidden> *</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-sm text-ink-500">{hint}</p>}
    </div>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} id={props.id ?? props.name} className={`field ${props.className ?? ''}`} />
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      id={props.id ?? props.name}
      className={`field resize-y ${props.className ?? ''}`}
    />
  )
}

export function Select({
  options, placeholder, ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <select {...props} id={props.id ?? props.name} className={`field ${props.className ?? ''}`}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

/** Champ monétaire : suffixe DT, saisie décimale, alignement chiffres. */
export function MoneyInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input
        type="number"
        step="0.001"
        min="0"
        inputMode="decimal"
        {...props}
        id={props.id ?? props.name}
        className={`field pr-14 tabular-nums ${props.className ?? ''}`}
      />
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-sm font-semibold text-ink-400">
        DT
      </span>
    </div>
  )
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg bg-bad-50 px-4 py-3 text-[15px] text-bad-700 ring-1 ring-inset ring-bad-100"
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  )
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-lg bg-ok-50 px-4 py-3 text-[15px] text-ok-700 ring-1 ring-inset ring-ok-100"
    >
      <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  )
}

export function SubmitButton({
  children = 'Enregistrer', pendingLabel = 'Enregistrement…', className = 'btn-primary',
}: {
  children?: React.ReactNode
  pendingLabel?: string
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {pending ? pendingLabel : children}
    </button>
  )
}
