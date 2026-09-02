import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/rows'
import type { PropertyOption, TenantOption } from '@/components/contracts/ContractForm'

/** Biens et locataires disponibles pour un formulaire de contrat. */
export async function loadContractOptions() {
  const supabase = await createClient()

  const [{ data: properties }, { data: tenants }, { data: activeContracts }] = await Promise.all([
    supabase.from('properties')
      .select('id, reference, name, city, monthly_rent, charges').order('reference'),
    supabase.from('tenants')
      .select('id, first_name, last_name, cin').order('last_name').order('first_name'),
    supabase.from('contracts').select('property_id').eq('status', 'actif'),
  ])

  const busy = new Set(rows<{ property_id: string }>(activeContracts).map((c) => c.property_id))

  return {
    properties: rows<Omit<PropertyOption, 'available'>>(properties).map((p) => ({
      ...p,
      available: !busy.has(p.id),
    })) as PropertyOption[],
    tenants: rows<TenantOption>(tenants),
  }
}
