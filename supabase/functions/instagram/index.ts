// Função segura que conversa com o Instagram (API do Instagram com login do Instagram).
// Segredos no servidor (Edge Functions > Secrets): IG_APP_ID e IG_APP_SECRET. Nada disso vai para o site.
// IMPORTANTE: ao publicar esta função, DESLIGUE "Verify JWT" (o retorno do Instagram e o agendamento chegam sem login do painel).
// As ações do painel (POST) conferem o login e a lista de sócias aqui dentro; as do agendamento conferem a chave da tabela ig_cron.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-key',
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
// O Supabase mostra páginas HTML das funções como texto cru; por isso o retorno vai para uma página do próprio painel (conectado.html).
const pagina = (r: string, conta = '') =>
  new Response(null, { status: 302, headers: { Location: `https://painel.bodhi.marketing/conectado.html?r=${r}${conta ? `&conta=${encodeURIComponent(conta)}` : ''}` } });

const APP_ID = Deno.env.get('IG_APP_ID') ?? '';
const APP_SECRET = Deno.env.get('IG_APP_SECRET') ?? '';
const SUPA = Deno.env.get('SUPABASE_URL')!;
const RETORNO = `${SUPA}/functions/v1/instagram`; // este endereço exato é cadastrado no app da Meta
const GRAPH = 'https://graph.instagram.com/v23.0';
const SCOPES = 'instagram_business_basic,instagram_business_manage_insights';
// Só pedida a quem vai agendar posts (hoje, a conta da Bôdhi). Os clientes continuam só com leitura.
const SCOPES_PUBLICAR = `${SCOPES},instagram_business_content_publish`;
const admin = createClient(SUPA, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/* ---------- estado assinado (liga o retorno do Instagram ao cliente certo, sem guardar nada) ---------- */
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function assinar(texto: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(APP_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texto))));
}
async function criarEstado(clienteId: string) {
  const corpo = b64(new TextEncoder().encode(JSON.stringify({ c: clienteId, e: Date.now() + 7 * 864e5 })));
  return `${corpo}.${await assinar(corpo)}`;
}
async function lerEstado(estado: string): Promise<string | null> {
  const [corpo, sig] = String(estado).split('.');
  if (!corpo || !sig || (await assinar(corpo)) !== sig) return null;
  const d = JSON.parse(new TextDecoder().decode(deB64(corpo)));
  return d.e > Date.now() ? d.c : null;
}

/* ---------- Instagram ---------- */
async function pegar(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok || corpo?.error) throw new Error(corpo?.error?.message ?? corpo?.error_message ?? `Instagram respondeu ${r.status}`);
  return corpo;
}

async function guardarConexao(clienteId: string, code: string) {
  const form = new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, grant_type: 'authorization_code', redirect_uri: RETORNO, code });
  const curto = await pegar('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form });
  const longo = await pegar(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${APP_SECRET}&access_token=${curto.access_token}`);
  const eu = await pegar(`${GRAPH}/me?fields=user_id,username&access_token=${longo.access_token}`);
  const { error } = await admin.from('ig_conexoes').upsert({
    cliente_id: clienteId, ig_user_id: String(eu.user_id ?? curto.user_id), username: eu.username ?? null,
    token: longo.access_token, expira_em: new Date(Date.now() + (longo.expires_in ?? 5184000) * 1000).toISOString(), atualizado_em: new Date().toISOString(),
    ultimo_erro: null,
  });
  if (error) throw new Error(error.message);
  return eu.username as string;
}

// Renova o token quando faltam menos de 20 dias (o Instagram só deixa renovar tokens com mais de 24 horas).
async function tokenValido(c: any) {
  const faltam = new Date(c.expira_em).getTime() - Date.now();
  if (faltam > 20 * 864e5) return c.token as string;
  if (faltam < 0) throw new Error('A autorização do Instagram venceu. Conecte o Instagram deste cliente de novo.');
  try {
    const r = await pegar(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${c.token}`);
    await admin.from('ig_conexoes').update({ token: r.access_token, expira_em: new Date(Date.now() + r.expires_in * 1000).toISOString(), atualizado_em: new Date().toISOString() }).eq('cliente_id', c.cliente_id);
    return r.access_token as string;
  } catch { return c.token as string; }
}

