import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

type Tone = 'default' | 'ok' | 'warn' | 'bad' | 'brand'

const VALUE: Record<Tone, string> = {
  default: 'text-ink-900',
  brand:   'text-brand-700',
  ok:      'text-ok-700',
  warn:    'text-warn-700',
  bad:     'text-bad-700',
}

const ICON: Record<Tone, string> = {
  default: 'bg-ink-100 text-ink-500 ring-ink-200',
  brand:   'bg-brand-50 text-brand-600 ring-brand-100',
  ok:      'bg-ok-50 text-ok-600 ring-ok-100',
  warn:    'bg-warn-50 text-warn-600 ring-warn-100',
  bad:     'bg-bad-50 text-bad-600 ring-bad-100',
}

/** Filet coloré en pied de carte : repère l'indicateur sans crier. */
const RULE: Record<Tone, string> = {
  default: 'from-ink-300/60',
  brand:   'from-brand-500/70',
  ok:      'from-ok-600/70',
  warn:    'from-warn-600/70',
  bad:     'from-bad-600/70',
}

export function StatCard({
  label, value, hint, icon, tone = 'default', href,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  icon?: React.ReactNode
  tone?: Tone
  href?: string
}) {
  const body = (
    <div
      className={`card reveal h-full overflow-hidden p-4 sm:p-5 ${href ? 'card-link' : ''}`}
    >
      <span
        className={`absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r to-transparent ${RULE[tone]}`}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold leading-snug text-ink-500">{label}</p>
        {icon && (
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${ICON[tone]}`}
          >
            {icon}
          </span>
        )}
      </div>

      <p
        className={`mt-2 text-2xl font-bold leading-none tracking-tight tabular-nums sm:text-[1.65rem] ${VALUE[tone]}`}
      >
        {value}
      </p>

      {hint && <p className="mt-2 text-[13px] leading-snug text-ink-500">{hint}</p>}

      {href && (
        <ArrowUpRight
          className="absolute bottom-4 right-4 size-4 translate-y-1 text-ink-300 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
          aria-hidden
        />
      )}
    </div>
  )

  return href ? <Link href={href} className="group block h-full">{body}</Link> : body
}
