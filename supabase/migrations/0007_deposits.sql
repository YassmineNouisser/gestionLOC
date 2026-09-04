-- =============================================================================
-- SUIVI DES CAUTIONS
--
-- Le contrat portait déjà le montant de la caution, mais rien n'indiquait ce
-- qui avait été versé. On applique le même principe que pour les loyers :
-- des versements datés, cumulés par la base, jamais un solde saisi à la main.
-- Une caution peut être réglée en plusieurs fois, et chaque versement doit
-- pouvoir donner lieu à un reçu.
-- =============================================================================

create table if not exists public.deposit_payments (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references public.contracts(id) on delete cascade,
  tenant_id    uuid not null references public.tenants(id)    on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  amount       numeric(14,3) not null check (amount > 0),
  payment_date date not null default current_date,
  method       text not null default 'especes'
               check (method in ('especes','virement','cheque','autre')),
  reference    text,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_deposit_payments_contract on public.deposit_payments(contract_id);
create index if not exists idx_deposit_payments_tenant   on public.deposit_payments(tenant_id);
create index if not exists idx_deposit_payments_date     on public.deposit_payments(payment_date);

-- Le versement hérite toujours du bien et du locataire de son contrat :
-- ces colonnes ne sont pas saisies, elles sont constatées.
create or replace function public.trg_deposit_fill_refs()
returns trigger language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select property_id, tenant_id into c
  from public.contracts where id = new.contract_id;

  if not found then
    raise exception 'Contrat introuvable (contract_id=%)', new.contract_id;
  end if;

  new.property_id := c.property_id;
  new.tenant_id   := c.tenant_id;
  return new;
end $$;

drop trigger if exists trg_deposits_fill_refs on public.deposit_payments;
create trigger trg_deposits_fill_refs
  before insert or update of contract_id on public.deposit_payments
  for each row execute function public.trg_deposit_fill_refs();

drop trigger if exists trg_audit_deposit_payments on public.deposit_payments;
create trigger trg_audit_deposit_payments
  after insert or update or delete on public.deposit_payments
  for each row execute function public.trg_audit();

-- --------------------------------------------------------------------------
-- Situation de la caution, par contrat
--   Versé  = somme des versements
--   Reste  = caution due − versé
--   Statut : Payée / Partielle / À verser
-- --------------------------------------------------------------------------
create or replace view public.v_contract_deposits
with (security_invoker = on) as
select
  c.id                                         as contract_id,
  c.property_id,
  c.tenant_id,
  c.status                                     as contract_status,
  c.start_date,
  c.deposit                                    as deposit_due,
  coalesce(d.paid, 0)                          as deposit_paid,
  greatest(c.deposit - coalesce(d.paid, 0), 0) as deposit_balance,
  case
    when c.deposit <= 0                  then 'sans_caution'
    when coalesce(d.paid, 0) >= c.deposit then 'payee'
    when coalesce(d.paid, 0) > 0          then 'partielle'
    else 'a_verser'
  end                                          as deposit_status,
  coalesce(d.count, 0)                         as deposit_payments_count,
  p.reference    as property_reference,
  p.name         as property_name,
  t.first_name   as tenant_first_name,
  t.last_name    as tenant_last_name
from public.contracts c
join public.properties p on p.id = c.property_id
join public.tenants    t on t.id = c.tenant_id
left join (
  select contract_id, sum(amount) as paid, count(*) as count
  from public.deposit_payments group by contract_id
) d on d.contract_id = c.id;

-- --------------------------------------------------------------------------
-- Sécurité : mêmes règles que les autres tables métier
-- --------------------------------------------------------------------------
alter table public.deposit_payments enable row level security;

drop policy if exists "read_deposit_payments"   on public.deposit_payments;
drop policy if exists "insert_deposit_payments" on public.deposit_payments;
drop policy if exists "update_deposit_payments" on public.deposit_payments;
drop policy if exists "delete_deposit_payments" on public.deposit_payments;

create policy "read_deposit_payments" on public.deposit_payments
  for select to authenticated using (true);
create policy "insert_deposit_payments" on public.deposit_payments
  for insert to authenticated with check (public.can_write());
create policy "update_deposit_payments" on public.deposit_payments
  for update to authenticated using (public.can_write()) with check (public.can_write());
create policy "delete_deposit_payments" on public.deposit_payments
  for delete to authenticated using (public.can_write());
