import { store } from './store.js?v=83';
import { config } from './config.js?v=83';

// Conversa com a função "instagram" do Supabase. Os tokens dos clientes ficam só no servidor (tabela ig_conexoes);
// aqui o painel nunca vê token nenhum, só pede o link de autorização, manda sincronizar e lê quem está conectado.
let conectados = null; // lista de { clienteId, username, expiraEm }; null = ainda não carregou

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
};
