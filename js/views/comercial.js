import { store } from '../store.js';
import { metricas } from '../calc.js';
import { brl, esc, toast } from '../util.js';
import { ic } from '../icons.js';
import { formulario, confirmar } from '../ui.js';

// Nome antigo do motivo, ainda salvo em alguns bancos, exibido com o termo novo.
const titulo = (t) => (t === 'Financeiro do cliente' ? 'Problemas financeiros' : t);
const NIVEL = { 'Mais comum': 'warn', Comum: 'info', Raro: 'mute' };

function abrirPendencia(p = null) {
  formulario({
    titulo: p ? 'Editar pendência' : 'Nova pendência',
    campos: [
      { nome: 'titulo', rotulo: 'O que precisa ser feito', obrigatorio: true, cheio: true },
      { nome: 'texto', rotulo: 'Detalhes', tipo: 'area', cheio: true, linhas: 3 },
      { nome: 'destaque', tipo: 'checkbox', rotulo: 'Mostrar em “Pede atenção” na tela inicial', cheio: true },
    ],
    valores: p || { destaque: false },
    async aoSalvar(v) { await store.salvar('pendencia', { ...(p || {}), ...v, feito: p?.feito || false }); toast('Pendência salva'); },
    aoExcluir: p ? async (m) => {
      if (await confirmar('Excluir esta pendência?', 'Excluir', true)) { await store.remover('pendencia', p.id); m.fechar(); }
    } : null,
  });
}

