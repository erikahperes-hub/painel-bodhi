import { store } from '../store.js';
import { brl, esc, iniciais, toast, dataBR } from '../util.js';
import { ic, flor } from '../icons.js';
import { formulario, confirmar } from '../ui.js';

const STATUS = {
  ativo: ['ok', 'Ativo'],
  encerrando: ['warn', 'Encerrando'],
  inativo: ['mute', 'Inativo'],
};

const campos = [
  { nome: 'nome', rotulo: 'Nome do cliente', obrigatorio: true },
  { nome: 'status', rotulo: 'Situação', tipo: 'select', opcoes: [{ v: 'ativo', t: 'Ativo' }, { v: 'encerrando', t: 'Encerrando' }, { v: 'inativo', t: 'Inativo' }] },
  { nome: 'imagem', rotulo: 'Logo ou imagem do cliente', tipo: 'imagem', cheio: true, ajuda: 'Opcional. Aparece na ficha e nas propostas.' },
  { nome: 'mensalidade', rotulo: 'Valor mensal (R$)', tipo: 'dinheiro' },
  { nome: 'origem', rotulo: 'Como chegou', placeholder: 'Indicação, Instagram…' },
  { nome: 'resumo', rotulo: 'Resumo do relacionamento', tipo: 'area', cheio: true, linhas: 3 },
  { nome: 'contato', rotulo: 'Contato principal' },
  { nome: 'pagamento', rotulo: 'Como paga', placeholder: 'Todo dia 10, via boleto…' },
  { nome: 'formato', rotulo: 'Formato combinado', tipo: 'area', cheio: true, linhas: 2 },
  { nome: 'empresa.razao', rotulo: 'Razão social' },
  { nome: 'empresa.cnpj', rotulo: 'CNPJ' },
  { nome: 'empresa.endereco', rotulo: 'Endereço', cheio: true },
  { nome: 'empresa.representante', rotulo: 'Representante legal', cheio: true },
  { nome: 'escopo', rotulo: 'Serviços contratados', tipo: 'lista', cheio: true, linhas: 6 },
  { nome: 'obs', rotulo: 'Observações', tipo: 'area', cheio: true, linhas: 3 },
  { nome: 'encerramentoNota', rotulo: 'Nota de encerramento', cheio: true, ajuda: 'Só para clientes em encerramento. Aparece em "Pede atenção".' },
];

export const fichaCompleta = (c) => !!(c.contato && c.escopo?.length && c.empresa?.cnpj);

export function abrirFormCliente(cliente = null) {
  formulario({
    titulo: cliente ? `Editar ${cliente.nome}` : 'Novo cliente',
    subtitulo: 'Tudo o que você salvar aqui aparece na busca, nas propostas e nos contratos.',
    campos, valores: cliente || { status: 'ativo' }, largo: true,
    async aoSalvar(v) {
      const salvo = await store.salvar('cliente', { ...(cliente || {}), ...v, empresa: { ...(cliente?.empresa || {}), ...(v.empresa || {}) } });
      toast('Cliente salvo');
      if (!cliente) location.hash = `#/clientes/${salvo.id}`;
    },
    aoExcluir: cliente ? async (m) => {
      if (await confirmar(`Excluir ${cliente.nome} do painel? Propostas e contratos ligados a ele continuam salvos.`, 'Excluir', true)) {
        await store.remover('cliente', cliente.id);
        m.fechar();
        toast('Cliente excluído');
        location.hash = '#/clientes';
      }
    } : null,
  });
}

function kv(k, v) {
  return v ? `<div><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>` : '';
}