async function conexao(clienteId: string) {
  const { data: c } = await admin.from('ig_conexoes').select('*').eq('cliente_id', clienteId).maybeSingle();
  if (!c) throw new Error('Este cliente ainda não conectou o Instagram.');
  return { c, token: await tokenValido(c) };
}
const consulta = (token: string) => (p: Record<string, string>) => new URLSearchParams({ ...p, access_token: token }).toString();

const unix = (d: Date) => Math.floor(d.getTime() / 1000);
const tipoDe = (m: any) => (m.media_product_type === 'REELS' ? 'Reels' : m.media_type === 'CAROUSEL_ALBUM' ? 'Carrossel' : m.media_type === 'VIDEO' ? 'Reels' : 'Estático');
// Data e hora no horário de Brasília (o Instagram devolve em UTC).
const partesBR = (iso: string) => {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(d);
  const p = Object.fromEntries(f.map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) % 24 };
};
const valor = (d: any) => d?.values?.[0]?.value ?? d?.total_value?.value ?? null;

/* ---------- perfil do público (gênero, idade, cidades): retrato do momento da leitura ---------- */
async function publico(c: any, token: string) {
  const q = consulta(token);
  const out: Record<string, any> = {};
  for (const [chave, quebra] of [['genero', 'gender'], ['idades', 'age'], ['cidades', 'city'], ['paises', 'country']]) {
    try {
      const r = await pegar(`${GRAPH}/${c.ig_user_id}/insights?${q({ metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', breakdown: quebra })}`);
      const res = r.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
      out[chave] = res.map((x: any) => ({ k: String(x.dimension_values?.[0] ?? ''), v: x.value ?? 0 })).sort((a: any, b: any) => b.v - a.v).slice(0, chave === 'cidades' ? 10 : 20);
    } catch { /* sem este recorte (menos de 100 seguidores ou não disponível) */ }
  }
  // Horas em que os seguidores estão online (só existe em algumas contas; se não vier, o painel calcula pelas publicações).
  try {
    const r = await pegar(`${GRAPH}/${c.ig_user_id}/insights?${q({ metric: 'online_followers', period: 'lifetime' })}`);
    const dias = r.data?.[0]?.values ?? [];
    const soma: number[] = Array(24).fill(0);
    for (const v of dias) for (const [h, n] of Object.entries(v.value ?? {})) soma[Number(h)] += Number(n) || 0;
    if (dias.length && soma.some((x) => x > 0)) out.horasOnline = soma.map((x) => Math.round(x / dias.length));
  } catch { /* indisponível */ }
  return out;
}

