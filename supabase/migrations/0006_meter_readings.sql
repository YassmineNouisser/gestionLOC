-- =============================================================================
-- RELEVÉS D'EAU ET D'ÉLECTRICITÉ
--
-- Tarifs portés par le bien (le compteur est physique), relevés portés par
-- le couple bien + mois. Le locataire est déduit du contrat actif à cette
-- période : il ne se saisit pas, il se constate.
--
-- Les quatre formules du cahier des charges sont des colonnes générées :
--   Consommation_eau  = Nouvel_index_eau  - Ancien_index_eau
--   Montant_eau       = Consommation_eau  × Tarif_m3
--   Consommation_elec = Nouvel_index_elec - Ancien_index_elec
--   Montant_elec      = Consommation_elec × Tarif_kWh
-- Elles ne peuvent donc jamais diverger de ce que montre l'interface.
-- =============================================================================

-- --------------------------------------------------------------------------
-- 1. Tarifs au niveau du bien
-- --------------------------------------------------------------------------
alter table public.properties
  add column if not exists water_rate       numeric(10,3) not null default 0,
  add column if not exists electricity_rate numeric(10,3) not null default 0;

comment on column public.properties.water_rate is 'Tarif de l''eau, en dinars par m³';
comment on column public.properties.electricity_rate is 'Tarif de l''électricité, en dinars par kWh';

-- --------------------------------------------------------------------------
-- 2. Relevés
-- --------------------------------------------------------------------------
create table if not exists public.meter_readings (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  contract_id   uuid references public.contracts(id) on delete set null,
  tenant_id     uuid references public.tenants(id)   on delete set null,

  period_month  date not null,
  reading_date  date not null default current_date,

  -- Eau
  water_previous_index numeric(12,3) not null default 0,
  water_current_index  numeric(12,3) not null default 0,
  water_rate           numeric(10,3) not null default 0,
  water_consumption    numeric(12,3) generated always as
                       (water_current_index - water_previous_index) stored,
  water_amount         numeric(14,3) generated always as
                       ((water_current_index - water_previous_index) * water_rate) stored,

  -- Électricité
  elec_previous_index  numeric(12,3) not null default 0,
  elec_current_index   numeric(12,3) not null default 0,
  elec_rate            numeric(10,3) not null default 0,
  elec_consumption     numeric(12,3) generated always as
                       (elec_current_index - elec_previous_index) stored,
  elec_amount          numeric(14,3) generated always as
                       ((elec_current_index - elec_previous_index) * elec_rate) stored,

  total_amount         numeric(14,3) generated always as
                       ((water_current_index - water_previous_index) * water_rate
                      + (elec_current_index - elec_previous_index) * elec_rate) stored,

  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint readings_period_is_first_day
    check (period_month = date_trunc('month', period_month)::date),
  -- Un index ne décroît pas : c'est une erreur de saisie, pas un cas métier.
  constraint readings_water_index_grows check (water_current_index >= water_previous_index),
  constraint readings_elec_index_grows  check (elec_current_index  >= elec_previous_index),
  constraint uq_reading_property_period unique (property_id, period_month)
);

create index if not exists idx_readings_property on public.meter_readings(property_id);
create index if not exists idx_readings_period   on public.meter_readings(period_month);
create index if not exists idx_readings_tenant   on public.meter_readings(tenant_id);

-- --------------------------------------------------------------------------
-- 3. Rattachement automatique au contrat en cours sur la période
-- --------------------------------------------------------------------------
create or replace function public.trg_reading_fill_occupant()
returns trigger language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select id, tenant_id into c
  from public.contracts
  where property_id = new.property_id
    and date_trunc('month', start_date) <= new.period_month
    and (end_date is null or date_trunc('month', end_date) >= new.period_month)
  order by (status = 'actif') desc, start_date desc
  limit 1;

  new.contract_id := c.id;
  new.tenant_id   := c.tenant_id;
  return new;
end $$;

drop trigger if exists trg_readings_fill_occupant on public.meter_readings;
create trigger trg_readings_fill_occupant
  before insert or update of property_id, period_month on public.meter_readings
  for each row execute function public.trg_reading_fill_occupant();

drop trigger if exists trg_touch_meter_readings on public.meter_readings;
create trigger trg_touch_meter_readings
  before update on public.meter_readings
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_audit_meter_readings on public.meter_readings;
create trigger trg_audit_meter_readings
  after insert or update or delete on public.meter_readings
  for each row execute function public.trg_audit();

-- --------------------------------------------------------------------------
-- 4. Vue d'affichage
-- --------------------------------------------------------------------------
create or replace view public.v_meter_readings
with (security_invoker = on) as
select
  r.*,
  p.reference    as property_reference,
  p.name         as property_name,
  p.city         as property_city,
  t.first_name   as tenant_first_name,
  t.last_name    as tenant_last_name
from public.meter_readings r
join public.properties p on p.id = r.property_id
left join public.tenants t on t.id = r.tenant_id;

-- --------------------------------------------------------------------------
-- 5. Sécurité : mêmes règles que les autres tables métier
-- --------------------------------------------------------------------------
alter table public.meter_readings enable row level security;

drop policy if exists "read_meter_readings"   on public.meter_readings;
drop policy if exists "insert_meter_readings" on public.meter_readings;
drop policy if exists "update_meter_readings" on public.meter_readings;
drop policy if exists "delete_meter_readings" on public.meter_readings;

create policy "read_meter_readings" on public.meter_readings
  for select to authenticated using (true);
create policy "insert_meter_readings" on public.meter_readings
  for insert to authenticated with check (public.can_write());
create policy "update_meter_readings" on public.meter_readings
  for update to authenticated using (public.can_write()) with check (public.can_write());
create policy "delete_meter_readings" on public.meter_readings
  for delete to authenticated using (public.can_write());