export default {
  titulo: () => 'Clientes',
  sub: () => 'Ficha de cada cliente: contato, escopo e rotina de entrega.',

  render(estado) {
    const lista = store.todos('cliente').sort((a, b) => (a.status === b.status ? a.nome.localeCompare(b.nome) : a.status === 'ativo' ? -1 : 1));
    if (!lista.length) {
      return `<div class="card empty">${flor()}<h2>Comece pelo primeiro cliente</h2><p>Cadastre um cliente e ele passa a aparecer na receita, nas propostas e nos contratos.</p><button class="btn pri" data-act="novo-cliente">${ic('plus')}Novo cliente</button></div>`;
    }
    const c = store.obter('cliente', estado.ref) || lista[0];
    const st = STATUS[c.status] || STATUS.ativo;
    const propostas = store.todos('proposta').filter((p) => p.clienteId === c.id || p.clienteNome === c.nome);
    const contratos = store.todos('contrato').filter((x) => x.clienteId === c.id);
    const emp = c.empresa || {};

    return `<div class="tabs" role="tablist">${lista.map((x) => `<button class="tab ${x.id === c.id ? 'on' : ''}" role="tab" aria-selected="${x.id === c.id}" data-act="ir" data-rota="clientes" data-ref="${x.id}">${esc(x.nome)}</button>`).join('')}
      <button class="tab" data-act="novo-cliente" aria-label="Novo cliente">${ic('plus')}</button></div>

    <div class="grid">
      <div class="card c4">
        <div class="cli-h">
          <div class="cli-id"><div class="cli-logo">${c.imagem ? `<img src="${esc(c.imagem)}" alt="">` : esc(iniciais(c.nome))}</div>
            <div><h2>${esc(c.nome)}</h2><div class="actions" style="margin-top:6px"><span class="chip ${st[0]}">${st[1]}</span>${fichaCompleta(c) ? '' : '<span class="chip mute">Ficha pendente</span>'}</div></div></div>
          <div class="money num">${c.mensalidade ? brl(c.mensalidade) : 'Sem valor'}<small>por mês</small></div>
        </div>
        ${c.resumo ? `<p style="margin-top:14px;color:var(--ink-2)">${esc(c.resumo)}</p>` : ''}
        <dl class="kv" style="margin-bottom:0">${kv('Como chegou', c.origem)}${kv('Contato principal', c.contato)}${kv('Pagamento', c.pagamento)}${kv('Formato combinado', c.formato)}</dl>
        <div class="actions" style="margin-top:16px">
          <button class="btn sec sm" data-act="editar-cliente" data-id="${c.id}">${ic('edit')}Editar ficha</button>
          <button class="btn sec sm" data-act="proposta-cliente" data-id="${c.id}">${ic('send')}Nova proposta</button>
          <button class="btn sec sm" data-act="contrato-cliente" data-id="${c.id}">${ic('doc')}Novo contrato</button>
        </div>
      </div>

      <div class="card c2">
        <h2>Serviços contratados</h2><p class="sub">Escopo e rotina de entrega combinados</p>
        ${c.escopo?.length ? `<ul class="bullets">${c.escopo.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '<p class="lbl">Ainda sem escopo cadastrado. Use “Editar ficha” para incluir.</p>'}
        ${c.obs ? `<div class="hintbox">${esc(c.obs)}</div>` : ''}
      </div>

      <div class="card c2">
        <h2>Dados da empresa</h2><p class="sub">Usados nos contratos e nas propostas</p>
        <dl class="kv" style="margin-top:0">${kv('Razão social', emp.razao)}${kv('CNPJ', emp.cnpj)}${kv('Endereço', emp.endereco)}${kv('Representante', emp.representante)}</dl>
        ${emp.razao || emp.cnpj ? '' : '<p class="lbl">Sem dados da empresa ainda.</p>'}
        <div class="list" style="margin-top:16px">
          ${propostas.map((p) => `<div class="li click" data-act="ir" data-rota="propostas" data-ref="${p.id}"><span class="li-ic ic-pet">${ic('send')}</span><div class="li-t"><b>${esc(p.titulo)}</b><span>Proposta · ${p.status === 'aguardando' ? 'aguardando retorno' : esc(p.status)}</span></div></div>`).join('')}
          ${contratos.map((x) => `<div class="li click" data-act="ir" data-rota="contratos" data-ref="${x.id}"><span class="li-ic ic-verde">${ic('doc')}</span><div class="li-t"><b>${esc(x.objeto || 'Contrato')}</b><span>Contrato${x.fim ? ` · vigência até ${esc(dataBR(x.fim))}` : ''}</span></div></div>`).join('')}
        </div>
      </div>
    </div>`;
  },

  acoes: {
    'novo-cliente': () => abrirFormCliente(),
    'editar-cliente': (el) => abrirFormCliente(store.obter('cliente', el.dataset.id)),
  },
};
