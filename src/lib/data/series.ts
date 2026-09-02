import { shiftMonth, firstOfMonth } from '@/lib/format'
import type { MonthlySummary } from '@/lib/types'

const EMPTY = {
  loyers_prevus: 0, loyers_encaisses: 0, montant_restant: 0,
  impayes: 0, nb_loyers: 0, depenses: 0, revenu_net: 0,
}

/**
 * Complète une série mensuelle pour couvrir les `count` derniers mois,
 * mois vides inclus : l'axe des graphiques reste continu.
 */
export function lastMonths(data: MonthlySummary[], count = 12, endMonth?: string): MonthlySummary[] {
  const end = endMonth ?? firstOfMonth()
  const byMonth = new Map(data.map((d) => [d.period_month.slice(0, 10), d]))

  return Array.from({ length: count }, (_, i) => {
    const period = shiftMonth(end, i - (count - 1))
    const found = byMonth.get(period)
    return found ?? { period_month: period, ...EMPTY }
  })
}

/** Série des 12 mois d'une année civile. */
export function yearMonths(data: MonthlySummary[], year: number): MonthlySummary[] {
  const byMonth = new Map(data.map((d) => [d.period_month.slice(0, 10), d]))

  return Array.from({ length: 12 }, (_, i) => {
    const period = `${year}-${String(i + 1).padStart(2, '0')}-01`
    return byMonth.get(period) ?? { period_month: period, ...EMPTY }
  })
}

export function sumSeries(data: MonthlySummary[]) {
  return data.reduce(
    (acc, m) => ({
      loyers_prevus: acc.loyers_prevus + Number(m.loyers_prevus),
      loyers_encaisses: acc.loyers_encaisses + Number(m.loyers_encaisses),
      montant_restant: acc.montant_restant + Number(m.montant_restant),
      impayes: acc.impayes + Number(m.impayes),
      depenses: acc.depenses + Number(m.depenses),
      revenu_net: acc.revenu_net + Number(m.revenu_net),
    }),
    { loyers_prevus: 0, loyers_encaisses: 0, montant_restant: 0, impayes: 0, depenses: 0, revenu_net: 0 },
  )
}
