'use client'

import { money } from '@/lib/format'

interface Entry {
  name?: string
  value?: number | string
  color?: string
  dataKey?: string | number
}

/** Infobulle commune à tous les graphiques : libellé + valeurs formatées en DT. */
export function VizTooltip({
  active, payload, label, labelFormatter,
}: {
  active?: boolean
  payload?: Entry[]
  label?: string
  labelFormatter?: (v: string) => string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 shadow-lg">
      {label !== undefined && (
        <p className="mb-1.5 text-sm font-bold text-ink-900">
          {labelFormatter ? labelFormatter(String(label)) : label}
        </p>
      )}
      <ul className="space-y-1">
        {payload.map((entry, i) => (
          <li key={i} className="flex items-center justify-between gap-6 text-sm">
            <span className="flex items-center gap-2 text-ink-600">
              <span className="size-2.5 rounded-sm" style={{ background: entry.color }} aria-hidden />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums text-ink-900">
              {money(Number(entry.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
