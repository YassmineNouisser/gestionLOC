'use client'

import { useEffect, useRef, useState } from 'react'
import { BarChart3, Building2, ShieldCheck, Wallet } from 'lucide-react'

/** Silhouette d'immeubles : largeur, hauteur, colonnes et rangées de fenêtres. */
const BUILDINGS = [
  { x: 0,   w: 74,  h: 172, cols: 3, rows: 6 },
  { x: 84,  w: 96,  h: 246, cols: 4, rows: 9 },
  { x: 190, w: 66,  h: 138, cols: 3, rows: 5 },
  { x: 266, w: 110, h: 300, cols: 4, rows: 11 },
  { x: 386, w: 78,  h: 196, cols: 3, rows: 7 },
]

const BASE = 320

/**
 * Immeubles dont les fenêtres s'allument par vagues.
 * Les décalages sont dérivés de la position de chaque fenêtre : le motif
 * reste identique d'un rendu à l'autre, sans tirage aléatoire.
 */
function Skyline() {
  return (
    <svg
      viewBox="0 0 464 320"
      preserveAspectRatio="xMidYMax meet"
      className="h-full w-full"
      role="img"
      aria-label="Illustration d'un ensemble d'immeubles"
    >
      <defs>
        <linearGradient id="facade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(255 255 255 / 0.16)" />
          <stop offset="100%" stopColor="rgb(255 255 255 / 0.04)" />
        </linearGradient>
      </defs>

      {BUILDINGS.map((b, bi) => {
        const top = BASE - b.h
        const padX = 11
        const padY = 14
        const gapX = (b.w - padX * 2) / b.cols
        const gapY = (b.h - padY * 2) / b.rows

        return (
          <g key={b.x}>
            <rect
              x={b.x}
              y={top}
              width={b.w}
              height={b.h}
              rx={4}
              fill="url(#facade)"
              stroke="rgb(255 255 255 / 0.18)"
              strokeWidth="1"
            />
            {/* Liseré doré en couronnement */}
            <rect
              x={b.x + 6}
              y={top + 3}
              width={b.w - 12}
              height={1.5}
              rx={0.75}
              fill="rgb(220 190 121 / 0.55)"
            />

            {Array.from({ length: b.rows }).map((_, r) =>
              Array.from({ length: b.cols }).map((_, c) => (
                <rect
                  key={`${r}-${c}`}
                  className="login-window"
                  x={b.x + padX + c * gapX + gapX * 0.16}
                  y={top + padY + r * gapY + gapY * 0.18}
                  width={gapX * 0.62}
                  height={gapY * 0.5}
                  rx={1}
                  fill="rgb(238 226 196 / 0.9)"
                  style={{ animationDelay: `${((bi * 7 + r * 3 + c * 5) % 14) * 0.5}s` }}
                />
              )),
            )}
          </g>
        )
      })}

      {/* Sol */}
      <rect x="0" y={BASE} width="464" height="1" fill="rgb(255 255 255 / 0.25)" />
    </svg>
  )
}

const FEATURES = [
  { icon: Wallet,      title: 'Loyers générés seuls',   text: 'Chaque mois, pour chaque contrat actif.' },
  { icon: BarChart3,   title: 'Rentabilité en direct',  text: 'Recalculée à chaque paiement et dépense.' },
  { icon: ShieldCheck, title: 'Accès protégé',          text: 'Données cloisonnées, historique complet.' },
]

export function Showcase() {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return

    function onMove(e: MouseEvent) {
      const r = el!.getBoundingClientRect()
      // Décalage normalisé entre -1 et 1 depuis le centre du panneau.
      setTilt({
        x: ((e.clientX - r.left) / r.width - 0.5) * 2,
        y: ((e.clientY - r.top) / r.height - 0.5) * 2,
      })
    }

    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', () => setTilt({ x: 0, y: 0 }))
    return () => el.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div
      ref={ref}
      className="relative hidden overflow-hidden bg-brand-950 lg:flex lg:flex-col lg:justify-between"
    >
      {/* Aurores lentes */}
      <span
        className="login-aurora -left-24 -top-24 size-[34rem] bg-brand-500/40"
        style={{ animation: 'aurora-a 22s ease-in-out infinite' }}
        aria-hidden
      />
      <span
        className="login-aurora -bottom-32 -right-20 size-[30rem] bg-gold-500/25"
        style={{ animation: 'aurora-b 26s ease-in-out infinite' }}
        aria-hidden
      />
      <span className="login-grid" aria-hidden />

      {/* Faisceau qui descend lentement sur la trame */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/10 to-transparent"
        style={{ animation: 'beam 14s linear infinite' }}
        aria-hidden
      />

      <div className="relative z-10 shrink-0 px-12 pb-4 pt-10 xl:px-14 xl:pt-12">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold-300/80">
          Patrimoine immobilier
        </p>
        <h2 className="font-display mt-5 max-w-lg text-[1.9rem] leading-[1.14] text-white xl:text-[2.15rem]">
          Toute votre gestion locative sur un seul écran.
        </h2>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/60">
          Biens, locataires, contrats, loyers et dépenses — reliés, calculés,
          et tenus à jour sans saisie en double.
        </p>
      </div>

      {/* Immeubles, en léger parallaxe sous le curseur */}
      <div
        className="relative z-10 min-h-0 max-h-[42vh] flex-1 px-12 xl:px-14"
        style={{
          transform: `translate3d(${tilt.x * -10}px, ${tilt.y * -6}px, 0)`,
          transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <Skyline />
      </div>

      <div className="relative z-10 grid shrink-0 gap-px bg-white/10 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="bg-brand-950/80 px-6 py-5 backdrop-blur-sm">
            <Icon className="size-[18px] text-gold-300" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-[13px] leading-snug text-white/50">{text}</p>
          </div>
        ))}
      </div>

      {/* Marque discrète en filigrane */}
      <Building2
        className="pointer-events-none absolute -bottom-10 -right-8 size-64 text-white/[0.03]"
        aria-hidden
      />
    </div>
  )
}
