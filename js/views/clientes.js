import { store } from '../store.js';
import { brl, esc, iniciais, toast, dataBR, mesAno, mesesEntre, mesesTxt, urlSegura, norm } from '../util.js';
import { ic, flor } from '../icons.js';
import { formulario, confirmar } from '../ui.js';

const STATUS = {
  ativo: ['ok', 'Ativo'],
  encerrando: ['warn', 'Encerrando'],
  inativo: ['mute', 'Encerrado'],
};

const MOTIVOS = {
  financeiro: 'Financeiro do cliente',
  internalizacao: 'Internalização da produção',
  reestruturacao: 'Reestruturação do negócio',
  desalinhamento: 'Desalinhamento de processo',
  pontual: 'Projeto pontual concluído',
  pessoal: 'Motivos pessoais do cliente',
  outro: 'Não informado',
};

const campos = [
  { nome: 'nome', rotulo: 'Nome do cliente', obrigatorio: true },
  { nome: 'status', rotulo: 'Situação', tipo: 'select', opcoes: [{ v: 'ativo', t: 'Ativo' }, { v: 'encerrando', t: 'Encerrando' }, { v: 'inativo', t: 'Encerrado (ex-cliente)' }] },
  { nome: 'modelo', rotulo: 'Tipo de contratação', tipo: 'select', opcoes: [{ v: 'recorrente', t: 'Recorrente (mensal)' }, { v: 'pontual', t: 'Projeto pontual' }] },
  { nome: 'mensalidade', rotulo: 'Valor mensal (ou do projeto), R$', tipo: 'dinheiro' },
  { nome: 'imagem', rotulo: 'Logo ou imagem do cliente', tipo: 'imagem', cheio: true, ajuda: 'Opcional. Aparece na ficha e nas propostas.' },
  { nome: 'origem', rotulo: 'Como chegou', placeholder: 'Indicação, Instagram…' },
  { nome: 'contato', rotulo: 'Contato principal' },
  { nome: 'inicio', rotulo: 'Início do trabalho', tipo: 'data' },
  { nome: 'fim', rotulo: 'Fim do trabalho', tipo: 'data', ajuda: 'Deixe vazio para clientes ativos.' },
  { nome: 'fimEstimado', rotulo: 'As datas são aproximadas (confirmar depois)', tipo: 'checkbox', cheio: true },
  { nome: 'motivoSaida', rotulo: 'Motivo da saída', tipo: 'select', opcoes: [{ v: '', t: 'Não se aplica' }, ...Object.entries(MOTIVOS).map(([v, t]) => ({ v, t }))] },
  { nome: 'motivoDetalhe', rotulo: 'Detalhe da saída', placeholder: 'O que aconteceu, em uma frase' },
  { nome: 'resumo', rotulo: 'Resumo do relacionamento', tipo: 'area', cheio: true, linhas: 3 },
  { nome: 'pagamento', rotulo: 'Como paga', placeholder: 'Todo dia 10, via boleto…', cheio: true },
  { nome: 'formato', rotulo: 'Formato combinado', tipo: 'area', cheio: true, linhas: 2 },
  { nome: 'empresa.razao', rotulo: 'Razão social ou nome' },
  { nome: 'empresa.cnpj', rotulo: 'CNPJ ou CPF' },
  { nome: 'empresa.endereco', rotulo: 'Endereço', cheio: true },
  { nome: 'empresa.representante', rotulo: 'Representante legal', cheio: true },
  { nome: 'escopo', rotulo: 'Serviços contratados', tipo: 'lista', cheio: true, linhas: 6 },
  { nome: 'documentos', rotulo: 'Documentos e links', tipo: 'docs', cheio: true, ajuda: 'Proposta enviada, contrato, notas fiscais, pasta no Drive. Cole o link do Canva, do Drive ou de onde estiver.' },
  { nome: 'obs', rotulo: 'Observações', tipo: 'area', cheio: true, linhas: 3 },
  { nome: 'encerramentoNota', rotulo: 'Nota de encerramento', cheio: true, ajuda: 'Só para clientes em encerramento. Aparece em “Pede atenção”.' },
];

