import type { ContractStatus, DepositStatus, PropertyStatus, RentStatus, ExpenseCategory } from '@/lib/types'
import { CONTRACT_STATUS, DEPOSIT_STATUS, EXPENSE_CATEGORY, PROPERTY_STATUS, RENT_STATUS } from '@/lib/format'

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral'

const TONES: Record<Tone, string> = {
  ok:      'bg-ok-50 text-ok-700 ring-1 ring-inset ring-ok-100',
  warn:    'bg-warn-50 text-warn-700 ring-1 ring-inset ring-warn-100',
  bad:     'bg-bad-50 text-bad-700 ring-1 ring-inset ring-bad-100',
  info:    'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100',
  neutral: 'bg-ink-100 text-ink-700 ring-1 ring-inset ring-ink-200',
}

const DOTS: Record<Tone, string> = {
  ok: 'bg-ok-600', warn: 'bg-warn-600', bad: 'bg-bad-600',
  info: 'bg-brand-600', neutral: 'bg-ink-400',
}

export function Badge({
  tone = 'neutral', children, dot = true, className = '',
}: {
  tone?: Tone
  children: React.ReactNode
  dot?: boolean
  className?: string
}) {
  return (
    <span className={`badge ${TONES[tone]} ${className}`}>
      {dot && <span className={`size-1.5 rounded-full ${DOTS[tone]}`} aria-hidden />}
      {children}
    </span>
  )
}

const PROPERTY_TONE: Record<PropertyStatus, Tone> = {
  loue: 'ok', libre: 'info', maintenance: 'warn',
}
export function PropertyStatusBadge({ status }: { status: PropertyStatus }) {
  return <Badge tone={PROPERTY_TONE[status]}>{PROPERTY_STATUS[status]}</Badge>
}

const CONTRACT_TONE: Record<ContractStatus, Tone> = {
  actif: 'ok', termine: 'neutral', resilie: 'bad',
}
export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <Badge tone={CONTRACT_TONE[status]}>{CONTRACT_STATUS[status]}</Badge>
}

const RENT_TONE: Record<RentStatus, Tone> = {
  paye: 'ok', partiel: 'warn', impaye: 'bad', a_payer: 'neutral',
}
export function RentStatusBadge({ status }: { status: RentStatus }) {
  return <Badge tone={RENT_TONE[status]}>{RENT_STATUS[status]}</Badge>
}

export function CategoryBadge({ category }: { category: ExpenseCategory }) {
  return <Badge tone="neutral" dot={false}>{EXPENSE_CATEGORY[category]}</Badge>
}

const DEPOSIT_TONE: Record<DepositStatus, Tone> = {
  payee: 'ok', partielle: 'warn', a_verser: 'bad', sans_caution: 'neutral',
}
export function DepositStatusBadge({ status }: { status: DepositStatus }) {
  return <Badge tone={DEPOSIT_TONE[status]}>{DEPOSIT_STATUS[status]}</Badge>
}
