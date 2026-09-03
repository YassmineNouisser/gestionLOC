'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell, Building2, ChevronDown, FileBarChart, FileText, Files, Gauge, Home,
  LayoutDashboard, LogOut, Menu, Receipt, Search, Settings, TrendingUp, Users, Wallet, X,
} from 'lucide-react'
import { signOut } from '@/lib/actions/auth'

/**
 * Navigation groupée par intention plutôt qu'en liste plate :
 * ce que je gère, ce que j'encaisse, ce que j'analyse.
 */
const NAV = [
  {
    label: null,
    items: [{ href: '/', label: 'Tableau de bord', icon: LayoutDashboard }],
  },
  {
    label: 'Gestion',
    items: [
      { href: '/biens',      label: 'Biens',      icon: Home },
      { href: '/locataires', label: 'Locataires', icon: Users },
      { href: '/contrats',   label: 'Contrats',   icon: FileText },
    ],
  },
  {
    label: 'Finances',
    items: [
      { href: '/loyers',    label: 'Loyers',    icon: Receipt },
      { href: '/paiements', label: 'Paiements', icon: Wallet },
      { href: '/depenses',  label: 'Dépenses',  icon: Building2 },
      { href: '/releves',   label: 'Eau & élec.', icon: Gauge },
    ],
  },
  {
    label: 'Analyse',
    items: [
      { href: '/rentabilite', label: 'Rentabilité', icon: TrendingUp },
      { href: '/rapports',    label: 'Rapports',    icon: FileBarChart },
      { href: '/documents',   label: 'Documents',   icon: Files },
    ],
  },
] as const

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

/** Marque : monogramme en dégradé et filet doré, nom en serif. */
function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className="relative flex size-9 items-center justify-center rounded-[0.6rem] bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-sm">
        <Building2 className="size-[18px]" aria-hidden />
        <span
          className="absolute inset-x-1.5 bottom-[3px] h-px rounded-full bg-gold-300/70"
          aria-hidden
        />
      </span>
      {!compact && (
        <span className="font-display text-[1.1rem] leading-none text-ink-900">
          Gestion Locative
        </span>
      )}
    </span>
  )
}

/**
 * Barre de navigation. Le repère actif est un élément unique qui se déplace
 * d'un lien à l'autre : la continuité du mouvement montre le chemin parcouru.
 */
