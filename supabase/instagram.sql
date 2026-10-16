-- Conexão do painel com o Instagram dos clientes (relatório de resultados). Rodar uma vez no SQL Editor do Supabase.
-- O token de cada cliente fica SÓ nesta tabela, que ninguém lê pela internet (sem políticas de acesso):
-- apenas a função "instagram" (com a chave de serviço do servidor) lê e grava aqui.
create table if not exists public.ig_conexoes (
  cliente_id    text primary key,          -- id do cliente no painel
  ig_user_id    text not null,             -- id da conta profissional do Instagram
  username      text,
  token         text not null,             -- token de 60 dias; a função renova sozinha
  expira_em     timestamptz not null,
  atualizado_em timestamptz not null default now()
);
alter table public.ig_conexoes enable row level security;   -- sem políticas: ninguém lê pela internet

-- Para o painel saber quais clientes estão conectados (nunca devolve o token). Só sócias.
create or replace function public.ig_status() returns jsonb
language sql security definer set search_path = public as $$
  select case when public.eh_socia()
    then coalesce((select jsonb_agg(jsonb_build_object('clienteId', cliente_id, 'username', username, 'expiraEm', expira_em)) from public.ig_conexoes), '[]'::jsonb)
    else '[]'::jsonb end;
$$;
revoke all on function public.ig_status() from public, anon;
grant execute on function public.ig_status() to authenticated;
