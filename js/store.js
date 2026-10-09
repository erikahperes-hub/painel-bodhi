import { config } from './config.js?v=62';
import { uid } from './util.js?v=62';

const KINDS = ['cliente', 'proposta', 'contrato', 'pendencia', 'lancamento', 'processo', 'conteudo', 'config'];
const LS_KEY = 'bodhi.painel.v1';
const SB_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const NOMES_CONHECIDOS = { 'erikahperes@gmail.com': 'Érika' };
const db = Object.fromEntries(KINDS.map((k) => [k, {}]));
const ouvintes = new Set();
let sb = null;
let assinatura = '';

const avisar = () => ouvintes.forEach((fn) => fn());

function erroAmigavel(error, acao) {
  console.error('Erro do Supabase ao ' + acao, error);
  const cod = error?.code || error?.status || '';
  const msg = String(error?.message || '');
  let dica = 'Confira a conexão e tente de novo.';
  if (cod === '42501' || /row-level security|permission denied/i.test(msg)) dica = 'Seu e-mail não tem permissão para editar. Confira se ele está na lista de sócias do banco.';
  else if (/jwt|token|expired|401/i.test(msg + cod)) dica = 'Sua sessão expirou. Saia e entre de novo.';
  else if (/fetch|network|failed/i.test(msg)) dica = 'Sem conexão com o banco agora.';
  return new Error(`Não foi possível ${acao}. ${dica} (código: ${cod || 'sem código'}${msg ? ', ' + msg.slice(0, 80) : ''})`);
}
function erroLogin(error) {
  console.error('Erro de login', error);
  const msg = String(error?.message || '');
  const cod = String(error?.code || '');
  const tec = ` (${[error?.status, cod, msg].filter(Boolean).join(', ').slice(0, 120)})`;
  if (/invalid login|invalid_credentials/i.test(msg + cod)) return 'E-mail ou senha incorretos. Toque em “Mostrar” para conferir a senha, ou use “Esqueci minha senha”.';
  if (/not confirmed|email_not_confirmed/i.test(msg + cod)) return 'Este e-mail ainda não foi confirmado. Abra o e-mail de confirmação do Supabase e clique no link.' + tec;
  if (/rate limit|too many|over_request_rate_limit|429/i.test(msg + cod + error?.status)) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.' + tec;
  if (/fetch|network|failed|load failed/i.test(msg)) return 'Sem conexão com o servidor agora. Confira a internet e tente de novo.' + tec;
  if (/banned|disabled|not allowed/i.test(msg + cod)) return 'Este acesso está desativado no Supabase.' + tec;
  return 'Não foi possível entrar.' + tec;
}
const vazio = () => KINDS.every((k) => !Object.keys(db[k]).length);

const vazioValor = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);

function unirDocumentos(a = [], b = []) {
  const vistos = new Set();
  return [...a, ...b].filter((d) => d.url && !vistos.has(d.url) && vistos.add(d.url));
}

// "preencher": só completa o que está vazio na ficha atual, sem trocar nada que já existe.
function preencherDados(atual, novo) {
  const out = { ...atual };
  for (const [k, v] of Object.entries(novo)) {
    if (k === 'documentos') continue;
    if (vazioValor(out[k])) out[k] = v;
    else if (out[k] && typeof out[k] === 'object' && !Array.isArray(out[k]) && v && typeof v === 'object' && !Array.isArray(v)) out[k] = preencherDados(out[k], v);
  }
  if (atual.documentos || novo.documentos) out.documentos = unirDocumentos(atual.documentos, novo.documentos);
  return out;
}

// "mesclar": os campos do arquivo passam por cima, e os documentos são somados.
function mesclarDados(atual, novo) {
  const out = { ...atual, ...novo };
  if (atual.documentos || novo.documentos) out.documentos = unirDocumentos(atual.documentos, novo.documentos);
  return out;
}

function limpar() { KINDS.forEach((k) => (db[k] = {})); }

function carregarRegistros(lista) {
  limpar();
  (lista || []).forEach((r) => {
    if (db[r.kind]) db[r.kind][r.id] = { ...r.data, id: r.id };
  });
  assinatura = JSON.stringify(db);
}

