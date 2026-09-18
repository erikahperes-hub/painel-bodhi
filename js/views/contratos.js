import { store } from '../store.js';
import { metricas, faixaProposta } from '../calc.js';
import { brl, esc, dataBR, diasAte, diasTxt, toast } from '../util.js';
import { ic, flor } from '../icons.js';
import { formulario, confirmar } from '../ui.js';
import { gerarContrato } from '../docs/contrato.js';

function campos() {
  const clientes = store.todos('cliente').map((c) => ({ v: c.id, t: c.nome }));
  return [
    { nome: 'clienteId', rotulo: 'Cliente', tipo: 'select', cheio: true, opcoes: [{ v: '', t: 'Outro (preencher os dados abaixo)' }, ...clientes] },
    { nome: 'contratanteRazao', rotulo: 'Razão social da contratante' },
    { nome: 'contratanteCnpj', rotulo: 'CNPJ da contratante' },
    { nome: 'contratanteEndereco', rotulo: 'Endereço da contratante', cheio: true },
    { nome: 'contratanteRepresentante', rotulo: 'Representante legal', cheio: true },
    { nome: 'objeto', rotulo: 'Objeto', cheio: true, placeholder: 'gestão de conteúdo mensal para Instagram e TikTok' },
    { nome: 'escopo', rotulo: 'Escopo dos serviços', tipo: 'lista', cheio: true, linhas: 6 },
    { nome: 'inicio', rotulo: 'Início da vigência', tipo: 'data' },
    { nome: 'fim', rotulo: 'Fim da vigência', tipo: 'data' },
    { nome: 'valor', rotulo: 'Valor mensal (R$)', tipo: 'dinheiro' },
    { nome: 'diaPagamento', rotulo: 'Dia do pagamento', tipo: 'numero' },
    { nome: 'formaPagamento', rotulo: 'Forma de pagamento', cheio: true, placeholder: 'boleto bancário emitido pela Bôdhi' },
    { nome: 'diasCarencia', rotulo: 'Dias úteis até multa por atraso', tipo: 'numero' },
    { nome: 'multaAtrasoPct', rotulo: 'Multa por atraso (%)', tipo: 'dinheiro' },
    { nome: 'jurosAtrasoPct', rotulo: 'Juros ao mês (%)', tipo: 'dinheiro' },
    { nome: 'avisoPrevioDias', rotulo: 'Aviso prévio de rescisão (dias)', tipo: 'numero' },
    { nome: 'propriedade', rotulo: 'Materiais ficam com', placeholder: 'Nome da contratante' },
    { nome: 'foro', rotulo: 'Foro', placeholder: 'São Paulo/SP' },
    { nome: 'dataAssinatura', rotulo: 'Data de assinatura', tipo: 'data' },
    { nome: '_novo', rotulo: 'Cláusulas ainda em definição (opcionais)', tipo: 'secao' },
    { nome: 'permanenciaMinimaMeses', rotulo: 'Permanência mínima (meses)', tipo: 'numero', ajuda: 'Se ficar vazio, a cláusula não aparece.' },
    { nome: 'multaRescisoria', rotulo: 'Multa por rescisão antecipada', placeholder: 'equivalente a 50% das mensalidades restantes', ajuda: 'Se ficar vazio, a cláusula não aparece.' },
    { nome: 'reajuste', rotulo: 'Reajuste', cheio: true, placeholder: 'anualmente pelo IPCA', ajuda: 'Se ficar vazio, a cláusula não aparece.' },
    { nome: 'obs', rotulo: 'Observações internas', tipo: 'area', cheio: true, linhas: 2, ajuda: 'Não aparecem no contrato.' },
  ];
}

export function abrirFormContrato(contrato = null, inicial = {}) {
  const valores = contrato || { foro: 'São Paulo/SP', diaPagamento: 10, avisoPrevioDias: 30, ...inicial };
  formulario({
    titulo: contrato ? 'Editar contrato' : 'Novo contrato',
    subtitulo: 'Os dados da contratante vêm da ficha do cliente e podem ser ajustados aqui.',
    campos: campos(), valores, largo: true,
    salvarTexto: 'Salvar contrato',
    async aoSalvar(v) {
      const cli = store.obter('cliente', v.clienteId);
      const dados = { ...(contrato || {}), ...v };
      if (cli) {
        dados.contratanteRazao ||= cli.empresa?.razao || cli.nome;
        dados.contratanteCnpj ||= cli.empresa?.cnpj || '';
        dados.contratanteEndereco ||= cli.empresa?.endereco || '';
        dados.contratanteRepresentante ||= cli.empresa?.representante || '';
      }
      if (v.inicio && v.fim) {
        const meses = Math.round((new Date(v.fim) - new Date(v.inicio)) / 2629800000);
        dados.prazoMeses = meses > 0 ? meses : dados.prazoMeses;
      }
      const salvo = await store.salvar('contrato', dados);
      toast('Contrato salvo');
      location.hash = `#/contratos/${salvo.id}`;
    },
    aoExcluir: contrato ? async (m) => {
      if (await confirmar('Excluir este contrato do painel?', 'Excluir', true)) {
        await store.remover('contrato', contrato.id);
        m.fechar();
        toast('Contrato excluído');
      }
    } : null,
  });
}