function NavList({ pathname }: { pathname: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLAnchorElement>(null)
  const [marker, setMarker] = useState<{ top: number; height: number } | null>(null)

  const measure = useCallback(() => {
    const container = containerRef.current
    const active = activeRef.current
    if (!container || !active) {
      setMarker(null)
      return
    }
    setMarker({ top: active.offsetTop, height: active.offsetHeight })
  }, [])

  useLayoutEffect(measure, [measure, pathname])

  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navigation principale">
      <div ref={containerRef} className="relative">
        {/* Fond du lien actif : glisse d'une position à l'autre. */}
        {marker && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 rounded-lg bg-brand-50 ring-1 ring-inset ring-brand-100"
            style={{
              top: marker.top,
              height: marker.height,
              transition: 'top 0.45s var(--ease-out-quint), height 0.45s var(--ease-out-quint)',
            }}
          />
        )}
        {/* Filet vertical accompagnant le fond. */}
        {marker && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-0 w-[3px] rounded-r-full bg-gradient-to-b from-brand-500 to-brand-700"
            style={{
              top: marker.top + 6,
              height: Math.max(marker.height - 12, 8),
              transition: 'top 0.45s var(--ease-out-quint), height 0.45s var(--ease-out-quint)',
            }}
          />
        )}

        {NAV.map((group, i) => (
          <div key={group.label ?? 'principal'} className={i > 0 ? 'mt-5' : ''}>
            {group.label && (
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href)
                return (
                  <Link
                    key={href}
                    href={href}
                    ref={active ? activeRef : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`relative z-10 flex items-center gap-3 rounded-lg py-2.5 pl-3.5 pr-3 text-[15px] font-medium transition-colors duration-200 ${
                      active ? 'text-brand-700' : 'text-ink-600 hover:text-ink-900'
                    }`}
                  >
                    <Icon
                      className={`size-[18px] shrink-0 transition-colors duration-200 ${
                        active ? 'text-brand-600' : 'text-ink-400'
                      }`}
                      aria-hidden
                    />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  )
}

export function Shell({
  children, userName, userEmail, userRole, alertCount,
}: {
  children: React.ReactNode
  userName: string
  userEmail: string
  userRole: string
  alertCount: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')

  // Referme le tiroir et le menu à chaque navigation.
  useEffect(() => {
    setMobileOpen(false)
    setMenuOpen(false)
  }, [pathname])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q) router.push(`/recherche?q=${encodeURIComponent(q)}`)
  }

  const settingsLink = (
    <Link
      href="/parametres"
      className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] font-medium transition-colors ${
        isActive(pathname, '/parametres')
          ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100'
          : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
      }`}
    >
      <Settings className="size-[18px] text-ink-400" aria-hidden />
      Paramètres
    </Link>
  )

  return (
    <div className="relative z-10 flex min-h-dvh">
      {/* Barre latérale — écrans larges */}
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-ink-200 bg-white/70 backdrop-blur-xl lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-ink-200 px-5">
          <Brand />
        </div>
        <NavList pathname={pathname} />
        <div className="border-t border-ink-200 p-3">{settingsLink}</div>
      </aside>

      {/* Tiroir mobile */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div
            className="reveal-fade absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white"
            style={{
              boxShadow: 'var(--shadow-lg)',
              animation: 'rise 0.35s var(--ease-out-quint) both',
            }}
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-ink-200 pl-5 pr-3">
              <Brand />
              <button
                onClick={() => setMobileOpen(false)}
                className="btn-ghost p-2"
                aria-label="Fermer le menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <NavList pathname={pathname} />
            <div className="border-t border-ink-200 p-3">{settingsLink}</div>
          </aside>
        </div>
      )}

      {/* Zone principale */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="no-print sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-ink-200 bg-[color-mix(in_srgb,var(--bg)_78%,white)] px-4 backdrop-blur-xl sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="btn-ghost -ml-2 p-2 lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu className="size-6" />
          </button>

          <form onSubmit={submitSearch} className="relative min-w-0 flex-1 max-w-md" role="search">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-400"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un locataire, un bien, une CIN…"
              aria-label="Recherche rapide"
              className="field h-10 rounded-full py-0 pl-11 text-[15px]"
            />
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/notifications"
              className="relative flex size-10 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
              aria-label={`Notifications${alertCount > 0 ? ` (${alertCount} en attente)` : ''}`}
            >
              <Bell className="size-[18px]" />
              {alertCount > 0 && (
                <span className="absolute right-1 top-1.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-bad-600 px-1 text-[11px] font-bold leading-[1.1rem] text-white ring-2 ring-white">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </Link>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-ink-100"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-sm font-bold text-white">
                  {userName.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-[10rem] truncate text-sm font-semibold text-ink-800">
                    {userName}
                  </span>
                  <span className="block text-xs text-ink-500">{userRole}</span>
                </span>
                <ChevronDown
                  className={`size-4 text-ink-400 transition-transform duration-300 ${menuOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-ink-200 bg-white"
                    style={{
                      boxShadow: 'var(--shadow-lg)',
                      animation: 'pop-in 0.25s var(--ease-out-quint) both',
                    }}
                  >
                    <div className="border-b border-ink-100 px-4 py-3">
                      <p className="truncate text-sm font-semibold text-ink-900">{userName}</p>
                      <p className="truncate text-xs text-ink-500">{userEmail}</p>
                    </div>
                    <Link
                      href="/parametres"
                      role="menuitem"
                      className="flex items-center gap-2.5 px-4 py-3 text-[15px] text-ink-700 transition-colors hover:bg-ink-50"
                    >
                      <Settings className="size-[18px] text-ink-400" aria-hidden />
                      Paramètres
                    </Link>
                    <form action={signOut}>
                      <button
                        type="submit"
                        role="menuitem"
                        className="flex w-full items-center gap-2.5 border-t border-ink-100 px-4 py-3 text-left text-[15px] text-bad-600 transition-colors hover:bg-bad-50"
                      >
                        <LogOut className="size-[18px]" aria-hidden />
                        Se déconnecter
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main key={pathname} className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
          <div className="mx-auto max-w-[85rem]">{children}</div>
        </main>
      </div>
    </div>
  )
}
