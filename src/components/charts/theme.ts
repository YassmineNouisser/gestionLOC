/**
 * Jetons de visualisation.
 * Palette catégorielle validée pour la vision des couleurs (ΔE CVD 24,7 ;
 * vision normale 33,6 ; contraste ≥ 3:1 sur fond blanc).
 */
export const VIZ = {
  /** Entrées d'argent : loyers encaissés. */
  series1: '#2a78d6',
  /** Sorties d'argent : dépenses. */
  series2: '#eb6834',
  /** État critique : impayés (toujours accompagné d'un libellé explicite). */
  critical: '#d03b3b',
  /** Repères et axes, volontairement discrets. */
  grid: '#e7e4dd',
  axis: '#cbc7bd',
  muted: '#9d988c',
  ink: '#1b1a17',
  inkSoft: '#57534a',
  surface: '#ffffff',
} as const

export const AXIS_TICK = { fill: VIZ.muted, fontSize: 12 } as const
export const GRID_PROPS = {
  stroke: VIZ.grid,
  strokeDasharray: '0',
  vertical: false,
} as const
