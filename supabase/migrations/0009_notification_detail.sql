-- =============================================================================
-- Détail du montant dans l'alerte de retard
--
-- Le message annonçait un total sans dire ce qu'il recouvrait. Le propriétaire
-- qui reçoit l'alerte doit pouvoir agir sans ouvrir l'application : il lui faut
-- le locataire, le bien, la décomposition loyer / charges, et de quoi appeler.
--
-- La ligne « Charges » n'apparaît que s'il y en a — afficher « Charges : 0 DT »
-- serait du bruit.
-- =============================================================================

-- La vue gagne des colonnes : CREATE OR REPLACE n'accepte pas un changement
-- d'ordre ni de nom, il faut la reconstruire.
drop view if exists public.v_overdue_to_notify;

create view public.v_overdue_to_notify
with (security_invoker = on) as
select
  r.id                                   as rent_id,
  r.period_month,
  r.due_date,
  (current_date - r.due_date)            as days_late,
  r.amount_due,
  r.amount_paid,
  (r.amount_due - r.amount_paid)         as balance,
  c.monthly_rent,
  c.charges,
  -- Le détail n'est affiché que s'il reconstitue exactement le montant dû :
  -- une décomposition qui ne tombe pas juste vaut mieux tue.
  (c.monthly_rent + c.charges = r.amount_due) as breakdown_matches,
  p.name                                 as property_name,
  p.reference                            as property_reference,
  t.first_name || ' ' || t.last_name     as tenant_name,
  t.phone                                as tenant_phone
from public.rents r
join public.properties p on p.id = r.property_id
join public.tenants    t on t.id = r.tenant_id
join public.contracts  c on c.id = r.contract_id
cross join public.app_settings s
where r.amount_paid < r.amount_due
  and r.due_date <= current_date - s.overdue_days
  and not exists (
    select 1 from public.notification_deliveries d
    where d.rent_id = r.id and d.kind = 'retard'
  );

create or replace function public.notify_overdue_rents()
returns integer
language plpgsql
security definer
-- pg_net installe ses fonctions dans son propre schéma « net ».
set search_path = public, net, extensions
as $$
declare
  s     public.app_settings%rowtype;
  row   record;
  count integer := 0;
  msg   text;
  body  jsonb;
begin
  select * into s from public.app_settings where id = 1;

  if not found or not s.ntfy_enabled or coalesce(s.ntfy_topic, '') = '' then
    return 0;
  end if;

  for row in select * from public.v_overdue_to_notify order by days_late desc loop

    msg := row.tenant_name || E'\n'
        || row.property_name || ' · ' || row.property_reference || E'\n\n';

    if row.breakdown_matches then
      msg := msg || 'Loyer : ' || public.fmt_money(row.monthly_rent) || E'\n';
      if row.charges > 0 then
        msg := msg || 'Charges : ' || public.fmt_money(row.charges) || E'\n';
      end if;
    end if;

    msg := msg || 'Total dû : ' || public.fmt_money(row.amount_due) || E'\n';

    if row.amount_paid > 0 then
      msg := msg || 'Déjà payé : ' || public.fmt_money(row.amount_paid) || E'\n'
          || 'Reste à percevoir : ' || public.fmt_money(row.balance) || E'\n';
    end if;

    msg := msg || E'\n' || 'Échéance du ' || to_char(row.due_date, 'DD/MM/YYYY');

    if coalesce(row.tenant_phone, '') <> '' then
      msg := msg || E'\n' || 'Téléphone : ' || row.tenant_phone;
    end if;

    body := jsonb_build_object(
      'topic', s.ntfy_topic,
      'title', 'Loyer en retard — ' || row.days_late || ' jours',
      'message', msg,
      'priority', 4,
      'tags', jsonb_build_array('warning', 'house'),
      'click', s.app_url || '/loyers/' || row.rent_id::text
    );

    -- Journaliser avant d'envoyer : en cas de panne réseau, mieux vaut une
    -- alerte manquée qu'une alerte répétée chaque matin.
    insert into public.notification_deliveries (rent_id, kind, topic, message)
    values (row.rent_id, 'retard', s.ntfy_topic, msg);

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
