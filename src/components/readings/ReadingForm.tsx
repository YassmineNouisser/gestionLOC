'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Droplets, Info, Zap } from 'lucide-react'
import {
  Field, FormError, FormGrid, FormSection, Input, Select, SubmitButton, Textarea,
} from '@/components/ui/Form'
import { firstOfMonth, money, monthLabel, num, todayISO } from '@/lib/format'
import type { ActionState } from '@/lib/actions/shared'
import type { ReadingPropertyOption } from '@/lib/data/readings'
import type { MeterReading } from '@/lib/types'

/** Champ d'index de compteur : entier ou décimal, jamais négatif. */
function IndexInput(props: React.InputHTMLAttributes<HTMLInputElement> & { unit: string }) {
  const { unit, ...rest } = props
  return (
    <div className="relative">
      <input
        type="number"
        step="0.001"
        min="0"
        inputMode="decimal"
        {...rest}
        id={rest.id ?? rest.name}
        className="field pr-16 tabular-nums"
      />
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-sm font-semibold text-ink-400">
        {unit}
      </span>
    </div>
  )
}

/** Bloc de résultat d'un fluide : consommation puis montant. */
function Computed({
  tone, consumption, unit, rate, amount,
}: {
  tone: 'water' | 'elec'
  consumption: number
  unit: string
  rate: number
  amount: number
}) {
  const styles = tone === 'water'
    ? 'bg-brand-50 ring-brand-100 text-brand-800'
    : 'bg-warn-50 ring-warn-100 text-warn-800'

  const invalid = consumption < 0

  return (
    <div className={`mt-4 rounded-xl px-5 py-4 ring-1 ring-inset ${invalid ? 'bg-bad-50 text-bad-800 ring-bad-100' : styles}`}>
      {invalid ? (
        <p className="text-sm font-semibold">
          Le nouvel index est inférieur à l&apos;ancien — vérifiez la saisie.
        </p>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Consommation</p>
            <p className="text-lg font-bold tabular-nums">
              {num(consumption, 3)} {unit}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
              × {num(rate, 3)} DT
            </p>
            <p className="text-xl font-bold tabular-nums">{money(amount)}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export function ReadingForm({
  action, reading, properties, defaultPropertyId, cancelHref,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  reading?: MeterReading
  properties: ReadingPropertyOption[]
  defaultPropertyId?: string
  cancelHref: string
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, { error: null })

  const initialId = reading?.property_id ?? defaultPropertyId ?? ''
  const [propertyId, setPropertyId] = useState(initialId)

  const n = (v: number | undefined) => (v === undefined ? '' : String(v))
  const [waterPrev, setWaterPrev] = useState(n(reading?.water_previous_index))
  const [waterCur, setWaterCur] = useState(n(reading?.water_current_index))
  const [waterRate, setWaterRate] = useState(n(reading?.water_rate))
  const [elecPrev, setElecPrev] = useState(n(reading?.elec_previous_index))
  const [elecCur, setElecCur] = useState(n(reading?.elec_current_index))
  const [elecRate, setElecRate] = useState(n(reading?.elec_rate))

  const selected = properties.find((p) => p.id === propertyId)

  /** Choisir un bien reprend ses tarifs et son dernier index connu. */
  function onPropertyChange(id: string) {
    setPropertyId(id)
    if (reading) return
    const p = properties.find((x) => x.id === id)
    if (!p) return
    setWaterRate(p.water_rate ? String(p.water_rate) : '')
    setElecRate(p.electricity_rate ? String(p.electricity_rate) : '')
    setWaterPrev(String(p.last_water_index))
    setElecPrev(String(p.last_elec_index))
    setWaterCur('')
    setElecCur('')
  }

  // Les quatre formules du cahier des charges, appliquées à la saisie en cours.
  // La base les recalcule à l'enregistrement : cet aperçu ne fait jamais foi.
  const waterConsumption = Number(waterCur || 0) - Number(waterPrev || 0)
  const waterAmount = waterConsumption * Number(waterRate || 0)
  const elecConsumption = Number(elecCur || 0) - Number(elecPrev || 0)
  const elecAmount = elecConsumption * Number(elecRate || 0)
  const total = (waterConsumption < 0 ? 0 : waterAmount) + (elecConsumption < 0 ? 0 : elecAmount)

  return (
    <form action={formAction} className="space-y-8">
      <FormError message={state.error} />

      <div className="card space-y-8 p-6">
        <FormSection title="Bien et période">
          <FormGrid>
            <Field label="Bien" name="property_id" required>
              <Select
                name="property_id"
                value={propertyId}
                onChange={(e) => onPropertyChange(e.target.value)}
                options={properties.map((p) => ({
                  value: p.id,
                  label: `${p.reference} — ${p.name}${p.city ? ` (${p.city})` : ''}`,
                }))}
                placeholder="Sélectionner un bien…"
                required
              />
            </Field>
            <Field label="Mois concerné" name="period_month" required
                   hint="Le locataire est déduit du contrat en cours sur ce mois.">
              <Input
                name="period_month"
                type="date"
                defaultValue={reading?.period_month ?? firstOfMonth()}
                required
              />
            </Field>
            <Field label="Date du relevé" name="reading_date" required>
              <Input name="reading_date" type="date" defaultValue={reading?.reading_date ?? todayISO()} required />
            </Field>
          </FormGrid>

          {selected && selected.last_period && !reading && (
            <p className="mt-4 flex items-start gap-2.5 rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600">
              <Info className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
              <span>
                Dernier relevé de ce bien : {monthLabel(selected.last_period)} — eau{' '}
                {num(selected.last_water_index, 3)} m³, électricité{' '}
                {num(selected.last_elec_index, 3)} kWh. Ces valeurs sont reprises
                comme anciens index, vous pouvez les corriger.
              </span>
            </p>
          )}
        </FormSection>

        {/* Eau */}
        <FormSection title="Eau" description="Consommation = nouvel index − ancien index. Montant = consommation × tarif au m³.">
          <FormGrid>
            <Field label="Ancien index" name="water_previous_index" required>
              <IndexInput name="water_previous_index" unit="m³" value={waterPrev}
                          onChange={(e) => setWaterPrev(e.target.value)} required />
            </Field>
            <Field label="Nouvel index" name="water_current_index" required>
              <IndexInput name="water_current_index" unit="m³" value={waterCur}
                          onChange={(e) => setWaterCur(e.target.value)} required />
            </Field>
            <Field label="Tarif au m³" name="water_rate" required
                   hint="Repris du bien, modifiable pour ce relevé.">
              <IndexInput name="water_rate" unit="DT" value={waterRate}
                          onChange={(e) => setWaterRate(e.target.value)} required />
            </Field>
          </FormGrid>
          <Computed tone="water" consumption={waterConsumption} unit="m³"
                    rate={Number(waterRate || 0)} amount={waterAmount} />
        </FormSection>

        {/* Électricité */}
        <FormSection title="Électricité" description="Consommation = nouvel index − ancien index. Montant = consommation × tarif au kWh.">
          <FormGrid>
            <Field label="Ancien index" name="elec_previous_index" required>
              <IndexInput name="elec_previous_index" unit="kWh" value={elecPrev}
                          onChange={(e) => setElecPrev(e.target.value)} required />
            </Field>
            <Field label="Nouvel index" name="elec_current_index" required>
              <IndexInput name="elec_current_index" unit="kWh" value={elecCur}
                          onChange={(e) => setElecCur(e.target.value)} required />
            </Field>
            <Field label="Tarif au kWh" name="elec_rate" required
                   hint="Repris du bien, modifiable pour ce relevé.">
              <IndexInput name="elec_rate" unit="DT" value={elecRate}
                          onChange={(e) => setElecRate(e.target.value)} required />
            </Field>
          </FormGrid>
          <Computed tone="elec" consumption={elecConsumption} unit="kWh"
                    rate={Number(elecRate || 0)} amount={elecAmount} />
        </FormSection>

        <FormSection title="Notes">
          <Field label="Observations" name="notes">
            <Textarea name="notes" defaultValue={reading?.notes ?? ''} rows={3}
                      placeholder="Compteur remplacé, relevé estimé, anomalie constatée…" />
          </Field>
        </FormSection>
      </div>

      {/* Total à facturer */}
      <div className="card overflow-hidden">
        <span className="block h-1 bg-gradient-to-r from-brand-600 via-brand-500 to-gold-400" aria-hidden />
        <div className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="section-title mb-1">Total à facturer au locataire</p>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
              <span className="flex items-center gap-1.5">
                <Droplets className="size-4 text-brand-500" aria-hidden />
                Eau {money(waterConsumption < 0 ? 0 : waterAmount)}
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="size-4 text-warn-600" aria-hidden />
                Électricité {money(elecConsumption < 0 ? 0 : elecAmount)}
              </span>
            </p>
          </div>
          <p className="font-display text-[2.1rem] leading-none text-ink-900">{money(total)}</p>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <Link href={cancelHref} className="btn-secondary">Annuler</Link>
        <SubmitButton>{reading ? 'Enregistrer les modifications' : 'Enregistrer le relevé'}</SubmitButton>
      </div>
    </form>
  )
}
