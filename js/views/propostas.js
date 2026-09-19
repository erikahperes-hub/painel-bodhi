import { store } from '../store.js';
import { metricas, faixaProposta } from '../calc.js';
import { brl, esc, toast, urlSegura } from '../util.js';
import { ic, flor } from '../icons.js';
import { formulario, confirmar } from '../ui.js';
import { gerarProposta } from '../docs/proposta.js';

const STATUS = {
  rascunho: ['mute', 'Rascunho'],
  aguardando: ['info', 'Aguardando retorno'],
  aceita: ['ok', 'Aceita'],
  recusada: ['warn', 'Recusada'],
};

const campos = [
  { nome: 'clienteNome', rotulo: 'Cliente', obrigatorio: true, placeholder: 'Nome do cliente ou do casal' },
  { nome: 'titulo', rotulo: 'Título da proposta', obrigatorio: true, placeholder: 'Gestão de conteúdo para…' },
  { nome: 'resumo', rotulo: 'Resumo em uma linha', cheio: true },
  { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: [{ v: 'recorrente', t: 'Recorrente (mensal)' }, { v: 'avulso', t: 'Avulso (projeto único)' }] },
  { nome: 'status', rotulo: 'Situação', tipo: 'select', opcoes: [{ v: 'rascunho', t: 'Rascunho' }, { v: 'aguardando', t: 'Enviada, aguardando retorno' }, { v: 'aceita', t: 'Aceita' }, { v: 'recusada', t: 'Recusada' }] },
  { nome: 'pacotesModo', rotulo: 'Como os valores se combinam', tipo: 'select', cheio: true,
    opcoes: [{ v: 'soma', t: 'Somam: o cliente contrata todos os itens' }, { v: 'alternativas', t: 'Alternativos: o cliente escolhe um pacote' }] },
  { nome: 'pacotes', rotulo: 'Valores', tipo: 'pacotes', cheio: true, ajuda: 'Preço aparece só na página de Investimento do PDF.' },
  { nome: 'escopo', rotulo: 'Nossa proposta, em poucas linhas', tipo: 'area', cheio: true, linhas: 3 },
  { nome: 'obs', rotulo: 'Observações e condições', tipo: 'area', cheio: true, linhas: 2 },
  { nome: 'arquivoUrl', rotulo: 'Link do arquivo da proposta enviada', cheio: true, placeholder: 'Cole o link do Canva, do Drive…', ajuda: 'Para consultar depois o arquivo exato que foi enviado ao cliente. Se a proposta foi por WhatsApp, guarde o PDF no Drive e cole o link.' },
  { nome: '_pdf', rotulo: 'Conteúdo do PDF', tipo: 'secao' },
  { nome: 'contexto', rotulo: 'Contexto do cliente', tipo: 'area', cheio: true, linhas: 5, ajuda: 'Separe parágrafos com uma linha em branco.' },
  { nome: 'entregas', rotulo: 'O que está incluído', tipo: 'lista', cheio: true },
  { nome: 'comoEntregamos', rotulo: 'Como entregamos', tipo: 'lista', cheio: true, ajuda: 'Opcional. Um item por linha.' },
  { nome: 'operacao', rotulo: 'Como funciona na prática', tipo: 'lista', cheio: true },
  { nome: 'prazo', rotulo: 'Prazo de entrega' },
  { nome: 'pagamento', rotulo: 'Forma de pagamento', placeholder: 'Pix' },
  { nome: 'proximosPassos', rotulo: 'Próximos passos', tipo: 'lista', cheio: true, ajuda: 'Se ficar vazio, usamos os passos padrão da Bôdhi Marketing.' },
];

export function abrirFormProposta(proposta = null, inicial = {}) {
  const valores = proposta || { tipo: 'recorrente', status: 'rascunho', pacotesModo: 'soma', pagamento: 'Pix', ...inicial };
  formulario({
    titulo: proposta ? 'Editar proposta' : 'Nova proposta',
    subtitulo: 'Salve como rascunho e gere o PDF quando estiver pronta.',
    campos, valores, largo: true,
    async aoSalvar(v) {
      const cli = store.todos('cliente').find((c) => c.nome.toLowerCase() === v.clienteNome.toLowerCase());
      const clienteId = cli?.id || proposta?.clienteId || inicial.clienteId || null;
      const salvo = await store.salvar('proposta', { ...(proposta || {}), ...v, clienteId });
      toast('Proposta salva');
      location.hash = `#/propostas/${salvo.id}`;
    },
    aoExcluir: proposta ? async (m) => {
      if (await confirmar('Excluir esta proposta do painel?', 'Excluir', true)) {
        await store.remover('proposta', proposta.id);
        m.fechar();
        toast('Proposta excluída');
      }
    } : null,
  });
}

