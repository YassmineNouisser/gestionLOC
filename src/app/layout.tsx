import type { Metadata, Viewport } from 'next'
import { Manrope, Bricolage_Grotesque } from 'next/font/google'
import './globals.css'

/**
 * Interface et chiffres. Grotesque géométrique à large hauteur d'x :
 * très lisible en petit corps, avec de vrais chiffres tabulaires
 * indispensables pour aligner des colonnes de montants.
 */
const sans = Manrope({
  variable: '--font-sans-app',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
})

/**
 * Titres. Grotesque contemporaine à l'approche serrée : elle donne du
 * caractère aux gros corps sans jamais servir au texte courant.
 */
const display = Bricolage_Grotesque({
  variable: '--font-display',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Gestion Locative',
    template: '%s · Gestion Locative',
  },
  description: 'Application interne de gestion du patrimoine immobilier locatif',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3b4a9b',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sans.variable} ${display.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
