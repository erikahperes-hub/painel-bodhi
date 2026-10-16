import { store } from './store.js?v=88';
import { config } from './config.js?v=88';

// Conversa com a função "instagram" do Supabase. Os tokens dos clientes ficam só no servidor (tabela ig_conexoes);
// aqui o painel nunca vê token nenhum, só pede o link de autorização, manda sincronizar e lê quem está conectado.
let conectados = null; // lista de { clienteId, username, expiraEm, ultimoErro, ultimaLeitura }; null = ainda não carregou
const cacheStories = {}; // `${clienteId}` -> { em, lista }

async function chamar(acao, dados = {}) {
  const sb = store.supabase();
  if (!sb) throw new Error('O Instagram só funciona no painel online, com login.');
  const { data, error } = await sb.functions.invoke(config.instagramFunction || 'instagram', { body: { acao, ...dados } });
  if (error) {
    let msg = '';
    try { msg = (await error.context?.json?.())?.erro || ''; } catch { /* sem detalhe */ }
    throw new Error(msg || 'Não consegui falar com a função do Instagram. Confira se ela foi publicada no Supabase (supabase/functions/instagram).');
  }
  if (data?.erro) throw new Error(data.erro);
  if (data?.configurado === false) throw new Error('Faltam os segredos IG_APP_ID e IG_APP_SECRET na função instagram do Supabase (Edge Functions, Secrets).');
  return data;
}

export const igApi = {
  disponivel: () => store.modo === 'supabase',
  carregado: () => conectados !== null,
  conexoes: () => conectados || [],
  async status(forcar = false) {
    if (store.modo !== 'supabase') return [];
    if (conectados && !forcar) return conectados;
    const { data, error } = await store.supabase().rpc('ig_status');
    conectados = error ? [] : data || [];
    return conectados;
  },
  conexao: (clienteId) => (conectados || []).find((c) => c.clienteId === clienteId) || null,
  async linkConectar(clienteId) { return (await chamar('url', { clienteId })).url; },
  async sincronizar(clienteId, mes) {
    const r = await chamar('sincronizar', { clienteId, mes });
    await store.recarregar(true);
    return r;
  },
  // Lê agora os stories ativos do cliente (a leitura automática faz isso de 3 em 3 horas).
  async lerStories(clienteId) {
    const r = await chamar('stories', { clienteId });
    delete cacheStories[clienteId];
    return r;
  },
  // Stories já guardados do cliente (últimos 14 meses). Cada item: { id, publicadoEm, dados }.
  async stories(clienteId, forcar = false) {
    if (store.modo !== 'supabase') return [];
    const c = cacheStories[clienteId];
    if (c && !forcar && Date.now() - c.em < 60000) return c.lista;
    const desde = new Date(Date.now() - 14 * 30 * 864e5).toISOString();
    const { data, error } = await store.supabase().from('ig_stories').select('story_id,publicado_em,dados').eq('cliente_id', clienteId).gte('publicado_em', desde).order('publicado_em');
    const lista = error ? [] : (data || []).map((s) => ({ id: s.story_id, publicadoEm: s.publicado_em, dados: s.dados || {} }));
    cacheStories[clienteId] = { em: Date.now(), lista };
    return lista;
  },
  // Stories já carregados do cliente (sem ir ao banco; vazio até a primeira leitura de igApi.stories).
  storiesGuardadas: (clienteId) => cacheStories[clienteId]?.lista || [],
  // Link do relatório para o cliente abrir (só vê o relatório dele). Com renovar, o link antigo deixa de funcionar.
  async linkRelatorio(clienteId, renovar = false) {
    const sb = store.supabase();
    if (!sb) throw new Error('O link do relatório só funciona no painel online, com login.');
    const { data, error } = await sb.rpc('relatorio_link', { p_cliente: clienteId, p_renovar: renovar });
    if (error || !data) throw new Error('Não consegui criar o link. Confira se o arquivo supabase/relatorio.sql foi rodado no Supabase.');
    return `${location.origin}/relatorio.html#${data}`;
  },
};
