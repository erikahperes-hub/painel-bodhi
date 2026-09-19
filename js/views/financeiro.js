import { store } from '../store.js?v=13';
import { metricas, resumoMes } from '../calc.js?v=13';
import { brl, esc, dataBR, toast, hojeISO, mesNome } from '../util.js?v=13';
import { ic, flor } from '../icons.js?v=13';
import { asaas } from '../asaas.js?v=13';
import { formulario } from '../ui.js?v=13';

const CORES = ['#073F56', '#23BB84', '#E96A6A', '#292B2D'];
const STATUS_PAG = { pago: ['ok', 'Pago'], pendente: ['info', 'Pendente'], atrasado: ['warn', 'Atrasado'], outro: ['mute', 'Outro'] };
const CAT_DESPESA = ['Ferramentas e assinaturas', 'Impostos e taxas', 'Contador', 'Equipamentos', 'Pró-labore', 'Freelancers e parceiros', 'Deslocamento', 'Alimentação', 'Outros'];
const CAT_RECEITA = ['Mensalidade', 'Projeto avulso', 'Outros'];

let mes = null;
const ymAtual = () => hojeISO().slice(0, 7);
const ym = () => mes || ymAtual();
const rotuloMes = (s) => { const [a, m] = s.split('-').map(Number); const nome = mesNome(m - 1); return `${nome[0].toUpperCase()}${nome.slice(1)} de ${a}`; };
const somaMes = (s, n) => { const [a, m] = s.split('-').map(Number); const d = new Date(a, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const trocarMes = (n) => { mes = somaMes(ym(), n); window.dispatchEvent(new HashChangeEvent('hashchange')); };

function donut(itens, total) {
  const C = 439.82;
  let acc = 0;
  const segs = itens.map((it, i) => {
    const len = (it.valor / total) * C;
    const s = `<circle cx="90" cy="90" r="70" fill="none" stroke="${CORES[i % CORES.length]}" stroke-width="22" stroke-linecap="butt" stroke-dasharray="${Math.max(0, len - 3).toFixed(1)} ${C}" stroke-dashoffset="${(-acc).toFixed(1)}" transform="rotate(-90 90 90)"/>`;
    acc += len;
    return s;
  }).join('');
  return `<svg viewBox="0 0 180 180" role="img" aria-label="Receita por cliente"><circle cx="90" cy="90" r="70" fill="none" stroke="#F3EEE2" stroke-width="22"/>${segs}</svg>`;
}

function abrirLancamento(tipo, l = null) {
  const cats = tipo === 'despesa' ? CAT_DESPESA : CAT_RECEITA;
  const clientes = store.todos('cliente').filter((c) => c.status !== 'inativo').map((c) => ({ v: c.id, t: c.nome }));
  formulario({
    titulo: l ? `Editar ${tipo}` : `Nova ${tipo}`,
    subtitulo: tipo === 'despesa' ? 'Registre o que a Bôdhi paga para funcionar.' : 'Receitas além das mensalidades dos contratos, como projetos avulsos.',
    campos: [
      { nome: 'descricao', rotulo: 'Descrição', obrigatorio: true, cheio: true, placeholder: tipo === 'despesa' ? 'Assinatura do Canva, imposto, freelancer…' : 'Storymaker de casamento…' },
      { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'dinheiro', obrigatorio: true },
      { nome: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
      { nome: 'categoria', rotulo: 'Categoria', tipo: 'select', opcoes: cats.map((c) => ({ v: c, t: c })) },
      { nome: 'status', rotulo: 'Situação', tipo: 'select', opcoes: [{ v: 'pendente', t: 'Pendente' }, { v: 'pago', t: tipo === 'despesa' ? 'Pago' : 'Recebido' }] },
      { nome: 'clienteId', rotulo: tipo === 'despesa' ? 'Custo de um cliente (opcional)' : 'Cliente (opcional)', tipo: 'select', cheio: true, opcoes: [{ v: '', t: 'Nenhum' }, ...clientes],
        ajuda: tipo === 'despesa' ? 'Se a despesa é de um cliente específico, marque aqui para ver a margem dele.' : '' },
      { nome: 'recorrente', rotulo: tipo === 'despesa' ? 'Despesa fixa: se repete todo mês' : 'Se repete todo mês', tipo: 'checkbox', cheio: true },
      { nome: 'ate', rotulo: 'Última vez (opcional)', tipo: 'data', ajuda: 'Só para os que se repetem todo mês.' },
      { nome: 'obs', rotulo: 'Observações', tipo: 'area', cheio: true, linhas: 2 },
    ],
    valores: l || { data: hojeISO().slice(0, 8) + '01', status: 'pendente', categoria: cats[0], recorrente: false },
    async aoSalvar(v) {
      await store.salvar('lancamento', { ...(l || {}), ...v, tipo, ate: v.recorrente ? v.ate : '' });
      toast(tipo === 'despesa' ? 'Despesa salva' : 'Receita salva');
    },
    aoExcluir: l ? async (m) => {
      await store.remover('lancamento', l.id);
      m.fechar();
      toast('Lançamento excluído');
    } : null,
  });
}

function linhaLanc(l) {
  const desp = l.tipo === 'despesa';
  const cli = l.clienteId ? store.obter('cliente', l.clienteId)?.nome : '';
  const meta = [l.categoria, l.recorrente ? 'todo mês' : dataBR(l.data), cli].filter(Boolean).join(' · ');
  const st = l.recorrente ? '<span class="chip mute">Fixa</span>' : l.status === 'pago' ? `<span class="chip ok">${desp ? 'Pago' : 'Recebido'}</span>` : '<span class="chip info">Pendente</span>';
  return `<div class="li"><span class="li-ic ${desp ? 'ic-coral' : 'ic-verde'}">${ic(desp ? 'receipt' : 'wallet')}</span>
    <div class="li-t"><b>${esc(l.descricao)}</b><span>${esc(meta)}</span></div>
    <div class="li-r"><b class="num" style="font:700 15px var(--ui)">${brl(l.valor)}</b><br>${st}</div>
    ${!l.recorrente && l.status !== 'pago' ? `<button class="btn ghost sm" data-act="pagar-lanc" data-id="${l.id}" aria-label="Marcar como ${desp ? 'pago' : 'recebido'}" title="Marcar como ${desp ? 'pago' : 'recebido'}">${ic('check')}</button>` : ''}
    <button class="btn ghost sm" data-act="editar-lanc" data-id="${l.id}" aria-label="Editar">${ic('edit')}</button></div>`;
}

function cartaoAsaas(r) {
  const cab = (acoes = '') => `<div class="card-h"><div><h2>Cobranças no Asaas</h2><p class="sub">O que foi pago e o que está pendente</p></div><div class="actions">${acoes}</div></div>`;
  if (r.estado === 'conectado') {
    const t = r.totais || {};
    const pags = (r.pagamentos || []).slice(0, 12);
    return `${cab(`<button class="btn ghost sm" data-act="asaas-atualizar" aria-label="Atualizar">${ic('refresh')}</button><button class="btn pri sm" data-act="nova-cobranca">${ic('plus')}Nova cobrança</button>`)}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:8px">
        <div class="hintbox" style="margin:0;background:var(--verde-s)"><div class="k lbl">Recebido</div><b class="num" style="font:700 18px var(--ui);color:var(--verde-ink)">${brl(t.recebido)}</b></div>
        <div class="hintbox" style="margin:0;background:var(--pet-s)"><div class="k lbl">A receber</div><b class="num" style="font:700 18px var(--ui);color:var(--petroleo)">${brl(t.pendente)}</b></div>
        <div class="hintbox" style="margin:0;background:var(--coral-s)"><div class="k lbl">Atrasado</div><b class="num" style="font:700 18px var(--ui);color:var(--coral-ink)">${brl(t.atrasado)}</b></div></div>
      <div class="list">${pags.map((p) => { const s = STATUS_PAG[p.status] || STATUS_PAG.outro;
        return `<div class="li"><span class="li-ic ${p.status === 'pago' ? 'ic-verde' : p.status === 'atrasado' ? 'ic-coral' : 'ic-pet'}">${ic('receipt')}</span><div class="li-t"><b>${esc(p.cliente || 'Cliente')}</b><span>${esc(p.descricao || 'Cobrança')} · vence ${dataBR(p.vencimento)}</span></div>
        <div class="li-r"><b class="num" style="font:700 15px var(--ui)">${brl(p.valor)}</b><br><span class="chip ${s[0]}" style="margin-top:4px">${s[1]}</span></div></div>`; }).join('') || '<p class="lbl">Nenhuma cobrança neste período.</p>'}</div>`;
  }
  const msg = {
    'sem-banco': 'A conexão com o Asaas funciona quando o painel está no ar, com login das sócias. Aqui, no modo local, ela fica desligada.',
    'nao-configurado': 'A chave do Asaas ainda não foi guardada no servidor. Quando for, aqui aparecem o que foi pago, o que está pendente e o que atrasou.',
    erro: 'Não consegui falar com o Asaas agora. Confira a chave e tente de novo.',
  }[r.estado] || '';
  return `${cab(r.estado === 'erro' ? `<button class="btn sec sm" data-act="asaas-atualizar">${ic('refresh')}Tentar de novo</button>` : '')}
    <div style="display:flex;gap:16px;align-items:flex-start"><span class="li-ic ic-pet" style="width:48px;height:48px;font-size:24px;border-radius:50%;display:grid;place-items:center;flex:none">${ic('plug')}</span>
    <div><p>${esc(msg)}</p><p class="lbl" style="margin-top:8px">Passo a passo no arquivo LEIA-ME.md, seção “Passo 4: conectar o Asaas”. A chave nunca fica exposta no site.</p></div></div>`;
}

export default {
  titulo: () => 'Financeiro',
  sub: () => 'Receitas, despesas e resultado de cada mês.',

  render() {
    const s = ym();
    const r = resumoMes(s);
    const m = metricas();
    const itens = m.ativos.map((c) => ({ nome: c.nome, valor: c.mensalidade }));
    const legenda = itens.map((it, i) => `<div class="lg"><span class="sw" style="background:${CORES[i % CORES.length]}"></span><div><b>${esc(it.nome)}</b><small class="num">${brl(it.valor)} por mês</small></div><span class="pct num">${Math.round((it.valor / m.mrr) * 100)}%</span></div>`).join('');
    const negativo = r.resultado < 0;

    const mensalidades = r.fixos.map((c) => `<div class="li click" data-act="ir" data-rota="clientes" data-ref="${c.id}"><span class="li-ic ic-verde">${ic('users')}</span>
      <div class="li-t"><b>Mensalidade, ${esc(c.nome)}</b><span>Contrato${c.status === 'encerrando' ? ' · encerrando' : ''}</span></div>
      <div class="li-r"><b class="num" style="font:700 15px var(--ui)">${brl(c.mensalidade)}</b><br><span class="chip ${c.status === 'encerrando' ? 'warn' : 'mute'}">${c.status === 'encerrando' ? 'Encerrando' : 'Contrato'}</span></div></div>`).join('');

    const resultadoCli = r.porCliente.map((x) => `<div class="li"><span class="li-ic ic-pet">${ic('users')}</span>
      <div class="li-t"><b>${esc(x.cliente.nome)}</b><span>Receita ${brl(x.receita)} · custos atribuídos ${brl(x.custo)}</span></div>
      <div class="li-r"><b class="num" style="font:700 15px var(--ui)">${brl(x.resultado)}</b><br><span class="chip ${x.resultado >= 0 ? 'ok' : 'warn'}">${x.margem}% de margem</span></div></div>`).join('');

    return `<div class="toolbar">
      <div class="mes"><button class="iconbtn" data-act="mes-anterior" aria-label="Mês anterior"><span style="display:grid;transform:scaleX(-1)">${ic('chev')}</span></button>
        <b>${esc(rotuloMes(s))}</b><button class="iconbtn" data-act="mes-proximo" aria-label="Próximo mês">${ic('chev')}</button>
        ${s !== ymAtual() ? '<button class="btn ghost sm" data-act="mes-hoje">Mês atual</button>' : ''}</div>
      <div class="actions"><button class="btn sec" data-act="nova-receita">${ic('plus')}Receita</button><button class="btn pri" data-act="nova-despesa">${ic('plus')}Despesa</button></div>
    </div>

    <div class="grid">
      <div class="card hl stat" style="align-items:flex-start"><div><div class="lbl">Receita do mês</div><div class="big num">${brl(r.receita)}</div><div class="hint">Mensalidades ${brl(r.receitaFixa)}${r.receita - r.receitaFixa ? ` + extras ${brl(r.receita - r.receitaFixa)}` : ''}</div></div></div>
      <div class="card stat tone-coral"><div><div class="lbl">Despesas do mês</div><div class="big num">${brl(r.custos)}</div><div class="hint">Fixas ${brl(r.fixas)} · variáveis ${brl(r.variaveis)}</div></div><span class="stat-ic">${ic('receipt')}</span></div>
      <div class="card stat tone-verde"><div><div class="lbl">Resultado</div><div class="big num" style="${negativo ? 'color:var(--coral-ink)' : ''}">${brl(r.resultado)}</div><div class="hint">Receitas menos despesas</div></div><span class="stat-ic">${ic('wallet')}</span></div>
      <div class="card stat tone-creme"><div><div class="lbl">Margem</div><div class="big num">${r.receita ? r.margem + '%' : '–'}</div><div class="hint">Quanto sobra de cada real que entra</div></div><span class="stat-ic">${ic('bars')}</span></div>

      <div class="card c2">
        <div class="card-h"><div><h2>Receitas do mês</h2><p class="sub">Mensalidades dos contratos e receitas extras</p></div><button class="btn sec sm" data-act="nova-receita">${ic('plus')}Receita</button></div>
        <div class="list">${mensalidades}${r.receitasExtras.map(linhaLanc).join('') || ''}</div>
        ${!r.fixos.length && !r.receitasExtras.length ? '<p class="lbl">Nenhuma receita neste mês.</p>' : ''}
        <div class="hintbox">Os valores das mensalidades vêm da ficha de cada cliente. Para mudar, use “Editar ficha” em Clientes.</div>
      </div>

      <div class="card c2">
        <div class="card-h"><div><h2>Despesas do mês</h2><p class="sub">Fixas se repetem todo mês; as outras valem só para este mês</p></div><button class="btn pri sm" data-act="nova-despesa">${ic('plus')}Despesa</button></div>
        ${r.despesas.length ? `<div class="list">${r.despesas.map(linhaLanc).join('')}</div>` : `<div class="empty" style="padding:24px 8px">${flor()}<h2 style="font-size:17px">Nenhuma despesa registrada</h2><p>Comece pelas fixas: ferramentas, impostos, contador e pró-labore. Assim o resultado mostra o lucro de verdade.</p><button class="btn pri sm" data-act="nova-despesa">${ic('plus')}Registrar despesa</button></div>`}
      </div>

      <div class="card c2"><h2>Receita por cliente</h2><p class="sub">Participação de cada contrato fixo</p>
        ${m.mrr ? `<div class="row-flex"><div class="donut">${donut(itens, m.mrr)}<div class="d-c"><b class="num">${brl(m.mrr)}</b><span>por mês</span></div></div><div class="legend">${legenda}</div></div>` : '<p class="lbl">Cadastre clientes com valor mensal.</p>'}
        <div class="hintbox">Ticket médio ${brl(m.ticket)} por cliente${m.maior ? ` · maior contrato: ${esc(m.maior.nome)}` : ''}.${m.encerrando.length ? ` ${esc(m.encerrando.map((c) => `${c.nome} contribuiu ${brl(c.mensalidade)} por mês`).join('; '))} até o encerramento e não entra na receita recorrente.` : ''}</div>
      </div>
      <div class="card c2" data-asaas><p class="lbl">Carregando…</p></div>

      <div class="card c4"><h2>Resultado por cliente</h2><p class="sub">Receita menos as despesas atribuídas a cada cliente em ${esc(rotuloMes(s))}</p>
        <div class="list">${resultadoCli || '<p class="lbl">Sem clientes com mensalidade neste mês.</p>'}</div>
        <div class="hintbox">Ao registrar uma despesa, escolha “Custo de um cliente” para ver a margem real de cada um.</div>
      </div>
    </div>`;
  },

  async montar(el, forcar = false) {
    const alvo = el.querySelector('[data-asaas]');
    if (!alvo) return;
    const r = await asaas.resumo(forcar);
    if (alvo.isConnected) alvo.innerHTML = cartaoAsaas(r);
  },

  acoes: {
    'mes-anterior': () => trocarMes(-1),
    'mes-proximo': () => trocarMes(1),
    'mes-hoje': () => { mes = null; window.dispatchEvent(new HashChangeEvent('hashchange')); },
    'nova-receita': () => abrirLancamento('receita'),
    'nova-despesa': () => abrirLancamento('despesa'),
    'editar-lanc': (el) => { const l = store.obter('lancamento', el.dataset.id); if (l) abrirLancamento(l.tipo, l); },
    'pagar-lanc': async (el) => {
      const l = store.obter('lancamento', el.dataset.id);
      await store.salvar('lancamento', { ...l, status: 'pago' });
      toast(l.tipo === 'despesa' ? 'Marcada como paga' : 'Marcada como recebida');
    },
    'asaas-atualizar': async () => {
      asaas.limpar();
      const alvo = document.querySelector('[data-asaas]');
      if (alvo) alvo.innerHTML = '<p class="lbl">Atualizando…</p>';
      const r = await asaas.resumo(true);
      if (alvo?.isConnected) alvo.innerHTML = cartaoAsaas(r);
    },
    'nova-cobranca': () => {
      const clientes = store.todos('cliente').filter((c) => c.status !== 'inativo');
      formulario({
        titulo: 'Nova cobrança', subtitulo: 'A cobrança é criada direto no Asaas.',
        campos: [
          { nome: 'clienteId', rotulo: 'Cliente', tipo: 'select', cheio: true, opcoes: clientes.map((c) => ({ v: c.id, t: c.nome })) },
          { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'dinheiro', obrigatorio: true },
          { nome: 'vencimento', rotulo: 'Vencimento', tipo: 'data', obrigatorio: true },
          { nome: 'forma', rotulo: 'Forma de pagamento', tipo: 'select', opcoes: [{ v: 'PIX', t: 'Pix' }, { v: 'BOLETO', t: 'Boleto' }, { v: 'UNDEFINED', t: 'Cliente escolhe' }] },
          { nome: 'descricao', rotulo: 'Descrição', placeholder: 'Mensalidade de…' },
        ],
        valores: { clienteId: clientes[0]?.id, vencimento: hojeISO(), forma: 'PIX' },
        salvarTexto: 'Criar cobrança',
        async aoSalvar(v) {
          const c = store.obter('cliente', v.clienteId);
          await asaas.criarCobranca({ nome: c.empresa?.razao || c.nome, cpfCnpj: (c.empresa?.cnpj || '').replace(/\D/g, ''), valor: v.valor, vencimento: v.vencimento, forma: v.forma, descricao: v.descricao || `Bôdhi Marketing, ${c.nome}` });
          toast('Cobrança criada no Asaas');
          asaas.limpar();
          document.dispatchEvent(new CustomEvent('acionar', { detail: { acao: 'asaas-atualizar', dados: {} } }));
        },
      });
    },
  },
};