function salvarLocal() {
  try {
    const registros = KINDS.flatMap((k) => Object.values(db[k]).map((d) => ({ kind: k, id: d.id, data: d })));
    localStorage.setItem(LS_KEY, JSON.stringify({ registros }));
  } catch { /* navegador sem armazenamento */ }
}

export const store = {
  // Em localhost, adicionar ?local à URL usa os dados de teste do navegador em vez do Supabase.
  modo: config.supabaseUrl && config.supabaseKey && !(location.hostname === 'localhost' && location.search.includes('local')) ? 'supabase' : 'local',
  usuario: null,

  ouvir(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },

  async iniciar() {
    if (this.modo === 'supabase') {
      // O link do e-mail de “Esqueci minha senha” chega com type=recovery no endereço; guardamos antes de o Supabase limpar.
      this.recuperando = /[#&?]type=recovery/.test(location.hash + location.search);
      const { createClient } = await import(SB_CDN);
      sb = createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
      const { data } = await sb.auth.getSession();
      this.usuario = data.session?.user || null;
      sb.auth.onAuthStateChange((_e, sess) => { this.usuario = sess?.user || null; });
      if (!this.usuario) return 'login';
      if (this.recuperando) return 'nova-senha';
      await this.recarregar(true);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.recarregar(); });
      return 'pronto';
    }
    // Modo local: dados no próprio navegador, alimentados por seed/seed.json (arquivo que fica só neste computador).
    try {
      const salvo = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (salvo?.registros?.length) { carregarRegistros(salvo.registros); return 'pronto'; }
    } catch { /* segue para o seed */ }
    try {
      const r = await fetch('seed/seed.json', { cache: 'no-store' });
      if (r.ok) { carregarRegistros((await r.json()).registros); salvarLocal(); return 'pronto'; }
    } catch { /* sem seed */ }
    return 'configurar';
  },

  async entrar(email, senha) {
    // Teclados de celular costumam pôr maiúscula no começo do e-mail ou deixar um espaço no fim da senha.
    // Se o primeiro envio for recusado por "senha incorreta", tentamos essas variações antes de desistir.
    const emailLimpo = String(email || '').trim();
    const tentativas = [[emailLimpo, senha]];
    const minusculo = emailLimpo.toLowerCase();
    const senhaSemEspacoFinal = String(senha || '').replace(/\s+$/, '');
    if (minusculo !== emailLimpo) tentativas.push([minusculo, senha]);
    if (senhaSemEspacoFinal !== senha) {
      tentativas.push([emailLimpo, senhaSemEspacoFinal]);
      if (minusculo !== emailLimpo) tentativas.push([minusculo, senhaSemEspacoFinal]);
    }
    let falha = null;
    for (const [e, p] of tentativas) {
      const { error } = await sb.auth.signInWithPassword({ email: e, password: p });
      if (!error) { falha = null; break; }
      falha = error;
      if (!/invalid login|invalid_credentials/i.test(String(error.message || '') + String(error.code || ''))) break;
    }
    if (falha) throw new Error(erroLogin(falha));
    const { data } = await sb.auth.getUser();
    this.usuario = data.user;
    await this.recarregar(true);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.recarregar(); });
  },

  async definirSenha(nova) {
    if (!sb) throw new Error('Não foi possível trocar a senha agora.');
    const { error } = await sb.auth.updateUser({ password: nova });
    if (error) {
      console.error('Erro ao trocar a senha', error);
      throw new Error(/same|different/i.test(String(error.message)) ? 'A nova senha precisa ser diferente da anterior.' : /weak|short|least/i.test(String(error.message)) ? 'A senha é fraca ou curta demais. Use pelo menos 8 caracteres.' : 'Não foi possível trocar a senha agora. Peça um novo link em “Esqueci minha senha”.');
    }
    this.recuperando = false;
  },

  async recuperarSenha(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw new Error('Não foi possível enviar o e-mail agora.');
  },

  async sair() {
    if (sb) await sb.auth.signOut();
    location.reload();
  },

  async recarregar(silencioso = false) {
    if (!sb) return;
    const { data, error } = await sb.from('records').select('kind,id,data');
    if (error) { if (!silencioso) throw error; return; }
    const antes = assinatura;
    carregarRegistros(data);
    if (assinatura !== antes) avisar();
  },

  // Link de aprovação do cliente: um código longo e sem relação com o cliente, que só abre as peças dele.
  async linkAprovacao(clienteId, renovar = false) {
    if (!sb) throw new Error('O link de aprovação funciona só no painel publicado, conectado ao Supabase.');
    const falha = (error) => {
      if (/aprovacao_links|42P01|PGRST205/i.test(`${error.code} ${error.message}`)) return new Error('Falta ativar a aprovação no Supabase: rode o arquivo supabase/aprovacao.sql no SQL Editor (passo no LEIA-ME).');
      return erroAmigavel(error, 'gerar o link de aprovação');
    };
    if (renovar) {
      const { error } = await sb.from('aprovacao_links').update({ ativo: false }).eq('cliente_id', clienteId);
      if (error) throw falha(error);
    } else {
      const { data, error } = await sb.from('aprovacao_links').select('token').eq('cliente_id', clienteId).eq('ativo', true).limit(1);
      if (error) throw falha(error);
      if (data?.length) return data[0].token;
    }
    const token = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');
    const { error } = await sb.from('aprovacao_links').insert({ token, cliente_id: clienteId });
    if (error) throw falha(error);
    return token;
  },

  supabase: () => sb,
  emailUsuario() { return this.usuario?.email || ''; },

  nomeUsuario() {
    if (this.modo === 'local') return '';
    return this.usuario?.user_metadata?.nome || NOMES_CONHECIDOS[(this.usuario?.email || '').toLowerCase()] || '';
  },

  async definirNome(nome) {
    const limpo = String(nome || '').trim().slice(0, 40);
    if (!limpo || !sb) return;
    const { data, error } = await sb.auth.updateUser({ data: { nome: limpo } });
    if (error) throw new Error('Não foi possível salvar seu nome agora.');
    this.usuario = data.user;
    avisar();
  },

  todos(kind) { return Object.values(db[kind] || {}); },
  obter(kind, id) { return db[kind]?.[id] || null; },

  async salvar(kind, obj) {
    const item = { ...obj, id: obj.id || uid(kind[0]), atualizadoEm: new Date().toISOString() };
    if (sb) {
      const { error } = await sb.from('records').upsert({ kind, id: item.id, data: item, updated_by: this.emailUsuario() });
      if (error) throw erroAmigavel(error, 'salvar');
    }
    db[kind][item.id] = item;
    assinatura = JSON.stringify(db);
    if (!sb) salvarLocal();
    avisar();
    return item;
  },

  async remover(kind, id) {
    if (sb) {
      const { error } = await sb.from('records').delete().eq('kind', kind).eq('id', id);
      if (error) throw erroAmigavel(error, 'excluir');
    }
    delete db[kind][id];
    assinatura = JSON.stringify(db);
    if (!sb) salvarLocal();
    avisar();
  },

  cfg(id, padrao = {}) { return { ...padrao, ...(db.config[id] || {}) }; },
  async salvarCfg(id, dados) { return this.salvar('config', { ...(db.config[id] || {}), ...dados, id }); },

  exportar() {
    return { versao: 1, exportadoEm: new Date().toISOString(), registros: KINDS.flatMap((k) => Object.values(db[k]).map((d) => ({ kind: k, id: d.id, data: d }))) };
  },

  async importar(obj) {
    const lista = obj?.registros;
    if (!Array.isArray(lista)) throw new Error('Arquivo de backup inválido.');
    for (const r of lista) {
      if (!db[r.kind]) continue;
      const atual = db[r.kind][r.id];
      // "mesclar": acrescenta ao registro que já existe (e une os documentos por link) em vez de substituir.
      const dados = !r.mesclar || !atual ? r.data : r.mesclar === 'preencher' ? preencherDados(atual, r.data) : mesclarDados(atual, r.data);
      await this.salvar(r.kind, { ...dados, id: r.id });
    }
  },

  vazio,
};
