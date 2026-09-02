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
-- =============================================================================
-- AUTOMATISATION : triggers & fonctions métier
-- =============================================================================

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['properties','tenants','contracts','expenses'] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$s
                    for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Échéance d'un mois donné : jour d'échéance borné au nombre de jours du mois
-- ---------------------------------------------------------------------------
create or replace function public.compute_due_date(p_period date, p_due_day int)
returns date
language sql
immutable
as $$
  select (date_trunc('month', p_period)
          + make_interval(days => least(
              greatest(coalesce(p_due_day, 5), 1),
              extract(day from (date_trunc('month', p_period) + interval '1 month - 1 day'))::int
            ) - 1))::date;
$$;

-- ---------------------------------------------------------------------------
-- GÉNÉRATION AUTOMATIQUE DES LOYERS
-- Insère les loyers manquants pour tous les contrats, de leur date de début
-- jusqu'au mois courant (ou leur date de fin). Idempotent.
-- ---------------------------------------------------------------------------
create or replace function public.generate_rents(p_contract_id uuid default null)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare v_count integer;
begin
  insert into public.rents (contract_id, property_id, tenant_id, period_month, amount_due, due_date)
  select c.id,
         c.property_id,
         c.tenant_id,
         m::date,
         c.monthly_rent + coalesce(c.charges, 0),
         public.compute_due_date(m::date, c.due_day)
  from public.contracts c
  cross join lateral generate_series(
      date_trunc('month', c.start_date),
      date_trunc('month', least(coalesce(c.end_date, current_date), current_date)),
      interval '1 month'
  ) as m
  where (p_contract_id is null or c.id = p_contract_id)
    and date_trunc('month', c.start_date) <= date_trunc('month', current_date)
  on conflict (contract_id, period_month) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

comment on function public.generate_rents is
  'Génère les loyers mensuels manquants. Idempotent : peut être appelée à chaque chargement.';

-- Génère les loyers dès la création / réactivation d'un contrat
create or replace function public.trg_contract_generate_rents()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.generate_rents(new.id);
  return null;
end $$;

drop trigger if exists trg_contracts_generate_rents on public.contracts;
create trigger trg_contracts_generate_rents
  after insert or update of start_date, end_date, status, monthly_rent, charges, due_day
  on public.contracts
  for each row execute function public.trg_contract_generate_rents();

