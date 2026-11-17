-- Link na bio (links.html): guarda os contatos e conta os cliques.
-- Cole no "SQL Editor" do Supabase e clique em Run. Pode rodar de novo sem problema.
-- A página é pública e sem login: ela só consegue CHAMAR as duas funções abaixo (gravar),
-- nunca ler. Quem lê os contatos e os cliques são só as sócias, pelo painel.

-- 1) Cliques por botão
create table if not exists public.linkbio_cliques (
  id         bigserial primary key,
  pagina     text not null,
  botao      text not null,
  criado_em  timestamptz not null default now()
);
create index if not exists linkbio_cliques_pagina on public.linkbio_cliques (pagina, criado_em);
alter table public.linkbio_cliques enable row level security;
drop policy if exists "socias leem cliques" on public.linkbio_cliques;
create policy "socias leem cliques" on public.linkbio_cliques for select using (public.eh_socia());

create or replace function public.linkbio_clique(p_pagina text, p_botao text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_pagina !~ '^[a-z0-9-]{1,40}$' or length(coalesce(p_botao, '')) not between 1 and 80 then return; end if;
  insert into public.linkbio_cliques (pagina, botao) values (p_pagina, p_botao);
end $$;

-- 2) Contatos: entram como "lead" na tabela do painel (records), com as respostas da conversa.
create or replace function public.linkbio_lead(p_pagina text, p_dados jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_nome text := left(trim(coalesce(p_dados->>'nome', '')), 80);
  v_zap  text := left(regexp_replace(coalesce(p_dados->>'whatsapp', ''), '[^0-9]', '', 'g'), 15);
  v_ig   text := left(trim(coalesce(p_dados->>'instagram', '')), 60);
begin
  if p_pagina !~ '^[a-z0-9-]{1,40}$' or v_nome = '' or length(v_zap) < 10 then return false; end if;
  if octet_length(p_dados::text) > 4000 then return false; end if;
  insert into public.records (kind, id, data, updated_by)
  values ('lead', 'lb' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
    jsonb_build_object(
      'nome', v_nome, 'whatsapp', v_zap, 'instagram', v_ig,
      'pagina', p_pagina, 'origem', 'Link na bio',
      'respostas', coalesce(p_dados->'respostas', '{}'::jsonb),
      'indicacao', left(coalesce(p_dados->>'indicacao', ''), 80),
      'status', 'novo', 'criadoEm', to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS')
    ), 'link na bio');
  return true;
end $$;

revoke all on function public.linkbio_clique(text, text) from public;
revoke all on function public.linkbio_lead(text, jsonb) from public;
grant execute on function public.linkbio_clique(text, text) to anon, authenticated;
grant execute on function public.linkbio_lead(text, jsonb) to anon, authenticated;
