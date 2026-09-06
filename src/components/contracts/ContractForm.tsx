'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'
import {
  Field, FormError, FormGrid, FormSection, Input, MoneyInput, Select, SubmitButton, Textarea,
} from '@/components/ui/Form'
import { CONTRACT_STATUS, money } from '@/lib/format'
import type { ActionState } from '@/lib/actions/shared'
import type { Contract } from '@/lib/types'

export interface PropertyOption {
  id: string
  reference: string
  name: string
  city: string | null
  monthly_rent: number
  charges: number
  available: boolean
}

export interface TenantOption {
  id: string
  first_name: string
  last_name: string
  cin: string | null
}

export function ContractForm({
  action, contract, properties, tenants, cancelHref,
  defaultPropertyId, defaultTenantId,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  contract?: Contract
  properties: PropertyOption[]
  tenants: TenantOption[]
  cancelHref: string
  defaultPropertyId?: string
  defaultTenantId?: string
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, { error: null })

  const [propertyId, setPropertyId] = useState(
    contract?.property_id ?? defaultPropertyId ?? '',
  )
  const [rent, setRent] = useState<string>(
    contract ? String(contract.monthly_rent) : '',
  )
  const [charges, setCharges] = useState<string>(
    contract ? String(contract.charges) : '',
  )

  const selected = properties.find((p) => p.id === propertyId)

  /** Sélectionner un bien pré-remplit le loyer et les charges de référence. */
  function onPropertyChange(id: string) {
    setPropertyId(id)
    const p = properties.find((x) => x.id === id)
    if (p && !contract) {
      setRent(p.monthly_rent ? String(p.monthly_rent) : '')
      setCharges(p.charges ? String(p.charges) : '')
    }
  }

  const propertyOptions = properties
    .filter((p) => p.available || p.id === contract?.property_id || p.id === propertyId)
    .map((p) => ({
      value: p.id,
      label: `${p.reference} — ${p.name}${p.city ? ` (${p.city})` : ''}${p.available ? '' : ' · déjà loué'}`,
    }))

  const tenantOptions = tenants.map((t) => ({
    value: t.id,
    label: `${t.last_name} ${t.first_name}${t.cin ? ` — CIN ${t.cin}` : ''}`,
  }))

  return (
    <form action={formAction} className="space-y-8">
      <FormError message={state.error} />

      <div className="card space-y-8 p-6">
        <FormSection title="Bien et locataire">
          <FormGrid>
            <Field label="Bien" name="property_id" required>
              <Select
                name="property_id"
                value={propertyId}
                onChange={(e) => onPropertyChange(e.target.value)}
                options={propertyOptions}
                placeholder="Sélectionner un bien…"
                required
              />
            </Field>
            <Field label="Locataire" name="tenant_id" required>
              <Select
                name="tenant_id"
                defaultValue={contract?.tenant_id ?? defaultTenantId ?? ''}
                options={tenantOptions}
                placeholder="Sélectionner un locataire…"
                required
              />
            </Field>
          </FormGrid>

          {selected && (
            <p className="mt-4 flex items-start gap-2.5 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800 ring-1 ring-inset ring-brand-100">
              <Info className="mt-0.5 size-4.5 shrink-0" aria-hidden />
              <span>
                Loyer de référence du bien : <strong>{money(selected.monthly_rent)}</strong>
                {selected.charges > 0 && <> + <strong>{money(selected.charges)}</strong> de charges</>}.
                Vous pouvez ajuster les montants ci-dessous : le contrat fait foi pour la facturation.
              </span>
            </p>
          )}
        </FormSection>

        <FormSection
          title="Durée et montants"
          description="Les loyers mensuels sont générés automatiquement à partir de la date de début."
        >
          <FormGrid>
            <Field label="Date de début" name="start_date" required>
              <Input name="start_date" type="date" defaultValue={contract?.start_date ?? ''} required />
            </Field>
            <Field label="Date de fin" name="end_date" hint="Laissez vide pour une durée indéterminée.">
              <Input name="end_date" type="date" defaultValue={contract?.end_date ?? ''} />
            </Field>
            <Field label="Loyer mensuel" name="monthly_rent" required>
              <MoneyInput name="monthly_rent" value={rent} onChange={(e) => setRent(e.target.value)} required />
            </Field>
            <Field label="Charges mensuelles" name="charges"
                   hint="Uniquement les charges fixes, ajoutées au loyer chaque mois. Laissez vide si elles varient : elles se refacturent alors par les relevés d'eau et d'électricité.">
              <MoneyInput name="charges" value={charges} onChange={(e) => setCharges(e.target.value)}
                          placeholder="Aucune" />
            </Field>
            <Field label="Caution" name="deposit">
              <MoneyInput name="deposit" defaultValue={contract?.deposit ?? ''} />
            </Field>
            <Field label="Jour d'échéance" name="due_day" required
                   hint="Jour du mois où le loyer devient exigible (1 à 31).">
              <Input name="due_day" type="number" min="1" max="31" step="1" inputMode="numeric"
                     defaultValue={contract?.due_day ?? 5} required />
            </Field>
          </FormGrid>

          <div className="mt-5 rounded-xl bg-ink-50 px-5 py-4">
            <p className="text-sm font-semibold text-ink-600">Montant dû chaque mois</p>
            <p className="text-xl font-bold tabular-nums text-ink-900">
              {money(Number(rent || 0) + Number(charges || 0))}
            </p>
          </div>
        </FormSection>

        <FormSection title="Statut et conditions">
          <FormGrid>
            <Field label="Statut du contrat" name="status" required
                   hint="Un contrat actif marque le bien comme loué.">
              <Select
                name="status"
                defaultValue={contract?.status ?? 'actif'}
                options={Object.entries(CONTRACT_STATUS).map(([value, label]) => ({ value, label }))}
                required
              />
            </Field>
            <Field label="Conditions particulières" name="conditions" className="sm:col-span-2">
              <Textarea name="conditions" defaultValue={contract?.conditions ?? ''} rows={3}
                        placeholder="Dépôt de garantie, clause de révision, entretien…" />
            </Field>
            <Field label="Notes internes" name="notes" className="sm:col-span-2">
              <Textarea name="notes" defaultValue={contract?.notes ?? ''} rows={3} />
            </Field>
          </FormGrid>
        </FormSection>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <Link href={cancelHref} className="btn-secondary">Annuler</Link>
        <SubmitButton>{contract ? 'Enregistrer les modifications' : 'Créer le contrat'}</SubmitButton>
      </div>
    </form>
  )
}
