// =============================================================================
// Types métier — reflètent le schéma Postgres (supabase/migrations)
// =============================================================================

export type PropertyStatus = 'libre' | 'loue' | 'maintenance'
export type PropertyType =
  | 'appartement' | 'maison' | 'studio' | 'villa'
  | 'local_commercial' | 'bureau' | 'terrain' | 'garage' | 'autre'
export type ContractStatus = 'actif' | 'termine' | 'resilie'
export type RentStatus = 'a_payer' | 'paye' | 'partiel' | 'impaye'
export type PaymentMethod = 'especes' | 'virement' | 'cheque' | 'autre'
export type DepositStatus = 'sans_caution' | 'a_verser' | 'partielle' | 'payee'
export type ExpenseCategory =
  | 'reparation' | 'entretien' | 'travaux' | 'assurance'
  | 'eau' | 'electricite' | 'syndic' | 'taxes' | 'autres'
export type DocEntity = 'property' | 'tenant' | 'contract' | 'payment' | 'expense'
export type DocType = 'contrat' | 'cin' | 'facture' | 'recu' | 'photo' | 'administratif' | 'autre'
export type UserRole = 'proprietaire' | 'gestionnaire' | 'lecteur'

export interface Property {
  id: string
  reference: string
  name: string
  address: string | null
  city: string | null
  type: PropertyType
  surface: number | null
  rooms: number | null
  purchase_price: number
  purchase_date: string | null
  purchase_fees: number
  initial_works: number
  total_investment: number
  monthly_rent: number
  charges: number
  water_rate: number
  electricity_rate: number
  status: PropertyStatus
  insurance_expiry: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Tenant {
  id: string
  first_name: string
  last_name: string
  cin: string | null
  phone: string | null
  email: string | null
  address: string | null
  profession: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Contract {
  id: string
  property_id: string
  tenant_id: string
  start_date: string
  end_date: string | null
  monthly_rent: number
  deposit: number
  due_day: number
  charges: number
  conditions: string | null
  status: ContractStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Rent {
  id: string
  contract_id: string
  property_id: string
  tenant_id: string
  period_month: string
  amount_due: number
  amount_paid: number
  due_date: string
  created_at: string
}

/** Vue v_rents : loyer enrichi (reste, statut, retard, libellés). */
export interface RentView extends Rent {
  balance: number
  raw_balance: number
  status: RentStatus
  is_overdue: boolean
  days_overdue: number
  property_reference: string
  property_name: string
  property_city: string | null
  tenant_first_name: string
  tenant_last_name: string
  tenant_phone: string | null
  tenant_cin: string | null
  contract_status: ContractStatus
}

export interface Payment {
  id: string
  rent_id: string
  contract_id: string
  tenant_id: string
  property_id: string
  amount: number
  payment_date: string
  method: PaymentMethod
  reference: string | null
  note: string | null
  created_at: string
}

export interface Expense {
  id: string
  property_id: string
  category: ExpenseCategory
  amount: number
  expense_date: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface DocumentRow {
  id: string
  entity_type: DocEntity
  entity_id: string
  doc_type: DocType
  name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

/** Vue v_property_stats : rentabilité par bien. */
export interface PropertyStats {
  property_id: string
  reference: string
  name: string
  city: string | null
  type: PropertyType
  status: PropertyStatus
  surface: number | null
  monthly_rent: number
  charges: number
  total_investment: number
  total_revenus: number
  total_du: number
  total_impayes: number
  total_depenses: number
  revenu_net: number
  revenus_12m: number
  depenses_12m: number
  revenu_net_12m: number
  rentabilite_nette: number | null
  rentabilite_brute: number | null
}

/** Vue v_monthly_summary : synthèse mensuelle. */
export interface MonthlySummary {
  period_month: string
  loyers_prevus: number
  loyers_encaisses: number
  montant_restant: number
  impayes: number
  nb_loyers: number
  depenses: number
  revenu_net: number
}

/** Vue v_dashboard : indicateurs du tableau de bord. */
export interface DashboardStats {
  nb_biens: number
  nb_biens_loues: number
  nb_biens_libres: number
  nb_biens_maintenance: number
  nb_locataires: number
  nb_contrats_actifs: number
  loyers_prevus_mois: number
  loyers_encaisses_mois: number
  montant_restant_mois: number
  total_impayes: number
  nb_impayes: number
  depenses_mois: number
  revenu_net_mois: number
  investissement_total: number
  revenu_net_12m: number
  rentabilite_globale: number | null
}

export interface TenantStats {
  tenant_id: string
  total_du: number
  total_paye: number
  total_restant: number
  total_impayes: number
  nb_impayes: number
}

/**
 * La vue renvoie des données brutes : la phrase et le formatage des montants
 * sont composés à l'affichage, avec le même formateur que le reste de l'app.
 */
export interface Notification {
  key: string
  type: 'impaye' | 'partiel' | 'echeance' | 'contrat' | 'assurance' | 'maintenance'
  severity: 'danger' | 'warning' | 'info'
  title: string
  subject: string
  amount: number | null
  ref_date: string
  entity_type: string
  entity_id: string
}

export interface AuditEntry {
  id: number
  table_name: string
  row_id: string | null
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  user_id: string | null
  created_at: string
}

/**
 * Relevé de compteurs. Consommations et montants sont des colonnes générées
 * par PostgreSQL : ils ne peuvent pas diverger des index saisis.
 */
export interface MeterReading {
  id: string
  property_id: string
  contract_id: string | null
  tenant_id: string | null
  period_month: string
  reading_date: string
  water_previous_index: number
  water_current_index: number
  water_rate: number
  water_consumption: number
  water_amount: number
  elec_previous_index: number
  elec_current_index: number
  elec_rate: number
  elec_consumption: number
  elec_amount: number
  total_amount: number
  notes: string | null
  created_at: string
  updated_at: string
}

/** Vue v_meter_readings : relevé enrichi du bien et du locataire. */
export interface MeterReadingView extends MeterReading {
  property_reference: string
  property_name: string
  property_city: string | null
  tenant_first_name: string | null
  tenant_last_name: string | null
}

/** Versement de caution. Une caution peut être réglée en plusieurs fois. */
export interface DepositPayment {
  id: string
  contract_id: string
  tenant_id: string
  property_id: string
  amount: number
  payment_date: string
  method: PaymentMethod
  reference: string | null
  note: string | null
  created_at: string
}

/** Vue v_contract_deposits : situation de la caution, par contrat. */
export interface ContractDeposit {
  contract_id: string
  property_id: string
  tenant_id: string
  contract_status: ContractStatus
  start_date: string
  deposit_due: number
  deposit_paid: number
  deposit_balance: number
  deposit_status: DepositStatus
  deposit_payments_count: number
  property_reference: string
  property_name: string
  tenant_first_name: string
  tenant_last_name: string
}

/** Réglages de l'application. Une seule ligne en base. */
export interface AppSettings {
  id: number
  ntfy_enabled: boolean
  ntfy_server: string
  ntfy_topic: string | null
  overdue_days: number
  app_url: string
  updated_at: string
}

/** Notification effectivement envoyée, pour affichage du journal. */
export interface NotificationDelivery {
  id: string
  rent_id: string
  kind: string
  topic: string | null
  message: string | null
  sent_at: string
}
