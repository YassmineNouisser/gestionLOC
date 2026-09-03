'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Calculator } from 'lucide-react'
import {
  Field, FormError, FormGrid, FormSection, Input, MoneyInput, Select, SubmitButton, Textarea,
} from '@/components/ui/Form'
import { money, PROPERTY_TYPE } from '@/lib/format'
import type { ActionState } from '@/lib/actions/shared'
import type { Property } from '@/lib/types'

const TYPE_OPTIONS = Object.entries(PROPERTY_TYPE).map(([value, label]) => ({ value, label }))

export function PropertyForm({
  action, property, cancelHref,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  property?: Property
  cancelHref: string
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, { error: null })

  // Investissement total recalculé en direct pour donner un retour immédiat.
  const [price, setPrice] = useState(property?.purchase_price ?? 0)
  const [fees, setFees] = useState(property?.purchase_fees ?? 0)
  const [works, setWorks] = useState(property?.initial_works ?? 0)
  const total = Number(price || 0) + Number(fees || 0) + Number(works || 0)

  return (
    <form action={formAction} className="space-y-8">
      <FormError message={state.error} />

      <div className="card space-y-8 p-6">
        <FormSection title="Identification">
          <FormGrid>
            <Field label="Référence" name="reference" required hint="Identifiant unique, ex. BIEN-001">
              <Input name="reference" defaultValue={property?.reference} required maxLength={50} placeholder="BIEN-001" />
            </Field>
            <Field label="Nom du bien" name="name" required>
              <Input name="name" defaultValue={property?.name} required maxLength={120} placeholder="Appartement Lac 2" />
            </Field>
            <Field label="Adresse" name="address" className="sm:col-span-2">
              <Input name="address" defaultValue={property?.address ?? ''} placeholder="12 rue de la Paix, Résidence Yasmine" />
            </Field>
            <Field label="Ville" name="city">
              <Input name="city" defaultValue={property?.city ?? ''} placeholder="Tunis" />
            </Field>
            <Field label="Type de bien" name="type" required>
              <Select name="type" defaultValue={property?.type ?? 'appartement'} options={TYPE_OPTIONS} required />
            </Field>
            <Field label="Surface" name="surface" hint="En mètres carrés">
              <Input name="surface" type="number" step="0.01" min="0" inputMode="decimal"
                     defaultValue={property?.surface ?? ''} placeholder="85" />
            </Field>
            <Field label="Nombre de chambres" name="rooms">
              <Input name="rooms" type="number" step="1" min="0" inputMode="numeric"
                     defaultValue={property?.rooms ?? ''} placeholder="3" />
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection
          title="Investissement"
          description="L'investissement total est calculé automatiquement : prix d'achat + frais d'achat + travaux initiaux."
        >
          <FormGrid>
            <Field label="Prix d'achat" name="purchase_price">
              <MoneyInput name="purchase_price" defaultValue={property?.purchase_price ?? ''}
                          onChange={(e) => setPrice(Number(e.target.value))} placeholder="0" />
            </Field>
            <Field label="Date d'achat" name="purchase_date">
              <Input name="purchase_date" type="date" defaultValue={property?.purchase_date ?? ''} />
            </Field>
            <Field label="Frais d'achat" name="purchase_fees" hint="Notaire, enregistrement, agence…">
              <MoneyInput name="purchase_fees" defaultValue={property?.purchase_fees ?? ''}
                          onChange={(e) => setFees(Number(e.target.value))} placeholder="0" />
            </Field>
            <Field label="Travaux initiaux" name="initial_works">
              <MoneyInput name="initial_works" defaultValue={property?.initial_works ?? ''}
                          onChange={(e) => setWorks(Number(e.target.value))} placeholder="0" />
            </Field>
          </FormGrid>

          <div className="mt-5 flex items-center gap-3 rounded-xl bg-brand-50 px-5 py-4 ring-1 ring-inset ring-brand-100">
            <Calculator className="size-5 shrink-0 text-brand-600" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-brand-800">Investissement total</p>
              <p className="text-xl font-bold tabular-nums text-brand-900">{money(total)}</p>
            </div>
          </div>
        </FormSection>

        <FormSection title="Location" description="Montants de référence affichés sur la fiche du bien. Le loyer réellement facturé est celui du contrat.">
          <FormGrid>
            <Field label="Loyer mensuel" name="monthly_rent">
              <MoneyInput name="monthly_rent" defaultValue={property?.monthly_rent ?? ''} placeholder="0" />
            </Field>
            <Field label="Charges mensuelles" name="charges">
              <MoneyInput name="charges" defaultValue={property?.charges ?? ''} placeholder="0" />
            </Field>
            <Field label="Échéance de l'assurance" name="insurance_expiry"
                   hint="Une alerte apparaîtra 60 jours avant l'échéance.">
              <Input name="insurance_expiry" type="date" defaultValue={property?.insurance_expiry ?? ''} />
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection
          title="Tarifs des compteurs"
          description="Servent de valeurs par défaut lors d'un relevé d'eau ou d'électricité. Chaque relevé reste modifiable individuellement."
        >
          <FormGrid>
            <Field label="Tarif de l'eau" name="water_rate" hint="En dinars par mètre cube.">
              <MoneyInput name="water_rate" defaultValue={property?.water_rate ?? ''} placeholder="0" />
            </Field>
            <Field label="Tarif de l'électricité" name="electricity_rate" hint="En dinars par kilowattheure.">
              <MoneyInput name="electricity_rate" defaultValue={property?.electricity_rate ?? ''} placeholder="0" />
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection title="Notes">
          <Field label="Informations complémentaires" name="notes">
            <Textarea name="notes" defaultValue={property?.notes ?? ''} rows={4}
                      placeholder="Étage, ascenseur, orientation, particularités…" />
          </Field>
        </FormSection>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <Link href={cancelHref} className="btn-secondary">Annuler</Link>
        <SubmitButton>{property ? 'Enregistrer les modifications' : 'Créer le bien'}</SubmitButton>
      </div>
    </form>
  )
}
