import { store } from './store.js?v=13';
import { config } from './config.js?v=13';

// A chave do Asaas nunca fica neste site: ela fica guardada no servidor (função "asaas" do Supabase).
let cache = null;

async function chamar(acao, dados = {}) {
  const sb = store.supabase();
  if (!sb) throw new Error('semBanco');
  const { data, error } = await sb.functions.invoke(config.asaasFunction, { body: { acao, ...dados } });
  if (error) throw new Error('funcao');
  if (data?.erro) throw new Error(data.erro);
  return data;
}

export const asaas = {
  // 'sem-banco' | 'nao-configurado' | 'erro' | 'conectado'
  async resumo(forcar = false) {
    if (store.modo !== 'supabase') return { estado: 'sem-banco' };
    if (cache && !forcar && Date.now() - cache.em < 60000) return cache.dados;
    try {
      const d = await chamar('resumo');
      const dados = d.configurado === false ? { estado: 'nao-configurado' } : { estado: 'conectado', ...d };
      cache = { em: Date.now(), dados };
      return dados;
    } catch (e) {
      return { estado: e.message === 'semBanco' ? 'sem-banco' : 'erro', mensagem: e.message };
    }
  },
  async criarCobranca(dados) {
    const r = await chamar('criar', dados);
    cache = null;
    return r;
  },
  limpar() { cache = null; },
};
