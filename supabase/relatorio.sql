-- Link do relatório para o cliente (relatorio.html). Cole no SQL Editor do Supabase e clique em Run. Pode rodar de novo.
-- Rode antes o instagram.sql.
--
-- Como funciona e por que é seguro (igual ao link de aprovação):
-- * A tabela "records" continua fechada: só as sócias leem e escrevem nela.
-- * O cliente entra por um link com um código longo (tabela relatorio_links). Sem esse código, nada abre.
-- * A função relatorio_ver entrega SÓ os números daquele cliente: resultados do Instagram, stories, o que a Bôdhi entregou
--   e as metas. Nada de valores, contratos, briefing, roteiro ou dados de outros clientes.

create table if not exists public.relatorio_links (
  token       text primary key,
  cliente_id  text not null,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
create index if not exists relatorio_links_cliente on public.relatorio_links (cliente_id);
alter table public.relatorio_links enable row level security;
drop policy if exists "socias gerenciam links do relatorio" on public.relatorio_links;
create policy "socias gerenciam links do relatorio" on public.relatorio_links for all to authenticated
  using (public.eh_socia()) with check (public.eh_socia());

-- Devolve o link ativo do cliente (cria um se não houver). Com p_renovar = true, desativa o antigo e cria outro. Só sócias.
create or replace function public.relatorio_link(p_cliente text, p_renovar boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not public.eh_socia() then return null; end if;
  if p_renovar then update relatorio_links set ativo = false where cliente_id = p_cliente and ativo; end if;
  select token into v_token from relatorio_links where cliente_id = p_cliente and ativo order by criado_em desc limit 1;
  if v_token is null then
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    insert into relatorio_links (token, cliente_id) values (v_token, p_cliente);
  end if;
  return v_token;
end $$;

-- Dados do relatório para a página do cliente. Código inválido ou desativado: null.
create or replace function public.relatorio_ver(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_cliente text;
  v_cli jsonb;
  v_ins jsonb;
  v_stories jsonb;
  v_ent jsonb;
  v_desde text := to_char((now() at time zone 'America/Sao_Paulo') - interval '14 months', 'YYYY-MM');
begin
  select cliente_id into v_cliente from relatorio_links where token = p_token and ativo;
  if v_cliente is null then return null; end if;
  select data into v_cli from records where kind = 'cliente' and id = v_cliente;
  if v_cli is null then return null; end if;

  select coalesce(jsonb_agg(r.data order by r.data->>'mes'), '[]'::jsonb) into v_ins
    from records r
   where r.kind = 'insights' and r.data->>'clienteId' = v_cliente and coalesce(r.data->>'mes', '') >= v_desde;

  select coalesce(jsonb_agg(jsonb_build_object('id', story_id, 'publicadoEm', publicado_em, 'dados', dados) order by publicado_em), '[]'::jsonb)
    into v_stories
    from ig_stories
   where cliente_id = v_cliente and publicado_em >= (now() - interval '14 months');

  -- O que a Bôdhi entregou por mês e formato (tarefas aprovadas ou publicadas com data).
  select coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'formato', formato, 'n', n)), '[]'::jsonb) into v_ent
    from (select substr(r.data->>'publicar', 1, 7) as mes, coalesce(nullif(r.data->>'formato', ''), 'feed') as formato, count(*) as n
            from records r
           where r.kind = 'conteudo' and r.data->>'clienteId' = v_cliente
             and r.data->>'etapa' in ('aprovado', 'publicado')
             and coalesce(r.data->>'publicar', '') <> '' and substr(r.data->>'publicar', 1, 7) >= v_desde
           group by 1, 2) t;

  return jsonb_build_object(
    'cliente', jsonb_build_object('nome', v_cli->>'nome', 'imagem', v_cli->>'imagem', 'instagram', v_cli->>'instagram', 'metas', coalesce(v_cli->'metas', '{}'::jsonb)),
    'insights', v_ins, 'stories', v_stories, 'entregas', v_ent
  );
end $$;

revoke all on function public.relatorio_link(text, boolean) from public, anon;
revoke all on function public.relatorio_ver(text) from public;
grant execute on function public.relatorio_link(text, boolean) to authenticated;
grant execute on function public.relatorio_ver(text) to anon, authenticated;
