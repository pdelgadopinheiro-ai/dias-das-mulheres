-- Execute este script no SQL Editor do Supabase

create table if not exists public.fotos_carrossel (
  id bigint generated always as identity primary key,
  image_url text not null,
  created_at timestamptz not null default now()
);

alter table public.fotos_carrossel enable row level security;

drop policy if exists fotos_select_public on public.fotos_carrossel;
create policy fotos_select_public
on public.fotos_carrossel
for select
using (true);

drop policy if exists fotos_insert_public on public.fotos_carrossel;
create policy fotos_insert_public
on public.fotos_carrossel
for insert
with check (true);

insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

drop policy if exists storage_read_fotos_public on storage.objects;
create policy storage_read_fotos_public
on storage.objects
for select
using (bucket_id = 'fotos');

drop policy if exists storage_insert_fotos_public on storage.objects;
create policy storage_insert_fotos_public
on storage.objects
for insert
with check (bucket_id = 'fotos');