function bloco(p) {
  const st = STATUS[p.status] || STATUS.rascunho;
  const f = faixaProposta(p);
  const total = !f.max ? '' : f.min === f.max ? brl(f.max) : `${brl(f.min)} a ${brl(f.max)}`;
  return `<article class="prop" id="p-${p.id}">
    <div class="prop-h"><div><h3>${esc(p.clienteNome)}</h3><p>${esc(p.resumo || p.titulo)}</p></div><span class="chip ${st[0]}">${st[1]}</span></div>
    ${p.escopo ? `<p style="margin-top:12px;color:var(--ink-2)">${esc(p.escopo)}</p>` : ''}
    ${p.pacotes?.length ? `<div class="pkgs">${p.pacotes.map((x) => `<div class="pkg"><b>${esc(x.nome)}</b><div class="pr num">${brl(x.preco)}${p.tipo === 'recorrente' ? '<small> /mês</small>' : ''}</div>${x.desc ? `<p>${esc(x.desc)}</p>` : ''}</div>`).join('')}</div>` : ''}
    ${!p.obs && total && p.pacotesModo !== 'alternativas' && p.pacotes.length > 1 ? `<div class="hintbox">Investimento total: ${total}${p.tipo === 'recorrente' ? ' por mês' : ''}.</div>` : ''}
    ${p.obs ? `<div class="hintbox">${esc(p.obs)}</div>` : ''}
    <div class="actions" style="margin-top:14px">
      ${urlSegura(p.arquivoUrl) ? `<a class="btn verde sm" href="${esc(urlSegura(p.arquivoUrl))}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">${ic('file')}Ver proposta enviada</a>` : ''}
      <button class="btn pri sm" data-act="gerar-proposta" data-id="${p.id}">${ic('download')}Gerar PDF</button>
      <button class="btn sec sm" data-act="editar-proposta" data-id="${p.id}">${ic('edit')}Editar</button>
      ${p.status === 'rascunho' ? `<button class="btn sec sm" data-act="status-proposta" data-id="${p.id}" data-status="aguardando">Marcar como enviada</button>` : ''}
      ${p.status === 'aguardando' ? `<button class="btn verde sm" data-act="status-proposta" data-id="${p.id}" data-status="aceita">${ic('check')}Aceita</button><button class="btn sec sm" data-act="status-proposta" data-id="${p.id}" data-status="recusada">Recusada</button>` : ''}
      ${p.status === 'aceita' ? `<button class="btn verde sm" data-act="contrato-proposta" data-id="${p.id}">${ic('doc')}Gerar contrato</button>` : ''}
      ${p.status === 'recusada' ? `<button class="btn sec sm" data-act="status-proposta" data-id="${p.id}" data-status="aguardando">Reabrir</button>` : ''}
    </div></article>`;
}

export default {
  titulo: () => 'Propostas',
  sub: () => 'Crie, acompanhe e gere o PDF de cada proposta comercial.',

  render(estado) {
    const m = metricas();
    const todas = store.todos('proposta');
    const abertas = todas.filter((p) => p.status === 'aguardando');
    const outras = todas.filter((p) => p.status !== 'aguardando');
    const avuTxt = !m.potAvuMax ? 'R$ 0' : m.potAvuMin === m.potAvuMax ? brl(m.potAvuMax) : `${brl(m.potAvuMin)} a ${brl(m.potAvuMax)}`;
    if (!todas.length) {
      return `<div class="card empty">${flor()}<h2>Sua primeira proposta começa aqui</h2><p>Preencha o cliente e os valores, e gere o PDF no padrão da Bôdhi Marketing.</p><button class="btn pri" data-act="nova-proposta">${ic('plus')}Nova proposta</button></div>`;
    }
    const foco = estado.ref;
    const ordem = (l) => (foco ? [...l.filter((p) => p.id === foco), ...l.filter((p) => p.id !== foco)] : l);
    return `<div class="grid">
      <div class="card stat"><div><div class="lbl">Propostas em aberto</div><div class="big num">${abertas.length}</div><div class="hint">Aguardando retorno do cliente</div></div><span class="stat-ic" style="background:var(--pet-s);color:var(--petroleo)">${ic('send')}</span></div>
      <div class="card stat tone-verde"><div><div class="lbl">Potencial recorrente</div><div class="big num">${brl(m.potRec)}<small style="font:400 13px var(--ui);color:var(--ink-2)"> /mês</small></div><div class="hint">Se as abertas forem aprovadas</div></div><span class="stat-ic">${ic('wallet')}</span></div>
      <div class="card stat tone-coral"><div><div class="lbl">Potencial avulso</div><div class="big num" style="font-size:19px">${avuTxt}</div><div class="hint">Conforme o pacote escolhido</div></div><span class="stat-ic">${ic('calendar')}</span></div>
      <div class="card stat" style="justify-content:center"><button class="btn pri" data-act="nova-proposta">${ic('plus')}Nova proposta</button></div>

      <div class="card c4">
        <div class="card-h"><div><h2>Aguardando retorno</h2><p class="sub">Propostas enviadas, sem resposta ainda</p></div></div>
        ${ordem(abertas).map(bloco).join('') || '<p class="lbl">Nenhuma proposta aguardando resposta.</p>'}
      </div>
      ${outras.length ? `<div class="card c4"><div class="card-h"><div><h2>Rascunhos e encerradas</h2><p class="sub">Aceitas, recusadas e ainda em preparo</p></div></div>${ordem(outras).map(bloco).join('')}</div>` : ''}
    </div>`;
  },

  acoes: {
    'nova-proposta': () => abrirFormProposta(),
    'editar-proposta': (el) => abrirFormProposta(store.obter('proposta', el.dataset.id)),
    'gerar-proposta': (el) => gerarProposta(store.obter('proposta', el.dataset.id)),
    'proposta-cliente': (el) => {
      const c = store.obter('cliente', el.dataset.id);
      abrirFormProposta(null, { clienteNome: c.nome, clienteId: c.id, tipo: 'recorrente', status: 'rascunho', pacotesModo: 'soma', pagamento: 'Pix' });
    },
    'status-proposta': async (el) => {
      const p = store.obter('proposta', el.dataset.id);
      const status = el.dataset.status;
      await store.salvar('proposta', { ...p, status });
      toast(`Marcada como: ${STATUS[status][1].toLowerCase()}`);
      if (status === 'aceita' && await confirmar('Proposta aceita! Quer preparar o contrato agora?', 'Preparar contrato')) {
        document.dispatchEvent(new CustomEvent('acionar', { detail: { acao: 'contrato-proposta', dados: { id: p.id } } }));
      }
    },
  },
};
