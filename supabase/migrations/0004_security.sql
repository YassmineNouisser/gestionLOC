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
