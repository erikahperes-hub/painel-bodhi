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

-- Segurança em duas camadas:
-- 1) só quem está logado acessa; 2) além disso, o e-mail precisa estar na lista de sócias abaixo.
-- Assim, mesmo que alguém crie uma conta, não enxerga nada.
create table if not exists public.socias (email text primary key);
alter table public.socias enable row level security;   -- sem políticas: ninguém lê pela internet

-- Coloque aqui os e-mails da Érika e da Milena (os mesmos usados no login). Pode rodar de novo para incluir mais.
insert into public.socias (email) values
  ('erikahperes@gmail.com')
  -- , ('email-da-milena@exemplo.com')   <- tire o "--" do início e troque pelo e-mail dela
on conflict do nothing;

create or replace function public.eh_socia() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.socias where lower(email) = lower(auth.jwt() ->> 'email'))
$$;

alter table public.records enable row level security;

drop policy if exists "logadas leem"     on public.records;
drop policy if exists "logadas inserem"  on public.records;
drop policy if exists "logadas editam"   on public.records;
drop policy if exists "logadas excluem"  on public.records;
drop policy if exists "socias leem"      on public.records;
drop policy if exists "socias inserem"   on public.records;
drop policy if exists "socias editam"    on public.records;
drop policy if exists "socias excluem"   on public.records;

create policy "socias leem"    on public.records for select to authenticated using (public.eh_socia());
create policy "socias inserem" on public.records for insert to authenticated with check (public.eh_socia());
create policy "socias editam"  on public.records for update to authenticated using (public.eh_socia()) with check (public.eh_socia());
create policy "socias excluem" on public.records for delete to authenticated using (public.eh_socia());

create or replace function public.tocar_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists records_tocar on public.records;
create trigger records_tocar before update on public.records
  for each row execute function public.tocar_updated_at();
