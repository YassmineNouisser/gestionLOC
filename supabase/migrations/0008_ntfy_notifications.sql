-- =============================================================================
-- RAPPELS DE RETARD PAR NOTIFICATION MOBILE (ntfy)
--
-- Un loyer non soldé dont l'échéance est dépassée depuis N jours déclenche une
-- notification sur le téléphone du propriétaire.
--
-- L'envoi est fait par la base elle-même (pg_net) sur son propre calendrier
-- (pg_cron). Deux conséquences voulues :
--   - la notification part même si personne n'ouvre l'application, ce qui est
--     tout l'intérêt : prévenir quelqu'un qui ne regarde pas ;
--   - aucune clé de service ni tâche externe à maintenir.
--
-- Le message est publié en JSON plutôt qu'en en-têtes HTTP : ntfy impose l'ASCII
-- dans les en-têtes, et les accents français y seraient mutilés.
-- =============================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- 1. Réglages
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  id            smallint primary key default 1 check (id = 1),
  ntfy_enabled  boolean not null default false,
  ntfy_server   text    not null default 'https://ntfy.sh',
  ntfy_topic    text,
  overdue_days  integer not null default 7 check (overdue_days between 1 and 90),
  app_url       text    not null default 'https://gestion-loc-app.vercel.app',
  updated_at    timestamptz not null default now()
);

comment on table public.app_settings is
  'Réglages de l''application. Une seule ligne, garantie par la contrainte id = 1.';

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists trg_touch_app_settings on public.app_settings;
create trigger trg_touch_app_settings
  before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Journal des envois — garantit qu'un même loyer n'alerte qu'une fois
-- ---------------------------------------------------------------------------
create table if not exists public.notification_deliveries (
  id         uuid primary key default gen_random_uuid(),
  rent_id    uuid not null references public.rents(id) on delete cascade,
  kind       text not null default 'retard',
  topic      text,
  message    text,
  sent_at    timestamptz not null default now(),
  constraint uq_delivery unique (rent_id, kind)
);

create index if not exists idx_deliveries_sent on public.notification_deliveries(sent_at desc);

-- ---------------------------------------------------------------------------
-- 3. Loyers méritant une alerte
--    Vue séparée de la fonction d'envoi : on peut ainsi voir ce qui partirait
--    sans rien envoyer, ce qui rend la règle vérifiable.
-- ---------------------------------------------------------------------------
create or replace view public.v_overdue_to_notify
with (security_invoker = on) as
select
  r.id                                   as rent_id,
  r.period_month,
  r.due_date,
  (current_date - r.due_date)            as days_late,
  (r.amount_due - r.amount_paid)         as balance,
  p.name                                 as property_name,
  t.first_name || ' ' || t.last_name     as tenant_name,
  t.phone                                as tenant_phone
from public.rents r
join public.properties p on p.id = r.property_id
join public.tenants    t on t.id = r.tenant_id
cross join public.app_settings s
where r.amount_paid < r.amount_due
  and r.due_date <= current_date - s.overdue_days
  and not exists (
    select 1 from public.notification_deliveries d
    where d.rent_id = r.id and d.kind = 'retard'
  );

-- ---------------------------------------------------------------------------
-- 3 bis. Formatage des montants côté base
--
-- Le message de notification est composé par la base : le formateur de
-- l'interface n'est pas disponible ici. to_char() suit la locale du serveur et
-- produisait « 1,580. DT ». Cette fonction applique explicitement la
-- convention française : espace pour les milliers, virgule décimale, millimes
-- affichées seulement si elles existent.
-- ---------------------------------------------------------------------------
create or replace function public.fmt_money(v numeric)
returns text
language plpgsql
immutable
as $$
declare
  n     numeric := round(coalesce(v, 0), 3);
  signe text    := case when n < 0 then '-' else '' end;
  a     numeric := abs(n);
  ent   text    := regexp_replace(trunc(a)::bigint::text, '(\d)(?=(\d{3})+$)', '\1 ', 'g');
  mil   integer := round((a - trunc(a)) * 1000)::integer;
begin
  return signe || ent
       || case when mil > 0 then ',' || lpad(mil::text, 3, '0') else '' end
       || ' DT';
end $$;

-- ---------------------------------------------------------------------------
-- 4. Envoi
--    Renvoie le nombre de notifications émises. Journalise avant d'envoyer :
--    en cas d'échec réseau, mieux vaut une alerte manquée qu'une boucle
--    d'alertes répétées chaque jour sur le téléphone du propriétaire.
-- ---------------------------------------------------------------------------
create or replace function public.notify_overdue_rents()
returns integer
language plpgsql
security definer
-- pg_net installe ses fonctions dans son propre schéma « net », quel que soit
-- le schéma passé à CREATE EXTENSION.
set search_path = public, net, extensions
as $$
declare
  s     public.app_settings%rowtype;
  row   record;
  count integer := 0;
  body  jsonb;
begin
  select * into s from public.app_settings where id = 1;

  if not found or not s.ntfy_enabled or coalesce(s.ntfy_topic, '') = '' then
    return 0;
  end if;

  for row in select * from public.v_overdue_to_notify order by days_late desc loop
    body := jsonb_build_object(
      'topic', s.ntfy_topic,
      'title', 'Loyer en retard',
      'message', row.tenant_name || ' — ' || row.property_name || E'\n'
                 || public.fmt_money(row.balance) || ' dus depuis le '
                 || to_char(row.due_date, 'DD/MM/YYYY')
                 || ' (' || row.days_late || ' jours de retard)',
      'priority', 4,
      'tags', jsonb_build_array('warning', 'house'),
      'click', s.app_url || '/loyers/' || row.rent_id::text
    );

    insert into public.notification_deliveries (rent_id, kind, topic, message)
    values (row.rent_id, 'retard', s.ntfy_topic, body->>'message');

    perform net.http_post(
      url     := s.ntfy_server,
      body    := body,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 8000
    );

    count := count + 1;
  end loop;

  return count;
end $$;

comment on function public.notify_overdue_rents is
  'Envoie une notification ntfy par loyer en retard non encore signalé. Idempotente.';

-- ---------------------------------------------------------------------------
-- 5. Planification : tous les jours à 8 h UTC (9 h à Tunis en hiver)
-- ---------------------------------------------------------------------------
select cron.unschedule('rappels-loyers-en-retard')
where exists (select 1 from cron.job where jobname = 'rappels-loyers-en-retard');

select cron.schedule(
  'rappels-loyers-en-retard',
  '0 8 * * *',
  $cron$ select public.notify_overdue_rents(); $cron$
);

-- ---------------------------------------------------------------------------
-- 6. Sécurité
-- ---------------------------------------------------------------------------
alter table public.app_settings            enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "read_app_settings"   on public.app_settings;
drop policy if exists "update_app_settings" on public.app_settings;
create policy "read_app_settings" on public.app_settings
  for select to authenticated using (true);
create policy "update_app_settings" on public.app_settings
  for update to authenticated using (public.can_write()) with check (public.can_write());

drop policy if exists "read_deliveries" on public.notification_deliveries;
create policy "read_deliveries" on public.notification_deliveries
  for select to authenticated using (true);