/* ---------- números do mês (feed, perfil e público) ---------- */
async function sincronizar(clienteId: string, mes: string) {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error('Mês inválido.');
  const { c, token } = await conexao(clienteId);
  const [a, m] = mes.split('-').map(Number);
  // Meses no horário de Brasília (meia-noite de Brasília = 03:00 em UTC).
  const ini = new Date(Date.UTC(a, m - 1, 1, 3));
  const fimMes = new Date(Date.UTC(a, m, 1, 3)); // primeiro instante do mês seguinte
  // O Instagram aceita no máximo 30 dias por consulta de insights: em meses de 31 dias o último dia fica de fora.
  const fimConsulta = new Date(Math.min(fimMes.getTime(), ini.getTime() + 30 * 864e5));
  const agora = Date.now();
  const q = consulta(token);

  const perfil = await pegar(`${GRAPH}/me?${q({ fields: 'username,followers_count,media_count' })}`);

  const total: Record<string, number> = {};
  const metricas = 'reach,views,profile_views,accounts_engaged,total_interactions';
  try {
    const r = await pegar(`${GRAPH}/${c.ig_user_id}/insights?${q({ metric: metricas, metric_type: 'total_value', period: 'day', since: String(unix(ini)), until: String(unix(fimConsulta)) })}`);
    for (const x of r.data ?? []) total[x.name] = x.total_value?.value ?? 0;
  } catch (e) {
    // Mês muito antigo ou conta nova: segue só com as publicações.
    console.log('insights da conta indisponíveis', (e as Error).message);
  }

  // Seguidores ganhos no mês (o Instagram só guarda os últimos 30 dias deste número).
  let ganhos: number | undefined;
  if (fimMes.getTime() > agora - 30 * 864e5) {
    try {
      const r = await pegar(`${GRAPH}/${c.ig_user_id}/insights?${q({ metric: 'follower_count', period: 'day', since: String(unix(new Date(Math.max(ini.getTime(), agora - 29 * 864e5)))), until: String(unix(new Date(Math.min(fimMes.getTime(), agora)))) })}`);
      ganhos = (r.data?.[0]?.values ?? []).reduce((t: number, v: any) => t + (v.value ?? 0), 0);
    } catch { /* sem o número */ }
  }

  // Publicações do mês, da mais nova para a mais antiga.
  const posts: any[] = [];
  let url: string | null = `${GRAPH}/${c.ig_user_id}/media?${q({ fields: 'id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count', limit: '50' })}`;
  let paginas = 0;
  while (url && paginas++ < 6) {
    const r = await pegar(url);
    let passou = false;
    for (const x of r.data ?? []) {
      const t = new Date(x.timestamp).getTime();
      if (t < ini.getTime()) { passou = true; continue; }
      if (t < fimMes.getTime()) posts.push(x);
    }
    url = passou ? null : r.paging?.next ?? null;
  }
  const detalhes: any[] = [];
  for (const x of posts.slice(0, 40)) {
    const ins: Record<string, number> = {};
    for (const lista of ['reach,views,saved,shares,total_interactions', 'reach,total_interactions', 'reach']) {
      try {
        const r = await pegar(`${GRAPH}/${x.id}/insights?${q({ metric: lista })}`);
        for (const d of r.data ?? []) ins[d.name] = valor(d) ?? 0;
        break;
      } catch { /* tenta com menos métricas */ }
    }
    const { data, hora } = partesBR(x.timestamp);
    detalhes.push({
      data, hora, tipo: tipoDe(x), legenda: x.caption ?? '', link: x.permalink ?? '',
      alcance: ins.reach ?? null, visualizacoes: ins.views ?? null, interacoes: ins.total_interactions ?? null,
      salvamentos: ins.saved ?? null, compartilhamentos: ins.shares ?? null, curtidas: x.like_count ?? null, comentarios: x.comments_count ?? null,
    });
  }

  // Perfil do público: retrato de hoje (o Instagram não guarda o histórico), então só é gravado em leituras do mês atual ou do último mês fechado.
  const recente = fimMes.getTime() > agora - 45 * 864e5;
  const pub = recente ? await publico(c, token) : null;

  const id = `${clienteId}_${mes}`;
  const { data: antigo } = await admin.from('records').select('data').eq('kind', 'insights').eq('id', id).maybeSingle();
  const hoje = partesBR(new Date().toISOString()).data;
  const dado = {
    ...(antigo?.data ?? {}), id, clienteId, mes, rede: 'instagram', fonte: 'instagram', atualizadoEm: new Date().toISOString(),
    seguidores: perfil.followers_count ?? null, seguidoresEm: hoje, ...(ganhos !== undefined ? { seguidoresGanhos: ganhos } : {}),
    alcance: total.reach ?? null, visualizacoes: total.views ?? null, interacoes: total.total_interactions ?? null,
    visitasPerfil: total.profile_views ?? null, contasEngajadas: total.accounts_engaged ?? null, posts: detalhes,
    ...(pub && Object.keys(pub).length ? { publico: pub, publicoEm: hoje } : {}),
  };
  const { error } = await admin.from('records').upsert({ kind: 'insights', id, data: dado, updated_by: 'instagram' });
  if (error) throw new Error(error.message);
  return { mes, publicacoes: detalhes.length, username: perfil.username };
}

