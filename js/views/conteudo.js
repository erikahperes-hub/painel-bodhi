import { store } from '../store.js?v=15';
import { esc, toast, dataBR, urlSegura } from '../util.js?v=15';
import { ic, flor } from '../icons.js?v=15';
import { formulario, confirmar } from '../ui.js?v=15';
import { ETAPAS, FORMATOS, etapaDe, atrasada, pecas } from '../conteudo.js?v=15';

const RESPONSAVEIS = ['Érika', 'Milena'];
const PUBLICADAS_VISIVEIS = 10;

// O que fazer em cada etapa: [etapa de destino, texto do botão, estilo].
const PROXIMOS = {
  briefing: [['criacao', 'Iniciar criação']],
  criacao: [['aprovacao', 'Enviar para aprovação']],
  aprovacao: [['aprovado', 'Cliente aprovou', 'verde'], ['ajustes', 'Pediu ajuste', 'sec']],
  ajustes: [['aprovacao', 'Reenviar para aprovação']],
  aprovado: [['publicado', 'Marcar como publicado']],
  publicado: [],
};

const clientesDeTrabalho = () => store.todos('cliente')
  .filter((c) => c.status !== 'inativo')
  .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));

function abrirPeca(p = null, padrao = {}) {
  const clientes = clientesDeTrabalho();
  const atual = p ? store.obter('cliente', p.clienteId) : null;
  if (atual && !clientes.includes(atual)) clientes.push(atual);
  formulario({
    titulo: p ? 'Editar peça' : 'Nova peça de conteúdo',
    subtitulo: 'Cada post, carrossel, reels ou story do cliente vira uma peça acompanhada daqui.',
    largo: true,
    campos: [
      { nome: 'clienteId', rotulo: 'Cliente', tipo: 'select', obrigatorio: true, opcoes: [{ v: '', t: 'Escolha o cliente' }, ...clientes.map((c) => ({ v: c.id, t: c.nome || '(sem nome)' }))] },
      { nome: 'titulo', rotulo: 'Título da peça', obrigatorio: true, placeholder: 'Ex.: Post de lançamento da coleção' },
      { nome: 'formato', rotulo: 'Formato', tipo: 'select', opcoes: Object.entries(FORMATOS).map(([v, f]) => ({ v, t: f.nome })) },
      { nome: 'etapa', rotulo: 'Etapa', tipo: 'select', opcoes: ETAPAS.map((e) => ({ v: e.id, t: e.nome })) },
      { nome: 'publicar', rotulo: 'Data de publicação', tipo: 'data' },
      { nome: 'responsavel', rotulo: 'Responsável', tipo: 'select', opcoes: [{ v: '', t: 'Sem responsável' }, ...RESPONSAVEIS.map((r) => ({ v: r, t: r }))] },
      { nome: 'legenda', rotulo: 'Legenda', tipo: 'area', cheio: true, linhas: 6, ajuda: 'É o texto que o cliente vai ver junto com a arte na hora de aprovar.' },
      { nome: 'link', rotulo: 'Link da arte ou do vídeo', cheio: true, placeholder: 'Cole o link do Canva, do Drive ou de onde estiver', ajuda: 'Quem estiver no painel abre o arquivo por aqui.' },
      { nome: 'ajuste', rotulo: 'Pedido de ajuste do cliente', tipo: 'area', cheio: true, linhas: 3, ajuda: 'O que o cliente pediu para mudar. Aparece em destaque no cartão enquanto estiver em Ajustes.' },
      { nome: 'briefing', rotulo: 'Briefing e observações internas', tipo: 'area', cheio: true, linhas: 3 },
    ],
    valores: p ? { ...p, ...padrao } : { etapa: 'briefing', formato: 'feed', ...padrao },
    async aoSalvar(v) {
      if (v.link && !urlSegura(v.link)) { toast('O link precisa começar com http:// ou https://', true); return false; }
      await store.salvar('conteudo', { ...(p || { criadoEm: new Date().toISOString() }), ...v, link: urlSegura(v.link) });
      toast('Peça salva');
    },
    aoExcluir: p ? async (m) => {
      if (await confirmar(`Excluir a peça “${p.titulo}”?`, 'Excluir', true)) { await store.remover('conteudo', p.id); m.fechar(); toast('Peça excluída'); }
    } : null,
  });
}

function cartao(p, mostrarCliente) {
  const f = FORMATOS[p.formato] || FORMATOS.feed;
  const cli = store.obter('cliente', p.clienteId);
  const meta = [mostrarCliente ? (cli?.nome || 'Cliente removido') : '', p.publicar ? dataBR(p.publicar).slice(0, 5) : 'Sem data', p.responsavel].filter(Boolean).join(' · ');
  const atras = atrasada(p);
  const botoes = (PROXIMOS[p.etapa] || []).map(([para, texto, estilo]) => `<button class="btn ${estilo || 'sec'} sm" data-act="mover-peca" data-id="${p.id}" data-para="${para}">${esc(texto)}</button>`).join('');
  return `<div class="peca">
    <div class="actions" style="gap:6px"><span class="chip info">${ic(f.icone)}${esc(f.nome)}</span>${atras ? '<span class="chip warn">Atrasada</span>' : ''}${p.link && urlSegura(p.link) ? `<a class="chip mute" href="${esc(urlSegura(p.link))}" target="_blank" rel="noopener noreferrer" title="Abrir a arte">${ic('file')}Arte</a>` : ''}</div>
    <button class="peca-t" data-act="editar-peca" data-id="${p.id}">${esc(p.titulo || '(sem título)')}</button>
    <div class="peca-m">${esc(meta)}</div>
    ${p.etapa === 'ajustes' && p.ajuste ? `<div class="peca-aj">${esc(p.ajuste)}</div>` : ''}
    ${botoes ? `<div class="peca-a">${botoes}</div>` : ''}
  </div>`;
}

