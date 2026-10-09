-- Importação de planejamento pelo Claude Code ("só adicionar").
-- Rode uma vez no SQL Editor do Supabase (Run). Pode rodar de novo sem problema.
--
-- O que a chave deste arquivo consegue fazer: ADICIONAR ideias novas na etapa Planejamento (internas, sem arquivos).
-- O que ela NÃO consegue: ler dados, alterar ou apagar o que já existe, mandar ideia ao cliente, ver contratos ou financeiro.
-- A chave em si nunca fica no banco nem no GitHub: o banco guarda só o "hash" dela. Para cancelar uma chave:
--   update public.importacao_chaves set ativa = false where nome = 'Nome da chave';

create table if not exists public.importacao_chaves (
  id        bigint generated always as identity primary key,
  nome      text not null,
  hash      text not null unique,
  ativa     boolean not null default true,
  criada_em timestamptz not null default now()
);
alter table public.importacao_chaves enable row level security;   -- sem políticas: ninguém lê pela internet

-- Tira acento e maiúscula para comparar nomes (cliente, título).
create or replace function public.bodhi_norm(t text) returns text
language sql immutable set search_path = public as $$
  select trim(translate(lower(coalesce(t, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'))
$$;
revoke all on function public.bodhi_norm(text) from public, anon, authenticated;

create or replace function public.importar_planejamento(p_chave text, p_pecas jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_chave text;
  p jsonb;
  v_cliid text;
  v_n int;
  v_titulo text;
  v_formato text;
  v_publicar text;
  v_funil text;
  v_id text;
  v_criadas jsonb := '[]'::jsonb;
  v_ignoradas jsonb := '[]'::jsonb;
begin
  if p_chave is null or length(p_chave) < 20 then raise exception 'chave invalida'; end if;
  select nome into v_chave from importacao_chaves
    where hash = encode(sha256(convert_to(p_chave, 'UTF8')), 'hex') and ativa;
  if v_chave is null then raise exception 'chave invalida'; end if;
  if p_pecas is null or jsonb_typeof(p_pecas) <> 'array' or jsonb_array_length(p_pecas) = 0 then
    raise exception 'envie uma lista de pecas';
  end if;
  if jsonb_array_length(p_pecas) > 100 then raise exception 'no maximo 100 pecas por envio'; end if;

  for p in select value from jsonb_array_elements(p_pecas) loop
    -- título sem o tipo no começo ("Reels: ...") e com a primeira letra maiúscula
    v_titulo := trim(coalesce(p ->> 'titulo', ''));
    v_titulo := regexp_replace(v_titulo, '^\s*(reels?|carrossel|carross[eé]is|stories|story|feed)\s*[:\-–]\s*', '', 'i');
    if v_titulo = '' then
      v_ignoradas := v_ignoradas || jsonb_build_array(jsonb_build_object('titulo', coalesce(p ->> 'titulo', ''), 'motivo', 'sem titulo'));
      continue;
    end if;
    v_titulo := upper(left(v_titulo, 1)) || substr(v_titulo, 2);

    -- cliente: precisa existir no painel, com o mesmo nome (sem diferenciar acento e maiúscula)
    select count(*) into v_n from records
      where kind = 'cliente' and bodhi_norm(data ->> 'nome') = bodhi_norm(p ->> 'clienteNome') and bodhi_norm(p ->> 'clienteNome') <> '';
    if v_n <> 1 then
      v_ignoradas := v_ignoradas || jsonb_build_array(jsonb_build_object('titulo', v_titulo, 'motivo', 'cliente nao encontrado: ' || coalesce(p ->> 'clienteNome', '')));
      continue;
    end if;
    select id into v_cliid from records
      where kind = 'cliente' and bodhi_norm(data ->> 'nome') = bodhi_norm(p ->> 'clienteNome') limit 1;

    v_formato := lower(coalesce(p ->> 'formato', ''));
    if v_formato not in ('feed', 'carrossel', 'reels', 'story') then v_formato := 'feed'; end if;

    v_publicar := '';
    if (p ->> 'publicar') ~ '^\d{4}-\d{2}-\d{2}$' then
      begin
        perform (p ->> 'publicar')::date;
        v_publicar := p ->> 'publicar';
      exception when others then v_publicar := '';
      end;
    end if;

    v_funil := lower(coalesce(p ->> 'funil', ''));
    if v_funil not in ('topo', 'meio', 'fundo') then v_funil := ''; end if;

    v_id := 'lote-' || v_cliid || '-' || coalesce(nullif(v_publicar, ''), 'sem-data') || '-'
            || trim(both '-' from regexp_replace(bodhi_norm(v_titulo), '[^a-z0-9]+', '-', 'g'));

    -- não duplica: mesmo código, mesmo título, ou mesma data e formato com palavras do título em comum
    if exists (
      select 1 from records r
      where r.kind = 'conteudo' and (
        r.id = v_id
        or (r.data ->> 'clienteId' = v_cliid and bodhi_norm(r.data ->> 'titulo') = bodhi_norm(v_titulo))
        or (r.data ->> 'clienteId' = v_cliid and v_publicar <> '' and r.data ->> 'publicar' = v_publicar and r.data ->> 'formato' = v_formato
            and exists (
              select 1 from unnest(regexp_split_to_array(bodhi_norm(r.data ->> 'titulo'), '[^a-z0-9]+')) w
              where length(w) > 3 and w = any (regexp_split_to_array(bodhi_norm(v_titulo), '[^a-z0-9]+'))
            ))
      )
    ) then
      v_ignoradas := v_ignoradas || jsonb_build_array(jsonb_build_object('titulo', v_titulo, 'motivo', 'ja existe no painel'));
      continue;
    end if;

    insert into records (kind, id, data, updated_by) values ('conteudo', v_id, jsonb_build_object(
      'id', v_id,
      'clienteId', v_cliid,
      'titulo', v_titulo,
      'formato', v_formato,
      'etapa', 'briefing',
      'publicar', v_publicar,
      'roteiro', left(coalesce(p ->> 'roteiro', ''), 5000),
      'funil', v_funil,
      'planejamento', '',
      'ajustePlano', '',
      'legenda', left(coalesce(p ->> 'legenda', ''), 5000),
      'midias', '[]'::jsonb,
      'capa', '',
      'ajuste', '',
      'briefing', left(coalesce(p ->> 'observacoes', p ->> 'briefing', ''), 5000),
      'responsavel', '',
      'link', '',
      'criadoEm', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ), 'importação (' || v_chave || ')');
    v_criadas := v_criadas || jsonb_build_array(v_titulo);
  end loop;

  return jsonb_build_object('criadas', v_criadas, 'ignoradas', v_ignoradas);
end $$;

revoke all on function public.importar_planejamento(text, jsonb) from public;
grant execute on function public.importar_planejamento(text, jsonb) to anon, authenticated;
