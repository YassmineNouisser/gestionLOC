// =============================================================================
// Formatage & libellés — tout l'affichage est en français, devise en dinar (DT)
// =============================================================================

import type {
  ContractStatus, DepositStatus, ExpenseCategory, PaymentMethod,
  PropertyStatus, PropertyType, RentStatus, UserRole, DocType,
} from './types'

const nfExact = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
})
const nfWhole = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/**
 * Intl produit une espace fine insécable (U+202F) comme séparateur de milliers.
 * Trop discrète en graisse normale : « 1 580 » se lit « 1580 ». On la remplace
 * par une espace insécable standard, qui sépare visiblement sans couper le nombre.
 */
function spaced(v: string): string {
  return v.replace(/\u202f/g, '\u00a0')
}

/**
 * Montant en dinars. Les millimes ne s'affichent que si elles existent :
 * 1500 -> "1 500 DT", 1500.5 -> "1 500,500 DT".
 * Afficher « ,000 » sur chaque ligne rend les tableaux illisibles.
 */
export function money(v: number | null | undefined): string {
  const n = Math.round(Number(v ?? 0) * 1000) / 1000
  return `${spaced(Number.isInteger(n) ? nfWhole.format(n) : nfExact.format(n))}\u00a0DT`
}

/** Montant toujours au millime près, pour les reçus et les justificatifs. */
export function moneyExact(v: number | null | undefined): string {
  return `${spaced(nfExact.format(Number(v ?? 0)))}\u00a0DT`
}

/** Montant arrondi au dinar (cartes, graphiques). */
export function moneyShort(v: number | null | undefined): string {
  return `${spaced(nfWhole.format(Math.round(Number(v ?? 0))))}\u00a0DT`
}

/** Montant compact pour les axes : 12 500 -> "12,5 k". */
export function moneyCompact(v: number | null | undefined): string {
  const n = Number(v ?? 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace('.', ',')} k`
  return spaced(nfWhole.format(Math.round(n)))
}

export function percent(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `${spaced(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(v)))}\u00a0%`
}

export function num(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return '—'
  return spaced(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(Number(v)))
}

/** "2026-03-05" -> "05/03/2026" */
export function date(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeZone: 'UTC' }).format(d)
}

export function dateLong(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(d)
}

export function dateTime(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(d)
}

/** "2026-03-01" -> "Mars 2026" */
export function monthLabel(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  const s = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "2026-03-01" -> "Mars" (axes de graphiques) */
export function monthShort(v: string | null | undefined): string {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  const s = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(d)
  return s.charAt(0).toUpperCase() + s.slice(1).replace('.', '')
}

/** Premier jour du mois au format ISO, en UTC (évite les décalages de fuseau). */
export function firstOfMonth(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Décale un mois ISO de n mois. */
export function shiftMonth(iso: string, n: number): string {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

// ---------------------------------------------------------------------------
// Libellés
// ---------------------------------------------------------------------------
export const PROPERTY_STATUS: Record<PropertyStatus, string> = {
  libre: 'Libre',
  loue: 'Loué',
  maintenance: 'Maintenance',
}

export const PROPERTY_TYPE: Record<PropertyType, string> = {
  appartement: 'Appartement',
  maison: 'Maison',
  studio: 'Studio',
  villa: 'Villa',
  local_commercial: 'Local commercial',
  bureau: 'Bureau',
  terrain: 'Terrain',
  garage: 'Garage',
  autre: 'Autre',
}

export const CONTRACT_STATUS: Record<ContractStatus, string> = {
  actif: 'Actif',
  termine: 'Terminé',
  resilie: 'Résilié',
}

export const RENT_STATUS: Record<RentStatus, string> = {
  a_payer: 'À payer',
  paye: 'Payé',
  partiel: 'Partiel',
  impaye: 'Impayé',
}

export const DEPOSIT_STATUS: Record<DepositStatus, string> = {
  sans_caution: 'Sans caution',
  a_verser: 'À verser',
  partielle: 'Partielle',
  payee: 'Versée',
}

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  especes: 'Espèces',
  virement: 'Virement',
  cheque: 'Chèque',
  autre: 'Autre',
}

export const EXPENSE_CATEGORY: Record<ExpenseCategory, string> = {
  reparation: 'Réparation',
  entretien: 'Entretien',
  travaux: 'Travaux',
  assurance: 'Assurance',
  eau: 'Eau',
  electricite: 'Électricité',
  syndic: 'Syndic',
  taxes: 'Taxes',
  autres: 'Autres',
}

export const DOC_TYPE: Record<DocType, string> = {
  contrat: 'Contrat',
  cin: 'CIN',
  facture: 'Facture',
  recu: 'Reçu',
  photo: 'Photo',
  administratif: 'Document administratif',
  autre: 'Autre',
}

export const USER_ROLE: Record<UserRole, string> = {
  proprietaire: 'Propriétaire',
  gestionnaire: 'Gestionnaire',
  lecteur: 'Lecteur',
}

export const AUDIT_TABLE: Record<string, string> = {
  properties: 'Bien',
  tenants: 'Locataire',
  contracts: 'Contrat',
  payments: 'Paiement',
  expenses: 'Dépense',
  meter_readings: 'Relevé de compteurs',
  deposit_payments: 'Versement de caution',
}

export const AUDIT_ACTION: Record<string, string> = {
  INSERT: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
}

export function tenantName(t: { first_name?: string | null; last_name?: string | null } | null | undefined): string {
  if (!t) return '—'
  return [t.first_name, t.last_name].filter(Boolean).join(' ') || '—'
}

export function fileSize(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  const units = ['o', 'Ko', 'Mo', 'Go']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)} ${units[i]}`
}
