// Função segura que conversa com o Instagram (API do Instagram com login do Instagram).
// Segredos no servidor (Edge Functions > Secrets): IG_APP_ID e IG_APP_SECRET. Nada disso vai para o site.
// IMPORTANTE: ao publicar esta função, DESLIGUE "Verify JWT" (o retorno do Instagram chega sem login do painel).
// As ações do painel (POST) conferem o login e a lista de sócias aqui dentro.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const pagina = (titulo: string, texto: string) =>
  new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>
<body style="font-family:system-ui,sans-serif;background:#FFFCF6;color:#16301f;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center">
<div><h1 style="font-size:24px">${titulo}</h1><p style="max-width:420px;line-height:1.5">${texto}</p></div></body>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

const APP_ID = Deno.env.get('IG_APP_ID') ?? '';
const APP_SECRET = Deno.env.get('IG_APP_SECRET') ?? '';
const SUPA = Deno.env.get('SUPABASE_URL')!;
const RETORNO = `${SUPA}/functions/v1/instagram`; // este endereço exato é cadastrado no app da Meta
const GRAPH = 'https://graph.instagram.com/v23.0';
const SCOPES = 'instagram_business_basic,instagram_business_manage_insights';
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

const unix = (d: Date) => Math.floor(d.getTime() / 1000);
const tipoDe = (m: any) => (m.media_product_type === 'REELS' ? 'Reels' : m.media_type === 'CAROUSEL_ALBUM' ? 'Carrossel' : m.media_type === 'VIDEO' ? 'Reels' : 'Estático');

async function sincronizar(clienteId: string, mes: string) {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error('Mês inválido.');
  const { data: c } = await admin.from('ig_conexoes').select('*').eq('cliente_id', clienteId).maybeSingle();
  if (!c) throw new Error('Este cliente ainda não conectou o Instagram.');
  const token = await tokenValido(c);
  const [a, m] = mes.split('-').map(Number);
  const ini = new Date(Date.UTC(a, m - 1, 1));
  const fimMes = new Date(Date.UTC(a, m, 1)); // primeiro dia do mês seguinte
  // O Instagram aceita no máximo 30 dias por consulta de insights: em meses de 31 dias o último dia fica de fora.
  const fimConsulta = new Date(Math.min(fimMes.getTime(), ini.getTime() + 30 * 864e5));
  const agora = Date.now();
  const q = (p: Record<string, string>) => new URLSearchParams({ ...p, access_token: token }).toString();

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
    let ins: Record<string, number> = {};
    for (const lista of ['reach,views,saved,shares,total_interactions', 'reach,total_interactions', 'reach']) {
      try {
        const r = await pegar(`${GRAPH}/${x.id}/insights?${q({ metric: lista })}`);
        for (const d of r.data ?? []) ins[d.name] = d.values?.[0]?.value ?? d.total_value?.value ?? 0;
        break;
      } catch { /* tenta com menos métricas */ }
    }
    detalhes.push({
      data: String(x.timestamp).slice(0, 10), tipo: tipoDe(x), legenda: x.caption ?? '', link: x.permalink ?? '',
      alcance: ins.reach ?? null, visualizacoes: ins.views ?? null, interacoes: ins.total_interactions ?? null,
      salvamentos: ins.saved ?? null, compartilhamentos: ins.shares ?? null, curtidas: x.like_count ?? null, comentarios: x.comments_count ?? null,
    });
  }

  const id = `${clienteId}_${mes}`;
  const { data: antigo } = await admin.from('records').select('data').eq('kind', 'insights').eq('id', id).maybeSingle();
  const dado = {
    ...(antigo?.data ?? {}), id, clienteId, mes, rede: 'instagram', fonte: 'instagram', atualizadoEm: new Date().toISOString(),
    seguidores: perfil.followers_count ?? null, ...(ganhos !== undefined ? { seguidoresGanhos: ganhos } : {}),
    alcance: total.reach ?? null, visualizacoes: total.views ?? null, interacoes: total.total_interactions ?? null,
    visitasPerfil: total.profile_views ?? null, contasEngajadas: total.accounts_engaged ?? null, posts: detalhes,
  };
  const { error } = await admin.from('records').upsert({ kind: 'insights', id, data: dado, updated_by: 'instagram' });
  if (error) throw new Error(error.message);
  return { mes, publicacoes: detalhes.length, username: perfil.username };
}

/* ---------- entrada ---------- */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const u = new URL(req.url);

  // Retorno do Instagram depois que o dono da conta toca em "Permitir" (aberto pelo navegador do cliente, sem login do painel).
  if (req.method === 'GET' && (u.searchParams.has('code') || u.searchParams.has('error'))) {
    if (u.searchParams.get('error')) return pagina('Conexão cancelada', 'Nada foi conectado. Se foi sem querer, peça à Bôdhi Marketing um novo link.');
    const code = (u.searchParams.get('code') ?? '').replace(/#_$/, '');
    const clienteId = await lerEstado(u.searchParams.get('state') ?? '');
    if (!code || !clienteId) return pagina('Link inválido ou vencido', 'Peça à Bôdhi Marketing um novo link de conexão.');
    try {
      const nome = await guardarConexao(clienteId, code);
      return pagina('Instagram conectado', `A conta @${nome} foi conectada. A Bôdhi Marketing só lê os números de desempenho. Você pode fechar esta página e, se quiser, remover a permissão a qualquer momento em Configurações do Instagram, Apps e sites.`);
    } catch (e) {
      console.log('erro na conexão', (e as Error).message);
      return pagina('Não foi possível conectar', 'Tente de novo em alguns minutos ou peça um novo link à Bôdhi Marketing.');
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
      const link = `https://www.instagram.com/oauth/authorize?${new URLSearchParams({ client_id: APP_ID, redirect_uri: RETORNO, response_type: 'code', scope: SCOPES, state: estado, force_reauth: 'true' })}`;
      return json({ configurado: true, url: link });
    }
    if (acao === 'sincronizar') return json({ configurado: true, ...(await sincronizar(String(d.clienteId), String(d.mes))) });
    return json({ erro: 'Ação desconhecida' }, 400);
  } catch (e) {
    return json({ erro: (e as Error).message }, 400);
  }
});