export default {
  titulo: () => 'Comercial',
  sub: () => 'Clientes, de onde eles vêm e o que falta para crescer.',

  render() {
    const m = metricas();
    const cfg = store.cfg('comercial', { canais: [], perfilAlvo: [], saidas: [], historico: '' });
    const clientes = [...m.ativos, ...m.encerrando];
    const pend = store.todos('pendencia').sort((a, b) => Number(a.feito) - Number(b.feito) || (a.criadoEm || '').localeCompare(b.criadoEm || ''));

    return `<div class="grid">
      <div class="card c4">
        <div class="card-h"><div><h2>Clientes ativos</h2><p class="sub">Situação de cada contrato em vigor</p></div><button class="btn sec sm" data-act="ir" data-rota="clientes">Ver fichas</button></div>
        <div class="list">${clientes.map((c) => `<div class="li click" data-act="ir" data-rota="clientes" data-ref="${c.id}">
          <span class="li-ic ${c.status === 'encerrando' ? 'ic-coral' : 'ic-verde'}">${ic('users')}</span>
          <div class="li-t"><b>${esc(c.nome)} <span class="chip ${c.status === 'encerrando' ? 'warn' : 'ok'}" style="margin-left:6px">${c.status === 'encerrando' ? 'Encerrando' : 'Ativo'}</span></b><span>${esc(c.resumo || c.origem || '')}</span></div>
          <div class="li-r num"><b style="font:700 16px var(--ui)">${brl(c.mensalidade)}</b><br><small class="lbl">por mês</small></div></div>`).join('')}</div>
        <div class="hintbox">${m.encerrando.length ? `Depois do encerramento de ${esc(m.encerrando.map((c) => c.nome).join(' e '))}, ficam ${m.ativos.length} clientes fixos: ${esc(m.ativos.map((c) => c.nome).join(' e '))}.` : `${m.ativos.length} clientes fixos hoje.`}</div>
      </div>

      <div class="card c2">
        <div class="card-h"><div><h2>Como chegam os clientes</h2><p class="sub">Canais ativos hoje</p></div><button class="btn ghost sm" data-act="editar-canais" aria-label="Editar">${ic('edit')}</button></div>
        <ul class="bullets">${cfg.canais.map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="lbl">Sem canais cadastrados</li>'}</ul>
        <p class="sub" style="margin-top:18px">Perfil-alvo</p>
        <ul class="bullets">${cfg.perfilAlvo.map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="lbl">Sem perfil cadastrado</li>'}</ul>
      </div>

      <div class="card c2">
        <div class="card-h"><div><h2>Próximos passos comerciais</h2><p class="sub">Sua lista viva de pendências</p></div><button class="btn sec sm" data-act="nova-pendencia">${ic('plus')}Adicionar</button></div>
        <div class="list">${pend.map((p) => `<div class="li"><button class="iconbtn" data-act="alternar-pendencia" data-id="${p.id}" aria-label="${p.feito ? 'Reabrir' : 'Concluir'}" style="width:38px;height:38px;font-size:17px;box-shadow:none;border:1.5px solid ${p.feito ? 'var(--verde)' : 'var(--line)'};background:${p.feito ? 'var(--verde)' : '#fff'};color:${p.feito ? '#0B3B2B' : 'transparent'}">${ic('check')}</button>
          <div class="li-t" style="${p.feito ? 'opacity:.55;text-decoration:line-through' : ''}"><b>${esc(p.titulo)}</b>${p.texto ? `<span>${esc(p.texto)}</span>` : ''}</div>
          <button class="btn ghost sm" data-act="editar-pendencia" data-id="${p.id}" aria-label="Editar">${ic('edit')}</button></div>`).join('') || '<p class="lbl">Nada pendente. Use “Adicionar” para registrar o próximo passo.</p>'}</div>
      </div>

      <div class="card c4">
        <div class="card-h"><div><h2>Por que os clientes saem</h2><p class="sub">Padrão do histórico: não é qualidade de entrega, é o perfil financeiro do cliente</p></div><button class="btn ghost sm" data-act="editar-saidas" aria-label="Editar">${ic('edit')}</button></div>
        <div class="list">${cfg.saidas.map((s) => `<div class="li" style="align-items:flex-start"><span class="chip ${NIVEL[s.nivel] || 'mute'}" style="margin-top:2px;min-width:92px;justify-content:center">${esc(s.nivel)}</span><div class="li-t"><b>${esc(titulo(s.titulo))}</b><span>${esc(s.texto)}</span></div></div>`).join('') || '<p class="lbl">Sem registros.</p>'}</div>
        ${cfg.historico ? `<details style="margin-top:14px"><summary style="cursor:pointer;font:700 14px var(--ui);color:var(--petroleo)">Ver histórico completo de clientes anteriores</summary><p style="margin-top:10px;color:var(--ink-2)">${esc(cfg.historico)}</p></details>` : ''}
      </div>
    </div>`;
  },

  acoes: {
    'nova-pendencia': () => abrirPendencia(),
    'editar-pendencia': (el) => abrirPendencia(store.obter('pendencia', el.dataset.id)),
    'alternar-pendencia': async (el) => {
      const p = store.obter('pendencia', el.dataset.id);
      await store.salvar('pendencia', { ...p, feito: !p.feito });
    },
    'editar-canais': () => {
      const cfg = store.cfg('comercial', {});
      formulario({
        titulo: 'Como chegam os clientes',
        campos: [
          { nome: 'canais', rotulo: 'Canais ativos hoje', tipo: 'lista', cheio: true },
          { nome: 'perfilAlvo', rotulo: 'Perfil-alvo', tipo: 'lista', cheio: true },
        ],
        valores: cfg,
        async aoSalvar(v) { await store.salvarCfg('comercial', v); toast('Salvo'); },
      });
    },
    'editar-saidas': () => {
      const cfg = store.cfg('comercial', {});
      formulario({
        titulo: 'Por que os clientes saem', largo: true,
        campos: [
          { nome: 'saidas', rotulo: 'Motivos', tipo: 'lista', cheio: true, linhas: 8, ajuda: 'Um por linha, neste formato: Nível | Título | Texto. Níveis: Mais comum, Comum, Raro.' },
          { nome: 'historico', rotulo: 'Histórico de clientes anteriores', tipo: 'area', cheio: true, linhas: 5 },
        ],
        valores: { saidas: (cfg.saidas || []).map((s) => `${s.nivel} | ${titulo(s.titulo)} | ${s.texto}`), historico: cfg.historico },
        async aoSalvar(v) {
          const saidas = v.saidas.map((l) => { const [nivel, titulo, ...resto] = l.split('|').map((x) => x.trim()); return { nivel: nivel || 'Comum', titulo: titulo || '', texto: resto.join(' | ') }; });
          await store.salvarCfg('comercial', { saidas, historico: v.historico });
          toast('Salvo');
        },
      });
    },
  },
};