function prefillCliente(c) {
  return {
    clienteId: c.id, contratanteRazao: c.empresa?.razao || c.nome, contratanteCnpj: c.empresa?.cnpj || '',
    contratanteEndereco: c.empresa?.endereco || '', contratanteRepresentante: c.empresa?.representante || '',
    valor: c.mensalidade || null, escopo: c.escopo || [], propriedade: c.empresa?.razao || c.nome,
    objeto: 'gestão de conteúdo mensal',
  };
}

const item = (k, v) => (v ? `<div><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>` : '');

function bloco(c) {
  const cli = store.obter('cliente', c.clienteId);
  const nome = cli?.nome || c.contratanteRazao || 'Contrato';
  const d = diasAte(c.fim);
  const st = d === null ? ['mute', 'Sem vigência'] : d < 0 ? ['warn', 'Vencido'] : d <= 60 ? ['warn', 'Renovar em breve'] : ['ok', 'Ativo'];
  const pgto = [c.diaPagamento ? `Até o dia ${c.diaPagamento} de cada mês` : '', c.formaPagamento ? `via ${c.formaPagamento}` : ''].filter(Boolean).join(', ');
  const atraso = c.multaAtrasoPct != null ? `Multa de ${c.multaAtrasoPct}% mais juros de ${c.jurosAtrasoPct ?? 0}% ao mês${c.diasCarencia ? `, após ${c.diasCarencia} dias úteis de atraso` : ''}` : '';
  return `<div class="card c4" id="c-${c.id}">
    <div class="cli-h"><div class="cli-id"><div class="cli-logo">${cli?.imagem ? `<img src="${esc(cli.imagem)}" alt="">` : ic('doc')}</div>
      <div><h2>${esc(nome)}</h2><p class="lbl">${esc(c.objeto || '')}</p><div class="actions" style="margin-top:6px"><span class="chip ${st[0]}">${st[1]}</span></div></div></div>
      <div class="money num">${c.fim ? dataBR(c.fim) : '–'}<small>vigência até${d !== null ? ` · ${diasTxt(d)}` : ''}</small></div></div>
    <dl class="kv">
      ${item('Vigência', c.inicio && c.fim ? `${c.prazoMeses ? c.prazoMeses + ' meses, de ' : 'De '}${dataBR(c.inicio)} a ${dataBR(c.fim)}` : '')}
      ${item('Valor mensal', c.valor ? brl(c.valor) : '')}
      ${item('Pagamento', pgto)}
      ${item('Rescisão', c.avisoPrevioDias ? `Por qualquer parte, a qualquer tempo, com aviso prévio de ${c.avisoPrevioDias} dias por escrito` : '')}
      ${item('Atraso no pagamento', atraso)}
      ${item('Foro', c.foro)}
      ${item('Propriedade dos materiais', c.propriedade ? `Permanecem com ${c.propriedade}` : '')}
      ${item('Assinado em', c.dataAssinatura ? dataBR(c.dataAssinatura) : '')}
    </dl>
    ${d !== null && d <= 60 && d >= -30 ? `<div class="hintbox" style="background:var(--coral-s);color:var(--coral-ink)">Este contrato vence em ${dataBR(c.fim)}. Vale já alinhar a renovação.</div>` : ''}
    <div class="kv" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
      <div><div class="k">Contratante</div><div class="v"><b>${esc(c.contratanteRazao || nome)}</b><br>${c.contratanteCnpj ? `CNPJ ${esc(c.contratanteCnpj)}<br>` : ''}${esc(c.contratanteEndereco || '')}${c.contratanteRepresentante ? `<br>Representante: ${esc(c.contratanteRepresentante)}` : ''}</div></div>
      <div><div class="k">Contratada</div><div class="v" data-empresa></div></div>
    </div>
    <div class="actions" style="margin-top:16px">
      <button class="btn pri sm" data-act="gerar-contrato" data-id="${c.id}">${ic('download')}Gerar contrato em PDF</button>
      <button class="btn sec sm" data-act="editar-contrato" data-id="${c.id}">${ic('edit')}Editar</button>
    </div></div>`;
}