-- ---------------------------------------------------------------------------
-- STATUT DU BIEN piloté par les contrats
-- Loué s'il existe un contrat actif, sinon Libre (on ne touche pas à Maintenance)
-- ---------------------------------------------------------------------------
create or replace function public.sync_property_status(p_property_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare v_has_active boolean;
begin
  select exists (
    select 1 from public.contracts
    where property_id = p_property_id and status = 'actif'
  ) into v_has_active;

  update public.properties p
  set status = case
                 when v_has_active then 'loue'
                 when p.status = 'maintenance' then 'maintenance'
                 else 'libre'
               end
  where p.id = p_property_id
    and p.status is distinct from (case
                 when v_has_active then 'loue'
                 when p.status = 'maintenance' then 'maintenance'
                 else 'libre'
               end);
end $$;

create or replace function public.trg_contract_sync_property()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_property_status(old.property_id);
    return old;
  end if;
  perform public.sync_property_status(new.property_id);
  if tg_op = 'UPDATE' and old.property_id is distinct from new.property_id then
    perform public.sync_property_status(old.property_id);
  end if;
  return new;
end $$;

drop trigger if exists trg_contracts_sync_property on public.contracts;
create trigger trg_contracts_sync_property
  after insert or update or delete on public.contracts
  for each row execute function public.trg_contract_sync_property();

-- ---------------------------------------------------------------------------
-- AGRÉGATION DES PAIEMENTS -> loyer
-- amount_paid = somme de tous les paiements du mois concerné
-- (le statut et le reste sont calculés dans la vue v_rents)
-- ---------------------------------------------------------------------------
create or replace function public.recalc_rent(p_rent_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.rents r
  set amount_paid = coalesce((
        select sum(p.amount) from public.payments p where p.rent_id = r.id
      ), 0)
  where r.id = p_rent_id;
end $$;

create or replace function public.trg_payment_recalc()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    perform public.recalc_rent(old.rent_id);
  end if;
  if tg_op in ('INSERT','UPDATE') then
    perform public.recalc_rent(new.rent_id);
    return new;
  end if;
  return old;
end $$;

drop trigger if exists trg_payments_recalc on public.payments;
create trigger trg_payments_recalc
  after insert or update or delete on public.payments
  for each row execute function public.trg_payment_recalc();

-- Cohérence : un paiement hérite toujours du contrat/bien/locataire de son loyer
create or replace function public.trg_payment_fill_refs()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select contract_id, property_id, tenant_id into r
  from public.rents where id = new.rent_id;

  if not found then
    raise exception 'Loyer introuvable (rent_id=%)', new.rent_id;
  end if;

  new.contract_id := r.contract_id;
  new.property_id := r.property_id;
  new.tenant_id   := r.tenant_id;
  return new;
end $$;

drop trigger if exists trg_payments_fill_refs on public.payments;
create trigger trg_payments_fill_refs
  before insert or update of rent_id on public.payments
  for each row execute function public.trg_payment_fill_refs();

-- Le montant dû suit le contrat tant que le loyer n'a reçu aucun paiement
create or replace function public.trg_contract_sync_future_rents()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.monthly_rent is distinct from old.monthly_rent
     or new.charges is distinct from old.charges
     or new.due_day is distinct from old.due_day then
    update public.rents r
    set amount_due = new.monthly_rent + coalesce(new.charges, 0),
        due_date   = public.compute_due_date(r.period_month, new.due_day)
    where r.contract_id = new.id
      and r.amount_paid = 0
      and r.period_month >= date_trunc('month', current_date)::date;
  end if;
  return null;
end $$;

drop trigger if exists trg_contracts_sync_future_rents on public.contracts;
create trigger trg_contracts_sync_future_rents
  after update on public.contracts
  for each row execute function public.trg_contract_sync_future_rents();

-- ---------------------------------------------------------------------------
-- HISTORIQUE DES MODIFICATIONS
-- ---------------------------------------------------------------------------
create or replace function public.trg_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (table_name, row_id, action, old_data, new_data, user_id)
  values (
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['properties','tenants','contracts','payments','expenses'] loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$s', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$s
                    for each row execute function public.trg_audit()', t);
  end loop;
end $$;
-- =============================================================================
-- VUES DE CALCUL : loyers, rentabilité, dashboard, rapports, notifications
-- security_invoker => les vues respectent le RLS des tables sous-jacentes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- v_rents : loyer enrichi (reste, statut, retard) + infos bien/locataire
--   Reste  = Montant dû - Total des paiements
--   Statut : Payé / Partiel / Impayé / À payer
-- ---------------------------------------------------------------------------
create or replace view public.v_rents
with (security_invoker = on) as
select
  r.id,
  r.contract_id,
  r.property_id,
  r.tenant_id,
  r.period_month,
  r.amount_due,
  r.amount_paid,
  greatest(r.amount_due - r.amount_paid, 0)          as balance,
  (r.amount_due - r.amount_paid)                     as raw_balance,
  r.due_date,
  case
    when r.amount_due <= 0                then 'paye'
    when r.amount_paid >= r.amount_due    then 'paye'
    when r.amount_paid > 0                then 'partiel'
    when r.due_date < current_date        then 'impaye'
    else 'a_payer'
  end                                                as status,
  (r.amount_paid < r.amount_due and r.due_date < current_date) as is_overdue,
  case when r.amount_paid < r.amount_due and r.due_date < current_date
       then (current_date - r.due_date) else 0 end   as days_overdue,
  p.reference    as property_reference,
  p.name         as property_name,
  p.city         as property_city,
  t.first_name   as tenant_first_name,
  t.last_name    as tenant_last_name,
  t.phone        as tenant_phone,
  t.cin          as tenant_cin,
  c.status       as contract_status
from public.rents r
join public.properties p on p.id = r.property_id
join public.tenants    t on t.id = r.tenant_id
join public.contracts  c on c.id = r.contract_id;

-- ---------------------------------------------------------------------------
-- v_property_stats : rentabilité par bien
--   Revenus     = loyers encaissés
--   Dépenses    = dépenses du bien
--   Revenu net  = Revenus - Dépenses
--   Rentabilité = Revenu net annuel / Investissement total * 100
-- ---------------------------------------------------------------------------
create or replace view public.v_property_stats
with (security_invoker = on) as
with revenus as (
  select property_id,
         sum(amount_paid)                                                   as total_revenus,
         sum(amount_due)                                                    as total_du,
         sum(case when period_month >= (date_trunc('month', current_date) - interval '11 months')::date
                  then amount_paid else 0 end)                              as revenus_12m,
         sum(case when amount_paid < amount_due and due_date < current_date
                  then amount_due - amount_paid else 0 end)                 as total_impayes
  from public.rents
  group by property_id
),
depenses as (
  select property_id,
         sum(amount)                                                        as total_depenses,
         sum(case when expense_date >= (date_trunc('month', current_date) - interval '11 months')::date
                  then amount else 0 end)                                   as depenses_12m
  from public.expenses
  group by property_id
)
select
  p.id                                            as property_id,
  p.reference,
  p.name,
  p.city,
  p.type,
  p.status,
  p.surface,
  p.monthly_rent,
  p.charges,
  p.total_investment,
  coalesce(rv.total_revenus, 0)                   as total_revenus,
  coalesce(rv.total_du, 0)                        as total_du,
  coalesce(rv.total_impayes, 0)                   as total_impayes,
  coalesce(dp.total_depenses, 0)                  as total_depenses,
  coalesce(rv.total_revenus, 0) - coalesce(dp.total_depenses, 0)   as revenu_net,
  coalesce(rv.revenus_12m, 0)                     as revenus_12m,
  coalesce(dp.depenses_12m, 0)                    as depenses_12m,
  coalesce(rv.revenus_12m, 0) - coalesce(dp.depenses_12m, 0)       as revenu_net_12m,
  -- Rentabilité nette sur 12 mois glissants
  case when p.total_investment > 0
       then round(((coalesce(rv.revenus_12m, 0) - coalesce(dp.depenses_12m, 0))
                   / p.total_investment * 100)::numeric, 2)
       else null end                              as rentabilite_nette,
  -- Rentabilité brute théorique (loyer affiché x 12)
  case when p.total_investment > 0
       then round(((p.monthly_rent * 12) / p.total_investment * 100)::numeric, 2)
       else null end                              as rentabilite_brute
from public.properties p
left join revenus  rv on rv.property_id = p.id
left join depenses dp on dp.property_id = p.id;

-- ---------------------------------------------------------------------------
-- v_monthly_summary : synthèse par mois (base = mois du loyer / de la dépense)
-- ---------------------------------------------------------------------------
create or replace view public.v_monthly_summary
with (security_invoker = on) as
with mois as (
  select period_month as m from public.rents
  union
  select date_trunc('month', expense_date)::date from public.expenses
),
loyers as (
  select period_month as m,
         sum(amount_due)                                             as loyers_prevus,
         sum(amount_paid)                                            as loyers_encaisses,
         sum(greatest(amount_due - amount_paid, 0))                  as montant_restant,
         sum(case when amount_paid < amount_due and due_date < current_date
                  then amount_due - amount_paid else 0 end)          as impayes,
         count(*)                                                    as nb_loyers
  from public.rents group by period_month
),
depenses as (
  select date_trunc('month', expense_date)::date as m,
         sum(amount) as depenses
  from public.expenses group by 1
)
select
  mois.m                                    as period_month,
  coalesce(l.loyers_prevus, 0)              as loyers_prevus,
  coalesce(l.loyers_encaisses, 0)           as loyers_encaisses,
  coalesce(l.montant_restant, 0)            as montant_restant,
  coalesce(l.impayes, 0)                    as impayes,
  coalesce(l.nb_loyers, 0)                  as nb_loyers,
  coalesce(d.depenses, 0)                   as depenses,
  coalesce(l.loyers_encaisses, 0) - coalesce(d.depenses, 0) as revenu_net
from mois
left join loyers   l on l.m = mois.m
left join depenses d on d.m = mois.m
order by 1;

-- ---------------------------------------------------------------------------
-- v_dashboard : une seule ligne, tous les indicateurs du tableau de bord
-- ---------------------------------------------------------------------------
create or replace view public.v_dashboard
with (security_invoker = on) as
select
  (select count(*) from public.properties)                                    as nb_biens,
  (select count(*) from public.properties where status = 'loue')              as nb_biens_loues,
  (select count(*) from public.properties where status = 'libre')             as nb_biens_libres,
  (select count(*) from public.properties where status = 'maintenance')       as nb_biens_maintenance,
  (select count(*) from public.tenants)                                       as nb_locataires,
  (select count(*) from public.contracts where status = 'actif')              as nb_contrats_actifs,
  (select coalesce(sum(amount_due),0) from public.rents
     where period_month = date_trunc('month', current_date)::date)            as loyers_prevus_mois,
  (select coalesce(sum(amount_paid),0) from public.rents
     where period_month = date_trunc('month', current_date)::date)            as loyers_encaisses_mois,
  (select coalesce(sum(greatest(amount_due - amount_paid,0)),0) from public.rents
     where period_month = date_trunc('month', current_date)::date)            as montant_restant_mois,
  (select coalesce(sum(amount_due - amount_paid),0) from public.rents
     where amount_paid < amount_due and due_date < current_date)              as total_impayes,
  (select count(*) from public.rents
     where amount_paid < amount_due and due_date < current_date)              as nb_impayes,
  (select coalesce(sum(amount),0) from public.expenses
     where date_trunc('month', expense_date) = date_trunc('month', current_date)) as depenses_mois,
  (select coalesce(sum(amount_paid),0) from public.rents
     where period_month = date_trunc('month', current_date)::date)
  - (select coalesce(sum(amount),0) from public.expenses
     where date_trunc('month', expense_date) = date_trunc('month', current_date)) as revenu_net_mois,
  (select coalesce(sum(total_investment),0) from public.properties)           as investissement_total,
  (select coalesce(sum(revenus_12m - depenses_12m),0) from public.v_property_stats) as revenu_net_12m,
  case when (select coalesce(sum(total_investment),0) from public.properties) > 0
       then round((
              (select coalesce(sum(revenus_12m - depenses_12m),0) from public.v_property_stats)
              / (select sum(total_investment) from public.properties) * 100)::numeric, 2)
       else null end                                                          as rentabilite_globale;

-- ---------------------------------------------------------------------------
-- v_tenant_stats : situation financière d'un locataire
-- ---------------------------------------------------------------------------
create or replace view public.v_tenant_stats
with (security_invoker = on) as
select
  t.id                                                       as tenant_id,
  coalesce(sum(r.amount_due), 0)                             as total_du,
  coalesce(sum(r.amount_paid), 0)                            as total_paye,
  coalesce(sum(greatest(r.amount_due - r.amount_paid, 0)), 0) as total_restant,
  coalesce(sum(case when r.amount_paid < r.amount_due and r.due_date < current_date
                    then r.amount_due - r.amount_paid else 0 end), 0) as total_impayes,
  count(r.id) filter (where r.amount_paid < r.amount_due and r.due_date < current_date) as nb_impayes
from public.tenants t
left join public.rents r on r.tenant_id = t.id
group by t.id;

-- ---------------------------------------------------------------------------
-- v_notifications : alertes calculées en temps réel
-- ---------------------------------------------------------------------------
create or replace view public.v_notifications
with (security_invoker = on) as
-- Loyers impayés
select
  'impaye:'    || r.id::text                                  as key,
  'impaye'                                                    as type,
  'danger'                                                    as severity,
  'Loyer impayé'                                              as title,
  t.first_name || ' ' || t.last_name || ' — ' || p.name
    || ' : ' || to_char(r.amount_due - r.amount_paid, 'FM999999990.00') || ' DT'
    || ' (échéance ' || to_char(r.due_date, 'DD/MM/YYYY') || ')'  as message,
  r.due_date                                                  as ref_date,
  'rents'                                                     as entity_type,
  r.id                                                        as entity_id
from public.rents r
join public.properties p on p.id = r.property_id
join public.tenants    t on t.id = r.tenant_id
where r.amount_paid = 0 and r.amount_due > 0 and r.due_date < current_date

union all
-- Paiements partiels
select
  'partiel:' || r.id::text, 'partiel', 'warning', 'Paiement partiel',
  t.first_name || ' ' || t.last_name || ' — ' || p.name
    || ' : reste ' || to_char(r.amount_due - r.amount_paid, 'FM999999990.00') || ' DT',
  r.due_date, 'rents', r.id
from public.rents r
join public.properties p on p.id = r.property_id
join public.tenants    t on t.id = r.tenant_id
where r.amount_paid > 0 and r.amount_paid < r.amount_due

union all
-- Loyers prochainement dus (7 jours)
select
  'echeance:' || r.id::text, 'echeance', 'info', 'Loyer bientôt dû',
  t.first_name || ' ' || t.last_name || ' — ' || p.name
    || ' : ' || to_char(r.amount_due - r.amount_paid, 'FM999999990.00') || ' DT'
    || ' le ' || to_char(r.due_date, 'DD/MM/YYYY'),
  r.due_date, 'rents', r.id
from public.rents r
join public.properties p on p.id = r.property_id
join public.tenants    t on t.id = r.tenant_id
where r.amount_paid < r.amount_due
  and r.due_date between current_date and (current_date + 7)

union all
-- Contrats proches de l'expiration (60 jours)
select
  'contrat:' || c.id::text, 'contrat', 'warning', 'Contrat bientôt expiré',
  p.name || ' — ' || t.first_name || ' ' || t.last_name
    || ' : fin le ' || to_char(c.end_date, 'DD/MM/YYYY'),
  c.end_date, 'contracts', c.id
from public.contracts c
join public.properties p on p.id = c.property_id
join public.tenants    t on t.id = c.tenant_id
where c.status = 'actif' and c.end_date is not null
  and c.end_date between current_date and (current_date + 60)

union all
-- Assurances proches de l'expiration (60 jours)
select
  'assurance:' || p.id::text, 'assurance', 'warning', 'Assurance bientôt expirée',
  p.name || ' : expire le ' || to_char(p.insurance_expiry, 'DD/MM/YYYY'),
  p.insurance_expiry, 'properties', p.id
from public.properties p
where p.insurance_expiry is not null
  and p.insurance_expiry <= (current_date + 60)

union all
-- Biens en maintenance
select
  'maintenance:' || p.id::text, 'maintenance', 'info', 'Bien en maintenance',
  p.name || ' (' || coalesce(p.city, '—') || ') est en maintenance',
  current_date, 'properties', p.id
from public.properties p
where p.status = 'maintenance';
-- =============================================================================
-- SÉCURITÉ : Row Level Security + Storage
-- Application interne : seuls les utilisateurs authentifiés voient les données.
-- Écriture réservée aux rôles 'proprietaire' et 'gestionnaire' ('lecteur' = RO).
-- =============================================================================

alter table public.properties             enable row level security;
alter table public.tenants                enable row level security;
alter table public.contracts              enable row level security;
alter table public.rents                  enable row level security;
alter table public.payments               enable row level security;
alter table public.expenses               enable row level security;
alter table public.documents              enable row level security;
alter table public.profiles               enable row level security;
alter table public.audit_log              enable row level security;
alter table public.notification_dismissals enable row level security;

-- Lecture + écriture sur les tables métier
do $$
declare t text;
begin
  foreach t in array array['properties','tenants','contracts','rents','payments','expenses','documents'] loop
    execute format('drop policy if exists "read_%1$s"   on public.%1$s', t);
    execute format('drop policy if exists "insert_%1$s" on public.%1$s', t);
    execute format('drop policy if exists "update_%1$s" on public.%1$s', t);
    execute format('drop policy if exists "delete_%1$s" on public.%1$s', t);

    execute format('create policy "read_%1$s" on public.%1$s
                    for select to authenticated using (true)', t);
    execute format('create policy "insert_%1$s" on public.%1$s
                    for insert to authenticated with check (public.can_write())', t);
    execute format('create policy "update_%1$s" on public.%1$s
                    for update to authenticated using (public.can_write()) with check (public.can_write())', t);
    execute format('create policy "delete_%1$s" on public.%1$s
                    for delete to authenticated using (public.can_write())', t);
  end loop;
end $$;

-- Profils : chacun lit tous les profils, ne modifie que le sien
drop policy if exists "read_profiles"   on public.profiles;
drop policy if exists "update_profiles" on public.profiles;
create policy "read_profiles"   on public.profiles for select to authenticated using (true);
create policy "update_profiles" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Historique : lecture seule (écriture par triggers SECURITY DEFINER)
drop policy if exists "read_audit" on public.audit_log;
create policy "read_audit" on public.audit_log for select to authenticated using (true);

-- Notifications masquées : propres à chaque utilisateur
drop policy if exists "own_dismissals" on public.notification_dismissals;
create policy "own_dismissals" on public.notification_dismissals
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- STORAGE : bucket privé "documents"
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 26214400)   -- 25 Mo
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "documents_read"   on storage.objects;
drop policy if exists "documents_write"  on storage.objects;
drop policy if exists "documents_update" on storage.objects;
drop policy if exists "documents_delete" on storage.objects;

create policy "documents_read" on storage.objects
  for select to authenticated using (bucket_id = 'documents');
create policy "documents_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents' and public.can_write());
create policy "documents_update" on storage.objects
  for update to authenticated using (bucket_id = 'documents' and public.can_write());
create policy "documents_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'documents' and public.can_write());