export const fichaCompleta = (c) => !!(c.contato && c.escopo?.length && c.empresa?.cnpj);

function faltando(c) {
  const f = [];
  if (!c.contato) f.push('contato');
  if (!c.empresa?.cnpj) f.push('CNPJ ou CPF');
  if (!c.pagamento) f.push('dados de pagamento');
  if (!(c.escopo || []).length) f.push('serviços');
  if (!(c.documentos || []).length) f.push('documentos');
  if (c.status === 'inativo' && !c.motivoSaida) f.push('motivo da saída');
  if (c.status === 'inativo' && !c.fim) f.push('data de saída');
  return f;
}

export function abrirFormCliente(cliente = null) {
  formulario({
    titulo: cliente ? `Editar ${cliente.nome}` : 'Novo cliente',
    subtitulo: 'Tudo o que você salvar aqui aparece na busca, nas propostas e nos contratos.',
    campos, valores: cliente || { status: 'ativo', modelo: 'recorrente' }, largo: true,
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

const kv = (k, v) => (v ? `<div><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>` : '');

function periodo(c) {
  if (!c.inicio && !c.fim) return '';
  const ini = c.inicio ? mesAno(c.inicio) : '?';
  const fim = c.status === 'inativo' || c.status === 'encerrando' ? (c.fim ? mesAno(c.fim) : '?') : 'hoje';
  const m = c.inicio && c.fim ? mesesEntre(c.inicio, c.fim) : null;
  return `${c.fimEstimado ? '≈ ' : ''}${ini} a ${fim}${m !== null ? ` · ${mesesTxt(m)}` : ''}`;
}

function ordenar(lista) {
  const grupo = { ativo: 0, encerrando: 1, inativo: 2 };
  return [...lista].sort((a, b) => (grupo[a.status] ?? 2) - (grupo[b.status] ?? 2)
    || (a.status === 'inativo' ? (b.fim || '').localeCompare(a.fim || '') : 0)
    || a.nome.localeCompare(b.nome));
}

function estatisticas(lista) {
  const enc = lista.filter((c) => c.status === 'inativo');
  const rec = enc.filter((c) => c.modelo !== 'pontual' && c.inicio && c.fim);
  const media = rec.length ? Math.round(rec.reduce((t, c) => t + (mesesEntre(c.inicio, c.fim) || 0), 0) / rec.length) : null;
  const cont = {};
  enc.filter((c) => c.motivoSaida && c.motivoSaida !== 'outro' && c.motivoSaida !== 'pontual').forEach((c) => { cont[c.motivoSaida] = (cont[c.motivoSaida] || 0) + 1; });
  const top = Object.entries(cont).sort((a, b) => b[1] - a[1])[0];
  return { enc: enc.length, pont: enc.filter((c) => c.modelo === 'pontual').length, media, top: top ? { motivo: MOTIVOS[top[0]], n: top[1] } : null };
}

function botao(c, sel) {
  const cls = c.status === 'encerrando' ? 'enc' : c.status === 'inativo' ? 'ex' : '';
  return `<button class="cbtn ${cls} ${c.id === sel ? 'on' : ''}" data-act="ir" data-rota="clientes" data-ref="${c.id}" data-nome="${esc(norm(c.nome))}">${'<i></i>'}${esc(c.nome)}</button>`;
}

function docLink(d) {
  const url = urlSegura(d.url);
  if (!url) return '';
  return `<a class="btn sec sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${ic('file')}<span>${esc(d.titulo || d.tipo)}</span><span class="chip mute" style="padding:3px 8px">${esc(d.tipo)}</span></a>`;
}

export default {
  titulo: () => 'Clientes',
  sub: () => 'Todos os clientes, atuais e antigos. Clique em um nome para ver a ficha.',

  render(estado) {
    const lista = ordenar(store.todos('cliente'));
    if (!lista.length) {
      return `<div class="card empty">${flor()}<h2>Comece pelo primeiro cliente</h2><p>Cadastre um cliente e ele passa a aparecer na receita, nas propostas e nos contratos.</p><button class="btn pri" data-act="novo-cliente">${ic('plus')}Novo cliente</button></div>`;
    }
    const c = store.obter('cliente', estado.ref) || lista[0];
    const st = STATUS[c.status] || STATUS.ativo;
    const propostas = store.todos('proposta').filter((p) => p.clienteId === c.id || p.clienteNome === c.nome);
    const contratos = store.todos('contrato').filter((x) => x.clienteId === c.id);
    const emp = c.empresa || {};
    const falta = faltando(c);
    const stt = estatisticas(lista);
    const ativos = lista.filter((x) => x.status === 'ativo').length;

    const grupos = [['ativo', 'Ativos'], ['encerrando', 'Encerrando'], ['inativo', 'Encerrados']]
      .map(([s, nome]) => {
        const itens = lista.filter((x) => x.status === s);
        return itens.length ? `<div class="grp"><span>${nome}</span><span>${itens.length}</span></div><div class="cbtns">${itens.map((x) => botao(x, c.id)).join('')}</div>` : '';
      }).join('');

    const docs = (c.documentos || []).map(docLink).join('');
    const propLinks = propostas.map((p) => (urlSegura(p.arquivoUrl) ? docLink({ tipo: 'Proposta', titulo: `Proposta: ${p.titulo}`, url: p.arquivoUrl }) : '')).join('');

    return `<div class="grid" style="margin-bottom:16px">
        <div class="card stat tone-verde"><div><div class="lbl">Clientes ativos</div><div class="big num">${ativos}</div><div class="hint">Hoje</div></div><span class="stat-ic">${ic('users')}</span></div>
        <div class="card stat"><div><div class="lbl">Ex-clientes</div><div class="big num">${stt.enc}</div><div class="hint">${stt.pont ? `${stt.pont} foram projetos pontuais` : 'Histórico completo'}</div></div><span class="stat-ic" style="background:var(--graf-s);color:var(--ink-2)">${ic('file')}</span></div>
        <div class="card stat tone-creme"><div><div class="lbl">Permanência média</div><div class="big num">${stt.media !== null ? mesesTxt(stt.media) : '–'}</div><div class="hint">Clientes recorrentes que saíram</div></div><span class="stat-ic">${ic('calendar')}</span></div>
        <div class="card stat tone-coral"><div><div class="lbl">Motivo de saída mais comum</div><div class="big" style="font-size:17px;line-height:1.25">${stt.top ? esc(stt.top.motivo) : '–'}</div><div class="hint">${stt.top ? `${stt.top.n} ${stt.top.n === 1 ? 'cliente' : 'clientes'}` : 'Preencha o motivo nas fichas'}</div></div><span class="stat-ic">${ic('alert')}</span></div>
      </div>

      <div class="grid">
      <div class="card namescard">
        <div class="card-h" style="margin-bottom:4px"><div><h2>Clientes</h2></div><button class="btn pri sm" data-act="novo-cliente">${ic('plus')}Novo</button></div>
        <input class="filtro" type="search" placeholder="Buscar pelo nome" aria-label="Filtrar clientes pelo nome" data-filtro>
        <div data-nomes>${grupos}</div>
      </div>

      <div class="stack c3" id="ficha">
        <div class="card">
          <div class="cli-h">
            <div class="cli-id"><div class="cli-logo">${c.imagem ? `<img src="${esc(c.imagem)}" alt="">` : esc(iniciais(c.nome))}</div>
              <div><h2>${esc(c.nome)}</h2><div class="actions" style="margin-top:6px"><span class="chip ${st[0]}">${st[1]}</span>${c.modelo === 'pontual' ? '<span class="chip info">Projeto pontual</span>' : ''}${c.fimEstimado ? '<span class="chip warn">Confirmar datas</span>' : ''}</div></div></div>
            <div class="money num">${c.mensalidade ? brl(c.mensalidade) : 'Sem valor'}<small>${c.modelo === 'pontual' ? 'no projeto' : 'por mês'}${c.status === 'inativo' ? ' (histórico)' : ''}</small></div>
          </div>
          ${c.resumo ? `<p style="margin-top:14px;color:var(--ink-2)">${esc(c.resumo)}</p>` : ''}
          <dl class="kv">${kv('Período', periodo(c))}${kv('Motivo da saída', c.motivoSaida ? MOTIVOS[c.motivoSaida] + (c.motivoDetalhe ? `: ${c.motivoDetalhe}` : '') : c.motivoDetalhe)}${kv('Como chegou', c.origem)}${kv('Contato principal', c.contato)}${kv('Pagamento', c.pagamento)}${kv('Formato combinado', c.formato)}</dl>
          ${falta.length ? `<div class="miss"><span class="lbl">Ainda falta:</span>${falta.map((f) => `<span class="chip warn">${esc(f)}</span>`).join('')}</div>` : ''}
          <div class="actions" style="margin-top:16px">
            <button class="btn sec sm" data-act="editar-cliente" data-id="${c.id}">${ic('edit')}Editar ficha</button>
            <button class="btn sec sm" data-act="proposta-cliente" data-id="${c.id}">${ic('send')}Nova proposta</button>
            <button class="btn sec sm" data-act="contrato-cliente" data-id="${c.id}">${ic('doc')}Novo contrato</button>
          </div>
        </div>

        <div class="card">
          <div class="card-h"><div><h2>Documentos e propostas</h2><p class="sub">Abra o arquivo original da proposta, do contrato e das notas fiscais</p></div>
            <button class="btn sec sm" data-act="editar-cliente" data-id="${c.id}">${ic('plus')}Adicionar link</button></div>
          ${docs || propLinks ? `<div class="docbtns">${docs}${propLinks}</div>` : '<p class="lbl">Nenhum documento ainda. Use “Adicionar link” para colar o link da proposta (Canva, Drive ou outro).</p>'}
        </div>

        <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          <div class="card">
            <h2>Serviços contratados</h2><p class="sub">Escopo e rotina de entrega combinados</p>
            ${c.escopo?.length ? `<ul class="bullets">${c.escopo.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '<p class="lbl">Ainda sem escopo cadastrado.</p>'}
            ${c.obs ? `<div class="hintbox">${esc(c.obs)}</div>` : ''}
          </div>
          <div class="card">
            <h2>Dados da empresa</h2><p class="sub">Usados nos contratos e nas propostas</p>
            <dl class="kv" style="margin-top:0">${kv('Razão social ou nome', emp.razao)}${kv('CNPJ ou CPF', emp.cnpj)}${kv('Endereço', emp.endereco)}${kv('Representante', emp.representante)}</dl>
            ${emp.razao || emp.cnpj ? '' : '<p class="lbl">Sem dados da empresa ainda.</p>'}
            <div class="list" style="margin-top:14px">
              ${propostas.map((p) => `<div class="li click" data-act="ir" data-rota="propostas" data-ref="${p.id}"><span class="li-ic ic-pet">${ic('send')}</span><div class="li-t"><b>${esc(p.titulo)}</b><span>Proposta · ${p.status === 'aguardando' ? 'aguardando retorno' : esc(p.status)}</span></div></div>`).join('')}
              ${contratos.map((x) => `<div class="li click" data-act="ir" data-rota="contratos" data-ref="${x.id}"><span class="li-ic ic-verde">${ic('doc')}</span><div class="li-t"><b>${esc(x.objeto || 'Contrato')}</b><span>Contrato${x.fim ? ` · vigência até ${esc(dataBR(x.fim))}` : ''}</span></div></div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;
  },

  montar(el) {
    const filtro = el.querySelector('[data-filtro]');
    filtro?.addEventListener('input', () => {
      const t = norm(filtro.value.trim());
      el.querySelectorAll('.cbtn').forEach((b) => { b.hidden = !!t && !b.dataset.nome.includes(t); });
    });
    if (location.hash.split('/')[2] && window.innerWidth < 1241) el.querySelector('#ficha')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  acoes: {
    'novo-cliente': () => abrirFormCliente(),
    'editar-cliente': (el) => abrirFormCliente(store.obter('cliente', el.dataset.id)),
  },
};
