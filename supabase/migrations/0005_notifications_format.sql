-- =============================================================================
-- Les notifications ne composent plus leur texte ni ne formatent les montants.
--
-- Auparavant la vue produisait « 1580.00 DT » via to_char() : format anglais,
-- incohérent avec le reste de l'application qui affiche « 1 580 DT ».
-- Le formatage est une affaire de présentation : la vue renvoie désormais des
-- données brutes (sujet, montant, date) et l'interface compose la phrase avec
-- le même formateur que partout ailleurs.
-- =============================================================================

drop view if exists public.v_notifications;

create view public.v_notifications
with (security_invoker = on) as
-- Loyers impayés
select
  'impaye:' || r.id::text                                     as key,
  'impaye'                                                    as type,
  'danger'                                                    as severity,
  'Loyer impayé'                                              as title,
  t.first_name || ' ' || t.last_name || ' — ' || p.name       as subject,
  (r.amount_due - r.amount_paid)                              as amount,
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
  t.first_name || ' ' || t.last_name || ' — ' || p.name,
  (r.amount_due - r.amount_paid), r.due_date, 'rents', r.id
from public.rents r
join public.properties p on p.id = r.property_id
join public.tenants    t on t.id = r.tenant_id
where r.amount_paid > 0 and r.amount_paid < r.amount_due

union all
-- Loyers dus dans les 7 jours
select
  'echeance:' || r.id::text, 'echeance', 'info', 'Loyer bientôt dû',
  t.first_name || ' ' || t.last_name || ' — ' || p.name,
  (r.amount_due - r.amount_paid), r.due_date, 'rents', r.id
from public.rents r
join public.properties p on p.id = r.property_id
join public.tenants    t on t.id = r.tenant_id
where r.amount_paid < r.amount_due
  and r.due_date between current_date and (current_date + 7)

union all
-- Contrats proches de l'expiration
select
  'contrat:' || c.id::text, 'contrat', 'warning', 'Contrat bientôt expiré',
  p.name || ' — ' || t.first_name || ' ' || t.last_name,
  null::numeric, c.end_date, 'contracts', c.id
from public.contracts c
join public.properties p on p.id = c.property_id
join public.tenants    t on t.id = c.tenant_id
where c.status = 'actif' and c.end_date is not null
  and c.end_date between current_date and (current_date + 60)

union all
-- Assurances proches de l'expiration
select
  'assurance:' || p.id::text, 'assurance', 'warning', 'Assurance bientôt expirée',
  p.name, null::numeric, p.insurance_expiry, 'properties', p.id
from public.properties p
where p.insurance_expiry is not null
  and p.insurance_expiry <= (current_date + 60)

union all
-- Biens en maintenance
select
  'maintenance:' || p.id::text, 'maintenance', 'info', 'Bien en maintenance',
  p.name || coalesce(' (' || p.city || ')', ''),
  null::numeric, current_date, 'properties', p.id
from public.properties p
where p.status = 'maintenance';