export default {
  titulo: () => 'Contratos',
  sub: () => 'Vigência, condições e geração do contrato de cada cliente.',

  render(estado) {
    const m = metricas();
    const contratos = store.todos('contrato').sort((a, b) => (a.fim || '').localeCompare(b.fim || ''));
    const comContrato = new Set(contratos.map((c) => c.clienteId));
    const semContrato = [...m.ativos, ...m.encerrando].filter((c) => !comContrato.has(c.id));
    const ren = m.renovacao;
    const cliRen = ren ? store.obter('cliente', ren.contrato.clienteId)?.nome || ren.contrato.contratanteRazao : '';
    const foros = contratos.map((c) => c.foro).filter(Boolean);
    const foro = foros.sort((a, b) => foros.filter((x) => x === b).length - foros.filter((x) => x === a).length)[0] || '–';
    const foco = estado.ref;
    const ordem = foco ? [...contratos.filter((c) => c.id === foco), ...contratos.filter((c) => c.id !== foco)] : contratos;

    return `<div class="grid">
      <div class="card stat"><div><div class="lbl">Contratos registrados</div><div class="big num">${contratos.length}<small style="font:400 13px var(--ui);color:var(--ink-2)"> de ${m.ativos.length}</small></div><div class="hint">Clientes com contrato no painel</div></div><span class="stat-ic" style="background:var(--pet-s);color:var(--petroleo)">${ic('doc')}</span></div>
      <div class="card hl stat" style="align-items:flex-start"><div><div class="lbl">Renovação mais próxima</div><div class="big num" style="font-size:24px">${ren ? dataBR(ren.contrato.fim) : '–'}</div><div class="hint">${ren ? `${esc(cliRen)} · ${diasTxt(ren.dias)}` : 'Sem vigência cadastrada'}</div></div></div>
      <div class="card stat tone-verde"><div><div class="lbl">Foro padrão</div><div class="big num" style="font-size:22px">${esc(foro)}</div><div class="hint">Mais usado nos contratos</div></div><span class="stat-ic">${ic('target')}</span></div>
      <div class="card stat" style="justify-content:center"><button class="btn pri" data-act="novo-contrato">${ic('plus')}Novo contrato</button></div>
      ${ordem.map(bloco).join('') || `<div class="card c4 empty">${flor()}<h2>Nenhum contrato registrado ainda</h2><p>Registre o contrato de um cliente para acompanhar a vigência e gerar novas versões.</p><button class="btn pri" data-act="novo-contrato">${ic('plus')}Novo contrato</button></div>`}
      ${semContrato.length ? `<div class="card c4"><h2>Sem contrato registrado</h2><p class="sub">Clientes que ainda não têm contrato no painel</p><div class="list">${semContrato.map((c) => `<div class="li"><span class="li-ic ic-graf">${ic('doc')}</span><div class="li-t"><b>${esc(c.nome)}</b><span>${c.mensalidade ? brl(c.mensalidade) + ' por mês' : 'Sem valor'}</span></div><button class="btn sec sm" data-act="contrato-cliente" data-id="${c.id}">Registrar contrato</button></div>`).join('')}</div></div>` : ''}
    </div>`;
  },

  montar(el) {
    const e = store.cfg('empresa', {});
    el.querySelectorAll('[data-empresa]').forEach((n) => {
      n.innerHTML = e.razao ? `<b>${esc(e.razao)}</b><br>${e.cnpj ? `CNPJ ${esc(e.cnpj)}<br>` : ''}${esc(e.endereco || '')}${e.representante ? `<br>Representante: ${esc(e.representante)}` : ''}` : 'Preencha em Configurações';
    });
  },

  acoes: {
    'novo-contrato': () => abrirFormContrato(),
    'editar-contrato': (el) => abrirFormContrato(store.obter('contrato', el.dataset.id)),
    'gerar-contrato': (el) => gerarContrato(store.obter('contrato', el.dataset.id)),
    'contrato-cliente': (el) => abrirFormContrato(null, prefillCliente(store.obter('cliente', el.dataset.id))),
    'contrato-proposta': (el) => {
      const p = store.obter('proposta', el.dataset.id);
      const c = p.clienteId ? store.obter('cliente', p.clienteId) : null;
      const base = c ? prefillCliente(c) : { contratanteRazao: p.clienteNome, propriedade: p.clienteNome };
      abrirFormContrato(null, {
        ...base, objeto: p.titulo.charAt(0).toLowerCase() + p.titulo.slice(1),
        valor: p.tipo === 'recorrente' ? faixaProposta(p).max : null,
        escopo: p.entregas?.length ? p.entregas : base.escopo || [],
        formaPagamento: p.pagamento || '', foro: 'São Paulo/SP', diaPagamento: 10, avisoPrevioDias: 30,
      });
    },
  },
};
