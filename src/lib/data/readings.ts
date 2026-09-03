import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'

export interface ReadingPropertyOption {
  id: string
  reference: string
  name: string
  city: string | null
  water_rate: number
  electricity_rate: number
  /** Dernier index relevé : sert d'ancien index par défaut. */
  last_water_index: number
  last_elec_index: number
  last_period: string | null
}

/**
 * Biens proposés au relevé, avec leurs tarifs et le dernier index connu.
 * L'ancien index se pré-remplit ainsi tout seul, sans que le propriétaire
 * ait à retrouver le relevé précédent — tout en restant modifiable.
 */
export async function loadReadingOptions(): Promise<ReadingPropertyOption[]> {
  const supabase = await createClient()

  const [{ data: properties }, { data: readings }] = await Promise.all([
    supabase.from('properties')
      .select('id, reference, name, city, water_rate, electricity_rate')
      .order('reference'),
    supabase.from('meter_readings')
      .select('property_id, period_month, water_current_index, elec_current_index')
      .order('period_month', { ascending: false }),
  ])

  type Last = {
    property_id: string
    period_month: string
    water_current_index: number
    elec_current_index: number
  }

  // Les relevés arrivent du plus récent au plus ancien : le premier vu par
  // bien est donc le dernier en date.
  const lastByProperty = new Map<string, Last>()
  for (const r of rows<Last>(readings)) {
    if (!lastByProperty.has(r.property_id)) lastByProperty.set(r.property_id, r)
  }

  type Row = Omit<ReadingPropertyOption, 'last_water_index' | 'last_elec_index' | 'last_period'>

  return rows<Row>(properties).map((p) => {
    const last = lastByProperty.get(p.id)
    return {
      ...p,
      last_water_index: Number(last?.water_current_index ?? 0),
      last_elec_index: Number(last?.elec_current_index ?? 0),
      last_period: last?.period_month ?? null,
    }
  })
}
