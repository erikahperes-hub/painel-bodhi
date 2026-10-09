-- Página de aprovação do cliente (aprovar.html). Cole no "SQL Editor" do Supabase e clique em Run.
-- Pode rodar de novo sem problema (esta é a versão 2: inclui a aprovação do PLANEJAMENTO antes da produção).
--
-- Como funciona e por que é seguro:
-- * A tabela "records" continua fechada: só as sócias leem e escrevem nela.
-- * O cliente entra por um link com um código longo (tabela aprovacao_links). Sem esse código, nada abre.
-- * O cliente usa só duas funções: ver as peças DELE e responder (aprovar ou pedir alteração) nelas.
--   As funções entregam apenas os campos que o cliente precisa (nada de briefing, valores ou dados de outros clientes).
-- * O roteiro e a etapa do funil (campos internos) só são entregues ao cliente nas peças que a Bôdhi enviou para aprovação do planejamento.

create table if not exists public.aprovacao_links (
  token       text primary key,
  cliente_id  text not null,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
create index if not exists aprovacao_links_cliente on public.aprovacao_links (cliente_id);

alter table public.aprovacao_links enable row level security;
drop policy if exists "socias gerenciam links" on public.aprovacao_links;
create policy "socias gerenciam links" on public.aprovacao_links for all to authenticated
  using (public.eh_socia()) with check (public.eh_socia());

-- Devolve o cliente e as peças visíveis para ele: as que já foram enviadas para aprovação do conteúdo
-- e as que foram enviadas para aprovação do planejamento. Código inválido ou desativado: null.
create or replace function public.aprovacao_ver(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_cliente text;
  v_cli jsonb;
  v_pecas jsonb;
begin
  select cliente_id into v_cliente from aprovacao_links where token = p_token and ativo;
  if v_cliente is null then return null; end if;

  select data into v_cli from records where kind = 'cliente' and id = v_cliente;
  if v_cli is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'titulo', r.data->>'titulo',
      'formato', r.data->>'formato',
      'etapa', r.data->>'etapa',
      'publicar', r.data->>'publicar',
      'legenda', r.data->>'legenda',
      'midias', coalesce(r.data->'midias', '[]'::jsonb),
      'capa', r.data->>'capa',
      'ajuste', r.data->>'ajuste',
      'planejamento', case when r.data->>'planejamento' in ('aprovacao', 'ajustes', 'aprovado') then r.data->>'planejamento' else null end,
      'ajustePlano', case when r.data->>'planejamento' in ('aprovacao', 'ajustes', 'aprovado') then r.data->>'ajustePlano' else null end,
      'roteiro', case when r.data->>'planejamento' in ('aprovacao', 'ajustes', 'aprovado') then r.data->>'roteiro' else null end,
      'funil', case when r.data->>'planejamento' in ('aprovacao', 'ajustes', 'aprovado') then r.data->>'funil' else null end
    ) order by r.data->>'publicar' nulls last), '[]'::jsonb)
  into v_pecas
  from records r
  where r.kind = 'conteudo'
    and r.data->>'clienteId' = v_cliente
    and (r.data->>'etapa' in ('aprovacao', 'ajustes', 'aprovado', 'publicado')
         or r.data->>'planejamento' in ('aprovacao', 'ajustes', 'aprovado'));

  return jsonb_build_object(
    'cliente', jsonb_build_object('nome', v_cli->>'nome', 'imagem', v_cli->>'imagem', 'instagram', v_cli->>'instagram'),
    'pecas', v_pecas
  );
end $$;

-- Registra a resposta do cliente. p_acao:
--   'aprovar' ou 'ajustar'              -> sobre o CONTEÚDO pronto (ajustar exige comentário)
--   'plano_aprovar' ou 'plano_ajustar'  -> sobre o PLANEJAMENTO (plano_ajustar exige comentário)
create or replace function public.aprovacao_responder(p_token text, p_peca text, p_acao text, p_comentario text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_cliente text;
  v_dados jsonb;
  v_agora text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_coment text := left(btrim(coalesce(p_comentario, '')), 1500);
  v_plano boolean := p_acao in ('plano_aprovar', 'plano_ajustar');
begin
  if p_acao not in ('aprovar', 'ajustar', 'plano_aprovar', 'plano_ajustar') then return false; end if;
  if p_acao in ('ajustar', 'plano_ajustar') and v_coment = '' then return false; end if;

  select cliente_id into v_cliente from aprovacao_links where token = p_token and ativo;
  if v_cliente is null then return false; end if;

  select data into v_dados from records
   where kind = 'conteudo' and id = p_peca and data->>'clienteId' = v_cliente
   for update;
  if v_dados is null then return false; end if;

  if v_plano then
    if coalesce(v_dados->>'planejamento', '') not in ('aprovacao', 'ajustes', 'aprovado') then return false; end if;
    v_dados := v_dados || jsonb_build_object(
      'planejamento', case when p_acao = 'plano_aprovar' then 'aprovado' else 'ajustes' end,
      'ajustePlano', case when p_acao = 'plano_ajustar' then v_coment else coalesce(v_dados->>'ajustePlano', '') end
    );
  else
    if v_dados->>'etapa' not in ('aprovacao', 'ajustes', 'aprovado') then return false; end if;
    v_dados := v_dados || jsonb_build_object(
      'etapa', case when p_acao = 'aprovar' then 'aprovado' else 'ajustes' end,
      'ajuste', case when p_acao = 'ajustar' then v_coment else coalesce(v_dados->>'ajuste', '') end
    );
  end if;

  v_dados := v_dados || jsonb_build_object(
    'respondidoEm', v_agora,
    'respondidoPor', 'cliente',
    'atualizadoEm', v_agora,
    'historico', coalesce(v_dados->'historico', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'quando', v_agora, 'acao', p_acao, 'comentario', v_coment))
  );

  update records set data = v_dados, updated_by = 'cliente (link de aprovação)'
   where kind = 'conteudo' and id = p_peca;
  return true;
end $$;

revoke all on function public.aprovacao_ver(text) from public;
revoke all on function public.aprovacao_responder(text, text, text, text) from public;
grant execute on function public.aprovacao_ver(text) to anon, authenticated;
grant execute on function public.aprovacao_responder(text, text, text, text) to anon, authenticated;
