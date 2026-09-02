'use client'

import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { AXIS_TICK, GRID_PROPS, VIZ } from './theme'
import { VizTooltip } from './Tooltip'
import { moneyCompact, monthLabel, monthShort } from '@/lib/format'
import type { MonthlySummary } from '@/lib/types'

const HEIGHT = 260

const tooltipLabel = (v: string) => monthLabel(v)

/** Loyers encaissés et dépenses, côte à côte mois par mois. */
export function RevenueExpenseChart({ data }: { data: MonthlySummary[] }) {
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="period_month" tickFormatter={monthShort} tick={AXIS_TICK}
               tickLine={false} axisLine={{ stroke: VIZ.axis }} />
        <YAxis tickFormatter={moneyCompact} tick={AXIS_TICK} tickLine={false} axisLine={false} width={54} />
        <Tooltip
          cursor={{ fill: 'rgba(22,26,39,0.04)' }}
          content={<VizTooltip labelFormatter={tooltipLabel} />}
        />
        <Bar dataKey="loyers_encaisses" name="Loyers encaissés" fill={VIZ.series1}
             radius={[4, 4, 0, 0]} maxBarSize={26}
             animationDuration={750} animationEasing="ease-out" />
        <Bar dataKey="depenses" name="Dépenses" fill={VIZ.series2}
             radius={[4, 4, 0, 0]} maxBarSize={26}
             animationDuration={750} animationEasing="ease-out" animationBegin={120} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Revenu net mensuel : une seule série, tracée en ligne. */
export function NetIncomeChart({ data }: { data: MonthlySummary[] }) {
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="period_month" tickFormatter={monthShort} tick={AXIS_TICK}
               tickLine={false} axisLine={{ stroke: VIZ.axis }} />
        <YAxis tickFormatter={moneyCompact} tick={AXIS_TICK} tickLine={false} axisLine={false} width={54} />
        <Tooltip
          cursor={{ stroke: VIZ.axis, strokeWidth: 1 }}
          content={<VizTooltip labelFormatter={tooltipLabel} />}
        />
        <Line
          type="monotone"
          dataKey="revenu_net"
          name="Revenu net"
          stroke={VIZ.series1}
          strokeWidth={2}
          dot={{ r: 4, fill: VIZ.series1, stroke: VIZ.surface, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: VIZ.series1, stroke: VIZ.surface, strokeWidth: 2 }}
          animationDuration={900}
          animationEasing="ease-out"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Montants impayés par mois — couleur d'état, toujours accompagnée du titre. */
export function UnpaidChart({ data }: { data: MonthlySummary[] }) {
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="period_month" tickFormatter={monthShort} tick={AXIS_TICK}
               tickLine={false} axisLine={{ stroke: VIZ.axis }} />
        <YAxis tickFormatter={moneyCompact} tick={AXIS_TICK} tickLine={false} axisLine={false} width={54} />
        <Tooltip
          cursor={{ fill: 'rgba(22,26,39,0.04)' }}
          content={<VizTooltip labelFormatter={tooltipLabel} />}
        />
        <Bar dataKey="impayes" name="Impayés" fill={VIZ.critical}
             radius={[4, 4, 0, 0]} maxBarSize={26}
             animationDuration={750} animationEasing="ease-out" />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Rentabilité nette par bien, en barres horizontales classées. */
export function YieldByPropertyChart({
  data,
}: {
  data: { name: string; rentabilite: number }[]
}) {
  const height = Math.max(180, data.length * 34 + 30)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={VIZ.grid} horizontal={false} />
        <XAxis type="number" tickFormatter={(v: number) => `${String(v).replace('.', ',')}\u00a0%`} tick={AXIS_TICK}
               tickLine={false} axisLine={{ stroke: VIZ.axis }} />
        <YAxis type="category" dataKey="name" tick={AXIS_TICK} tickLine={false}
               axisLine={false} width={120} />
        <Tooltip
          cursor={{ fill: 'rgba(22,26,39,0.04)' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 shadow-lg">
                <p className="text-sm font-bold text-ink-900">{label}</p>
                <p className="text-sm text-ink-600">
                  Rentabilité nette :{' '}
                  <span className="font-semibold tabular-nums text-ink-900">
                    {String(payload[0].value).replace('.', ',')} %
                  </span>
                </p>
              </div>
            ) : null
          }
        />
        <Bar dataKey="rentabilite" name="Rentabilité nette" radius={[0, 4, 4, 0]} maxBarSize={20}
             animationDuration={800} animationEasing="ease-out">
          {data.map((d) => (
            <Cell key={d.name} fill={d.rentabilite >= 0 ? VIZ.series1 : VIZ.critical} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
