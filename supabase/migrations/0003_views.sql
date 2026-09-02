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