/* ---------- stories: o Instagram só entrega os das últimas 24 horas, então copiamos cada um para a tabela ig_stories ---------- */
async function lerStories(clienteId: string) {
  const { c, token } = await conexao(clienteId);
  const q = consulta(token);
  const r = await pegar(`${GRAPH}/${c.ig_user_id}/stories?${q({ fields: 'id,media_type,timestamp,permalink,caption' })}`);
  let gravados = 0;
  for (const s of r.data ?? []) {
    const novo: Record<string, any> = {};
    for (const lista of ['reach,views,replies,shares,total_interactions,follows,profile_visits', 'reach,views,replies,shares,total_interactions', 'reach,views']) {
      try {
        const x = await pegar(`${GRAPH}/${s.id}/insights?${q({ metric: lista })}`);
        const mapa: Record<string, string> = { reach: 'alcance', views: 'visualizacoes', replies: 'respostas', shares: 'compartilhamentos', total_interactions: 'interacoes', follows: 'seguidoresNovos', profile_visits: 'visitasPerfil' };
        for (const d of x.data ?? []) if (mapa[d.name]) novo[mapa[d.name]] = valor(d) ?? 0;
        break;
      } catch { /* tenta com menos métricas; com menos de 5 visualizações o Instagram não entrega números */ }
    }
    try {
      const x = await pegar(`${GRAPH}/${s.id}/insights?${q({ metric: 'navigation', metric_type: 'total_value', breakdown: 'story_navigation_action_type' })}`);
      const mapaNav: Record<string, string> = { tap_forward: 'avancar', swipe_forward: 'proximo', tap_back: 'voltar', tap_exit: 'sair' };
      for (const it of x.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? []) {
        const k = mapaNav[String(it.dimension_values?.[0])];
        if (k) novo[k] = it.value ?? 0;
      }
    } catch { /* sem navegação */ }
    const { data: antes } = await admin.from('ig_stories').select('dados').eq('cliente_id', clienteId).eq('story_id', s.id).maybeSingle();
    const { data: dia, hora } = partesBR(s.timestamp);
    // Guarda os números mais recentes, sem perder os que já tinha (se esta leitura veio incompleta).
    const dados = { ...(antes?.dados ?? {}), ...novo, tipo: s.media_type === 'VIDEO' ? 'Vídeo' : 'Imagem', data: dia, hora, link: s.permalink ?? '', legenda: s.caption ?? '' };
    const { error } = await admin.from('ig_stories').upsert({ cliente_id: clienteId, story_id: s.id, publicado_em: new Date(s.timestamp).toISOString(), dados, atualizado_em: new Date().toISOString() });
    if (error) throw new Error(error.message);
    gravados++;
  }
  return { stories: gravados };
}

/* ---------- perfil: foto, nome, bio, link e números como estão agora no Instagram (o Instagram não entrega os destaques a nenhum app) ---------- */
async function perfilAtual(clienteId: string) {
  const { token } = await conexao(clienteId);
  const q = consulta(token);
  const p = await pegar(`${GRAPH}/me?${q({ fields: 'username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count' })}`);
  // Últimas publicações, para a grade do Feed mostrar o que já está no Instagram (capa de cada uma).
  const posts: any[] = [];
  try {
    const r = await pegar(`${GRAPH}/me/media?${q({ fields: 'id,caption,media_type,media_product_type,timestamp,permalink,media_url,thumbnail_url', limit: '30' })}`);
    for (const x of r.data ?? []) posts.push({ id: x.id, tipo: tipoDe(x), data: partesBR(x.timestamp).data, link: x.permalink ?? '', capa: x.thumbnail_url ?? x.media_url ?? '', legenda: String(x.caption ?? '').slice(0, 140) });
  } catch { /* segue só com o perfil */ }
  return {
    usuario: p.username ?? '', nome: p.name ?? '', bio: p.biography ?? '', site: p.website ?? '', foto: p.profile_picture_url ?? '',
    seguidores: p.followers_count ?? null, seguindo: p.follows_count ?? null, publicacoes: p.media_count ?? null, posts,
  };
}

/* ---------- agendamento (pg_cron chama estas ações com a chave da tabela ig_cron) ---------- */
async function paraCadaCliente(fn: (clienteId: string) => Promise<unknown>) {
  const { data: lista } = await admin.from('ig_conexoes').select('cliente_id');
  const resumo: Record<string, string> = {};
  for (const { cliente_id } of lista ?? []) {
    try {
      await fn(cliente_id);
      await admin.from('ig_conexoes').update({ ultima_leitura: new Date().toISOString(), ultimo_erro: null }).eq('cliente_id', cliente_id);
      resumo[cliente_id] = 'ok';
    } catch (e) {
      const msg = (e as Error).message.slice(0, 300);
      await admin.from('ig_conexoes').update({ ultimo_erro: msg }).eq('cliente_id', cliente_id);
      resumo[cliente_id] = msg;
    }
  }
  return resumo;
}
const mesesRecentes = () => {
  const hoje = partesBR(new Date().toISOString()).data.slice(0, 7);
  const [a, m] = hoje.split('-').map(Number);
  const ant = new Date(Date.UTC(a, m - 2, 1));
  return [`${ant.getUTCFullYear()}-${String(ant.getUTCMonth() + 1).padStart(2, '0')}`, hoje];
};

