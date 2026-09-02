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
