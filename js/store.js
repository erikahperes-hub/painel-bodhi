import { config } from './config.js';
import { uid } from './util.js';

const KINDS = ['cliente', 'proposta', 'contrato', 'pendencia', 'config'];
const LS_KEY = 'bodhi.painel.v1';
const SB_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const NOMES_CONHECIDOS = { 'erikahperes@gmail.com': 'Érika' };
const db = Object.fromEntries(KINDS.map((k) => [k, {}]));
const ouvintes = new Set();
let sb = null;
let assinatura = '';

const avisar = () => ouvintes.forEach((fn) => fn());
const vazio = () => KINDS.every((k) => !Object.keys(db[k]).length);

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
  modo: config.supabaseUrl && config.supabaseKey ? 'supabase' : 'local',
  usuario: null,

  ouvir(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },

  async iniciar() {
    if (this.modo === 'supabase') {
      const { createClient } = await import(SB_CDN);
      sb = createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
      const { data } = await sb.auth.getSession();
      this.usuario = data.session?.user || null;
      sb.auth.onAuthStateChange((_e, sess) => { this.usuario = sess?.user || null; });
      if (!this.usuario) return 'login';
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
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(error.message.includes('Invalid login') ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Tente de novo.');
    const { data } = await sb.auth.getUser();
    this.usuario = data.user;
    await this.recarregar(true);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.recarregar(); });
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
      if (error) throw new Error('Não foi possível salvar agora. Confira a conexão e tente de novo.');
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
      if (error) throw new Error('Não foi possível excluir agora.');
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
    for (const r of lista) if (db[r.kind]) await this.salvar(r.kind, { ...r.data, id: r.id });
  },

  vazio,
};
