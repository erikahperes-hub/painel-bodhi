import { store } from '../store.js';
import { metricas } from '../calc.js';
import { brl, esc, dataBR, toast, hojeISO } from '../util.js';
import { ic } from '../icons.js';
import { asaas } from '../asaas.js';
import { formulario } from '../ui.js';

const CORES = ['#073F56', '#23BB84', '#E96A6A', '#292B2D'];
const STATUS_PAG = { pago: ['ok', 'Pago'], pendente: ['info', 'Pendente'], atrasado: ['warn', 'Atrasado'], outro: ['mute', 'Outro'] };

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
    'nao-configurado': 'O painel já está no ar, mas a chave do Asaas ainda não foi guardada no servidor.',
    erro: 'Não consegui falar com o Asaas agora. Confira a chave e tente de novo.',
  }[r.estado] || '';
  return `${cab(r.estado === 'erro' ? `<button class="btn sec sm" data-act="asaas-atualizar">${ic('refresh')}Tentar de novo</button>` : '')}
    <div style="display:flex;gap:16px;align-items:flex-start"><span class="li-ic ic-pet" style="width:48px;height:48px;font-size:24px;border-radius:50%;display:grid;place-items:center;flex:none">${ic('plug')}</span>
    <div><p>${esc(msg)}</p><p class="lbl" style="margin-top:8px">Passo a passo no arquivo LEIA-ME.md, seção “Conectar o Asaas”. A chave nunca fica exposta no site.</p></div></div>`;
}

export default {
  titulo: () => 'Financeiro',
  sub: () => 'Receita recorrente, cobranças e o que ainda falta mapear.',

  render() {
    const m = metricas();
    const itens = m.ativos.map((c) => ({ nome: c.nome, valor: c.mensalidade }));
    const legenda = itens.map((it, i) => `<div class="lg"><span class="sw" style="background:${CORES[i % CORES.length]}"></span><div><b>${esc(it.nome)}</b><small class="num">${brl(it.valor)} por mês</small></div><span class="pct num">${Math.round((it.valor / m.mrr) * 100)}%</span></div>`).join('');
    return `<div class="grid">
      <div class="card hl stat" style="align-items:flex-start"><div><div class="lbl">Receita recorrente mensal</div><div class="big num">${brl(m.mrr)}</div><div class="hint">Soma dos ${m.ativos.length} contratos fixos</div></div></div>
      <div class="card stat tone-verde"><div><div class="lbl">Ticket médio por cliente</div><div class="big num">${brl(m.ticket)}</div><div class="hint">Entre os clientes fixos</div></div><span class="stat-ic">${ic('wallet')}</span></div>
      <div class="card stat tone-creme c2"><div><div class="lbl">Maior contrato</div><div class="big" style="font-size:24px">${esc(m.maior?.nome || '–')}</div><div class="hint">${m.maior ? brl(m.maior.mensalidade) + ' por mês' : ''}</div></div><span class="stat-ic">${ic('bars')}</span></div>

      <div class="card c2"><h2>Receita por cliente</h2><p class="sub">Participação de cada contrato fixo</p>
        ${m.mrr ? `<div class="row-flex"><div class="donut">${donut(itens, m.mrr)}<div class="d-c"><b class="num">${brl(m.mrr)}</b><span>por mês</span></div></div><div class="legend">${legenda}</div></div>` : '<p class="lbl">Cadastre clientes com valor mensal.</p>'}
        ${m.encerrando.length ? `<div class="hintbox">Histórico: ${esc(m.encerrando.map((c) => `${c.nome} contribuiu ${brl(c.mensalidade)} por mês`).join('; '))} até o encerramento. Não entra na receita recorrente porque o contrato termina.</div>` : ''}
      </div>
      <div class="card c2" data-asaas><p class="lbl">Carregando…</p></div>

      <div class="card c4"><h2>O que ainda falta mapear aqui</h2><p class="sub">Esta frente por enquanto só tem receita. O resto entra quando vocês passarem os números.</p>
        <ul class="bullets"><li>Despesas fixas e variáveis da operação</li><li>Lucro e margem por cliente</li></ul></div>
    </div>`;
  },

  async montar(el, forcar = false) {
    const alvo = el.querySelector('[data-asaas]');
    if (!alvo) return;
    const r = await asaas.resumo(forcar);
    if (alvo.isConnected) alvo.innerHTML = cartaoAsaas(r);
  },

  acoes: {
    'asaas-atualizar': async (el) => {
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
