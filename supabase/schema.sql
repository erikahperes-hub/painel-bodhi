-- Painel Bôdhi: estrutura do banco (Supabase). Cole no "SQL Editor" e clique em Run.
-- Uma única tabela guarda tudo (clientes, propostas, contratos, pendências e configurações).

create table if not exists public.records (
  kind        text not null,
  id          text not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (kind, id)
);

-- Segurança: só quem está logado consegue ler ou alterar. Quem não tem login não vê nada.
alter table public.records enable row level security;

drop policy if exists "logadas leem"     on public.records;
drop policy if exists "logadas inserem"  on public.records;
drop policy if exists "logadas editam"   on public.records;
drop policy if exists "logadas excluem"  on public.records;

create policy "logadas leem"    on public.records for select to authenticated using (true);
create policy "logadas inserem" on public.records for insert to authenticated with check (true);
create policy "logadas editam"  on public.records for update to authenticated using (true) with check (true);
create policy "logadas excluem" on public.records for delete to authenticated using (true);

create or replace function public.tocar_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists records_tocar on public.records;
create trigger records_tocar before update on public.records
  for each row execute function public.tocar_updated_at();