/* ---------- entrada ---------- */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const u = new URL(req.url);

  // Retorno do Instagram depois que o dono da conta toca em "Permitir" (aberto pelo navegador do cliente, sem login do painel).
  if (req.method === 'GET' && (u.searchParams.has('code') || u.searchParams.has('error'))) {
    if (u.searchParams.get('error')) return pagina('cancelado');
    const code = (u.searchParams.get('code') ?? '').replace(/#_$/, '');
    const clienteId = await lerEstado(u.searchParams.get('state') ?? '');
    if (!code || !clienteId) return pagina('invalido');
    try {
      const nome = await guardarConexao(clienteId, code);
      return pagina('ok', nome);
    } catch (e) {
      console.log('erro na conexão', (e as Error).message);
      return pagina('falha');
    }
  }

  // Leituras agendadas: só com a chave guardada na tabela ig_cron.
  const chaveCron = req.headers.get('x-cron-key');
  if (chaveCron) {
    const { data: ok } = await admin.from('ig_cron').select('chave').eq('chave', chaveCron).maybeSingle();
    if (!ok) return json({ erro: 'Sem permissão' }, 403);
    try {
      const { acao } = await req.json();
      if (acao === 'cron-stories') return json({ resumo: await paraCadaCliente(lerStories) });
      if (acao === 'cron-mes') return json({ resumo: await paraCadaCliente(async (id) => { for (const mes of mesesRecentes()) await sincronizar(id, mes); }) });
      return json({ erro: 'Ação desconhecida' }, 400);
    } catch (e) {
      return json({ erro: (e as Error).message }, 400);
    }
  }

  // Ações do painel: precisa estar logada e ser sócia.
  const sb = createClient(SUPA, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ erro: 'Sem login' }, 401);
  const { data: socia } = await sb.rpc('eh_socia');
  if (!socia) return json({ erro: 'Sem permissão' }, 403);
  if (!APP_ID || !APP_SECRET) return json({ configurado: false });

  try {
    const { acao, ...d } = await req.json();
    if (acao === 'url') {
      const estado = await criarEstado(String(d.clienteId));
      const link = `https://www.instagram.com/oauth/authorize?${new URLSearchParams({ client_id: APP_ID, redirect_uri: RETORNO, response_type: 'code', scope: d.publicar ? SCOPES_PUBLICAR : SCOPES, state: estado, force_reauth: 'true' })}`;
      return json({ configurado: true, url: link });
    }
    // TESTE só com a conta @bodhi.mkt: cria o "rascunho" de uma imagem em branco e NÃO publica. Aqui não existe chamada media_publish.
    if (acao === 'teste-rascunho') {
      const { data: c } = await admin.from('ig_conexoes').select('*').eq('username', 'bodhi.mkt').maybeSingle();
      if (!c) return json({ erro: 'A conta @bodhi.mkt não está conectada.' }, 400);
      const token = await tokenValido(c);
      const q = consulta(token);
      const posts = async () => ((await pegar(`${GRAPH}/me/media?${q({ fields: 'id,timestamp', limit: '5' })}`)).data ?? []).map((x: any) => x.id);
      const antes = await posts();
      const rascunho = await pegar(`${GRAPH}/${c.ig_user_id}/media`, { method: 'POST', body: new URLSearchParams({ image_url: 'https://painel.bodhi.marketing/assets/teste-branco.jpg', access_token: token }) });
      let situacao = '';
      try { situacao = (await pegar(`${GRAPH}/${rascunho.id}?${q({ fields: 'status_code' })}`)).status_code ?? ''; } catch { /* a situação é só informação extra */ }
      const depois = await posts();
      return json({ configurado: true, rascunho: rascunho.id, situacao, novosPosts: depois.filter((id: string) => !antes.includes(id)).length });
    }
    if (acao === 'sincronizar') return json({ configurado: true, ...(await sincronizar(String(d.clienteId), String(d.mes))) });
    if (acao === 'stories') return json({ configurado: true, ...(await lerStories(String(d.clienteId))) });
    if (acao === 'perfil') return json({ configurado: true, perfil: await perfilAtual(String(d.clienteId)) });
    return json({ erro: 'Ação desconhecida' }, 400);
  } catch (e) {
    return json({ erro: (e as Error).message }, 400);
  }
});
