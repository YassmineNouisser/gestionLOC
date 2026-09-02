-- =============================================================================
-- GESTION LOCATIVE - Schéma initial
-- Postgres / Supabase
-- Toute la logique financière (restes, statuts, rentabilité) vit dans la base :
-- colonnes générées + triggers + vues. Le front ne fait aucun calcul métier.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. PROFILS / RÔLES
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'proprietaire'
              check (role in ('proprietaire','gestionnaire','lecteur')),
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'Utilisateurs de l''application (1 propriétaire en V1)';

-- Crée automatiquement le profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'proprietaire')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper : l'utilisateur courant peut-il écrire ?
create or replace function public.can_write()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('proprietaire','gestionnaire')
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. BIENS
-- ---------------------------------------------------------------------------
create table if not exists public.properties (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique,
  name              text not null,
  address           text,
  city              text,
  type              text not null default 'appartement'
                    check (type in ('appartement','maison','studio','villa','local_commercial','bureau','terrain','garage','autre')),
  surface           numeric(10,2),
  rooms             integer,
  purchase_price    numeric(14,3) not null default 0,
  purchase_date     date,
  purchase_fees     numeric(14,3) not null default 0,
  initial_works     numeric(14,3) not null default 0,
  -- Investissement total = Prix d'achat + Frais d'achat + Travaux initiaux
  total_investment  numeric(14,3) generated always as
                    (coalesce(purchase_price,0) + coalesce(purchase_fees,0) + coalesce(initial_works,0)) stored,
  monthly_rent      numeric(14,3) not null default 0,
  charges           numeric(14,3) not null default 0,
  status            text not null default 'libre'
                    check (status in ('libre','loue','maintenance')),
  insurance_expiry  date,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_properties_status on public.properties(status);
create index if not exists idx_properties_city   on public.properties(city);

-- ---------------------------------------------------------------------------
-- 3. LOCATAIRES
-- ---------------------------------------------------------------------------
create table if not exists public.tenants (
  id                       uuid primary key default gen_random_uuid(),
  first_name               text not null,
  last_name                text not null,
  cin                      text unique,
  phone                    text,
  email                    text,
  address                  text,
  profession               text,
  emergency_contact_name   text,
  emergency_contact_phone  text,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_tenants_name on public.tenants(last_name, first_name);
create index if not exists idx_tenants_cin  on public.tenants(cin);

-- ---------------------------------------------------------------------------
-- 4. CONTRATS  (bien <-> locataire)
-- ---------------------------------------------------------------------------
create table if not exists public.contracts (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete restrict,
  tenant_id     uuid not null references public.tenants(id)    on delete restrict,
  start_date    date not null,
  end_date      date,
  monthly_rent  numeric(14,3) not null default 0,
  deposit       numeric(14,3) not null default 0,
  due_day       integer not null default 5 check (due_day between 1 and 31),
  charges       numeric(14,3) not null default 0,
  conditions    text,
  status        text not null default 'actif'
                check (status in ('actif','termine','resilie')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint contracts_dates_check check (end_date is null or end_date >= start_date),
  -- un contrat non actif doit être borné dans le temps
  constraint contracts_closed_needs_end check (status = 'actif' or end_date is not null)
);

-- Un seul contrat ACTIF par bien
create unique index if not exists uq_contract_active_per_property
  on public.contracts(property_id) where (status = 'actif');

create index if not exists idx_contracts_property on public.contracts(property_id);
create index if not exists idx_contracts_tenant   on public.contracts(tenant_id);
create index if not exists idx_contracts_status   on public.contracts(status);

-- ---------------------------------------------------------------------------
-- 5. LOYERS MENSUELS (générés automatiquement)
-- ---------------------------------------------------------------------------
create table if not exists public.rents (
  id            uuid primary key default gen_random_uuid(),
  contract_id   uuid not null references public.contracts(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id)    on delete cascade,
  period_month  date not null,                       -- toujours le 1er du mois
  amount_due    numeric(14,3) not null default 0,    -- loyer + charges
  amount_paid   numeric(14,3) not null default 0,    -- maintenu par trigger
  due_date      date not null,
  created_at    timestamptz not null default now(),
  constraint rents_period_is_first_day check (period_month = date_trunc('month', period_month)::date),
  constraint uq_rent_contract_period unique (contract_id, period_month)
);

create index if not exists idx_rents_period   on public.rents(period_month);
create index if not exists idx_rents_property on public.rents(property_id);
create index if not exists idx_rents_tenant   on public.rents(tenant_id);
create index if not exists idx_rents_due_date on public.rents(due_date);

-- ---------------------------------------------------------------------------
-- 6. PAIEMENTS
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  rent_id       uuid not null references public.rents(id) on delete cascade,
  contract_id   uuid not null references public.contracts(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id)    on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  amount        numeric(14,3) not null check (amount > 0),
  payment_date  date not null default current_date,
  method        text not null default 'especes'
                check (method in ('especes','virement','cheque','autre')),
  reference     text,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_payments_rent     on public.payments(rent_id);
create index if not exists idx_payments_property on public.payments(property_id);
create index if not exists idx_payments_tenant   on public.payments(tenant_id);
create index if not exists idx_payments_date     on public.payments(payment_date);

-- ---------------------------------------------------------------------------
-- 7. DÉPENSES
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  category      text not null default 'autres'
                check (category in ('reparation','entretien','travaux','assurance','eau','electricite','syndic','taxes','autres')),
  amount        numeric(14,3) not null check (amount >= 0),
  expense_date  date not null default current_date,
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_expenses_property on public.expenses(property_id);
create index if not exists idx_expenses_date     on public.expenses(expense_date);
create index if not exists idx_expenses_category on public.expenses(category);

-- ---------------------------------------------------------------------------
-- 8. DOCUMENTS (polymorphe : bien / locataire / contrat / paiement / dépense)
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null check (entity_type in ('property','tenant','contract','payment','expense')),
  entity_id    uuid not null,
  doc_type     text not null default 'autre'
               check (doc_type in ('contrat','cin','facture','recu','photo','administratif','autre')),
  name         text not null,
  storage_path text not null,
  mime_type    text,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);

create index if not exists idx_documents_entity on public.documents(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- 9. NOTIFICATIONS LUES (les notifications elles-mêmes sont calculées en vue)
-- ---------------------------------------------------------------------------
create table if not exists public.notification_dismissals (
  id              uuid primary key default gen_random_uuid(),
  notification_key text not null,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dismissed_at    timestamptz not null default now(),
  constraint uq_dismissal unique (notification_key, user_id)
);

-- ---------------------------------------------------------------------------
-- 10. HISTORIQUE DES MODIFICATIONS
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigserial primary key,
  table_name  text not null,
  row_id      uuid,
  action      text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  user_id     uuid,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_created on public.audit_log(created_at desc);
create index if not exists idx_audit_table   on public.audit_log(table_name, row_id);
