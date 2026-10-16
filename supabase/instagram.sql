-- Conexão do painel com o Instagram dos clientes (relatório de resultados). Cole no SQL Editor do Supabase e clique em Run.
-- Pode rodar de novo sem problema (versão 2: stories guardados, chave da leitura automática e aviso de erro).
--
-- Segurança: o token de cada cliente fica SÓ na tabela ig_conexoes, que ninguém lê pela internet (sem políticas de acesso).
-- Apenas a função "instagram" (com a chave de serviço do servidor) lê e grava ali.

create table if not exists public.ig_conexoes (
  cliente_id    text primary key,          -- id do cliente no painel
  ig_user_id    text not null,             -- id da conta profissional do Instagram
  username      text,
  token         text not null,             -- token de 60 dias; a função renova sozinha
  expira_em     timestamptz not null,
  atualizado_em timestamptz not null default now()
);
alter table public.ig_conexoes add column if not exists ultimo_erro    text;        -- último problema da leitura automática (vazio = tudo certo)
alter table public.ig_conexoes add column if not exists ultima_leitura timestamptz; -- quando a leitura automática funcionou pela última vez
alter table public.ig_conexoes enable row level security;   -- sem políticas: ninguém lê pela internet

-- Stories: o Instagram só entrega os stories das últimas 24 horas, então a leitura automática copia cada um para cá
-- (com os números mais recentes antes de expirar). Só as sócias leem pelo painel; só a função grava.
create table if not exists public.ig_stories (
  cliente_id    text not null,
  story_id      text not null,
  publicado_em  timestamptz not null,
  dados         jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  primary key (cliente_id, story_id)
);
create index if not exists ig_stories_cliente_data on public.ig_stories (cliente_id, publicado_em);
alter table public.ig_stories enable row level security;
drop policy if exists "socias leem stories" on public.ig_stories;
create policy "socias leem stories" on public.ig_stories for select to authenticated using (public.eh_socia());

-- Chave que o agendamento do Supabase (pg_cron) usa para acordar a função. Fica numa tabela fechada, sem políticas.
create table if not exists public.ig_cron (chave text primary key);
alter table public.ig_cron enable row level security;
insert into public.ig_cron (chave)
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  where not exists (select 1 from public.ig_cron);

-- Para o painel saber quais clientes estão conectados e se a leitura automática está bem (nunca devolve o token). Só sócias.
create or replace function public.ig_status() returns jsonb
language sql security definer set search_path = public as $$
  select case when public.eh_socia()
    then coalesce((select jsonb_agg(jsonb_build_object(
           'clienteId', cliente_id, 'username', username, 'expiraEm', expira_em,
           'ultimoErro', ultimo_erro, 'ultimaLeitura', ultima_leitura)) from public.ig_conexoes), '[]'::jsonb)
    else '[]'::jsonb end;
$$;
revoke all on function public.ig_status() from public, anon;
grant execute on function public.ig_status() to authenticated;