function ordenarPecas(lista, recentesPrimeiro = false) {
  const dir = recentesPrimeiro ? -1 : 1;
  return [...lista].sort((a, b) => {
    if (!a.publicar && !b.publicar) return 0;
    if (!a.publicar) return 1;
    if (!b.publicar) return -1;
    return dir * a.publicar.localeCompare(b.publicar);
  });
}

export default {
  titulo: () => 'Conteúdo',
  sub: () => 'O que está sendo criado para cada cliente e em que etapa está cada peça.',

  render({ ref }) {
    const clientes = clientesDeTrabalho();
    if (!clientes.length) {
      return `<div class="card empty">${flor()}<h2>Cadastre um cliente primeiro</h2><p>As peças de conteúdo ficam ligadas a um cliente. Cadastre o cliente e volte aqui.</p><button class="btn pri" data-act="ir" data-rota="clientes">Ir para Clientes</button></div>`;
    }
    const filtro = store.obter('cliente', ref) ? ref : '';
    const todas = pecas();
    const lista = filtro ? todas.filter((p) => p.clienteId === filtro) : todas;
    const em = (...ids) => lista.filter((p) => ids.includes(p.etapa));

    const chipsClientes = [`<button class="cbtn ${filtro ? '' : 'on'}" data-act="ir" data-rota="conteudo">Todos · ${todas.length}</button>`,
      ...clientes.map((c) => `<button class="cbtn ${c.id === filtro ? 'on' : ''}" data-act="ir" data-rota="conteudo" data-ref="${c.id}"><i></i>${esc(c.nome || '(sem nome)')} · ${todas.filter((p) => p.clienteId === c.id).length}</button>`)].join('');

    const colunas = ETAPAS.map((e) => {
      let itens = e.id === 'publicado' ? ordenarPecas(em(e.id), true) : ordenarPecas(em(e.id));
      const total = itens.length;
      if (e.id === 'publicado') itens = itens.slice(0, PUBLICADAS_VISIVEIS);
      return `<section class="kol" aria-label="${esc(e.nome)}">
        <div class="kol-h"><span>${esc(e.nome)}</span><b class="chip ${e.chip}">${total}</b></div>
        ${itens.map((p) => cartao(p, !filtro)).join('') || '<div class="kol-vazio">Nada aqui</div>'}
        ${total > itens.length ? `<div class="kol-vazio">E mais ${total - itens.length} publicadas</div>` : ''}
      </section>`;
    }).join('');

    return `<div class="grid" style="margin-bottom:16px">
        <div class="card stat tone-verde"><div><div class="lbl">Em produção</div><div class="big num">${em('briefing', 'criacao').length}</div><div class="hint">Briefing e criação</div></div><span class="stat-ic">${ic('grid')}</span></div>
        <div class="card stat tone-creme"><div><div class="lbl">Aguardando aprovação</div><div class="big num">${em('aprovacao').length}</div><div class="hint">Com o cliente</div></div><span class="stat-ic">${ic('send')}</span></div>
        <div class="card stat tone-coral"><div><div class="lbl">Pedidos de ajuste</div><div class="big num">${em('ajustes').length}</div><div class="hint">Para refazer</div></div><span class="stat-ic">${ic('edit')}</span></div>
        <div class="card stat tone-coral"><div><div class="lbl">Atrasadas</div><div class="big num">${lista.filter(atrasada).length}</div><div class="hint">Passaram da data de publicação</div></div><span class="stat-ic">${ic('calendar')}</span></div>
      </div>

      <div class="card">
        <div class="card-h"><div><h2>${filtro ? esc(store.obter('cliente', filtro).nome) : 'Todos os clientes'}</h2><p class="sub">${lista.length} ${lista.length === 1 ? 'peça' : 'peças'} no total</p></div>
          <button class="btn pri sm" data-act="nova-peca" data-cliente="${esc(filtro)}">${ic('plus')}Nova peça</button></div>
        <div class="cbtns" style="margin-bottom:16px">${chipsClientes}</div>
        ${lista.length ? `<div class="kanban">${colunas}</div>` : `<div class="empty" style="padding:30px 10px">${flor()}<h2>Nenhuma peça ainda</h2><p>Use “Nova peça” para registrar o primeiro post, carrossel, reels ou story.</p></div>`}
      </div>`;
  },

  acoes: {
    'nova-peca': (el) => abrirPeca(null, el.dataset.cliente ? { clienteId: el.dataset.cliente } : {}),
    'editar-peca': (el) => abrirPeca(store.obter('conteudo', el.dataset.id)),
    'mover-peca': async (el) => {
      const p = store.obter('conteudo', el.dataset.id);
      if (!p) return;
      // Ao pedir ajuste, abre a ficha para já anotar o que o cliente pediu.
      if (el.dataset.para === 'ajustes') { abrirPeca(p, { etapa: 'ajustes' }); return; }
      await store.salvar('conteudo', { ...p, etapa: el.dataset.para });
      toast(`Movida para ${etapaDe({ etapa: el.dataset.para }).nome}`);
    },
  },
};
