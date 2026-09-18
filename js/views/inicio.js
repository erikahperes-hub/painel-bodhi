import { store } from '../store.js';
import { metricas, alertas, faixaProposta } from '../calc.js';
import { brl, esc, dataBR, diasTxt, diasAte } from '../util.js';
import { ic } from '../icons.js';
import { asaas } from '../asaas.js';

const wave = '<svg class="wave" viewBox="0 0 120 54" fill="none" aria-hidden="true"><path d="M4 40c10-2 12-26 24-26s10 30 22 30 12-34 26-34 12 24 22 24 12-8 18-12" stroke="#23BB84" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function gauge(pct) {
  const t = Math.PI * (1 - Math.min(100, pct) / 100);
  const x = 100 + 80 * Math.cos(t), y = 100 - 80 * Math.sin(t);
  return `<svg viewBox="0 0 200 112" role="img" aria-label="${pct}%"><path d="M20 100A80 80 0 0 1 180 100" fill="none" stroke="#F3EEE2" stroke-width="22" stroke-linecap="round"/>
    <path d="M20 100A80 80 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="#073F56" stroke-width="22" stroke-linecap="round"/></svg>`;
}

export default {
  titulo: () => 'Oi, Bôdhi',
  sub: () => 'Aqui está o resumo da operação de hoje.',

  render() {
    const m = metricas();
    const al = alertas();
    const todos = [...m.ativos, ...m.encerrando].sort((a, b) => b.mensalidade - a.mensalidade);
    const maxV = Math.max(1, ...todos.map((c) => c.mensalidade));
    const alturas = todos.slice(0, 6).map((c) => {
      const cls = c.status === 'encerrando' ? 'c' : c === m.maior ? 'p' : '';
      return `<i class="${cls}" style="height:${Math.max(14, Math.round((c.mensalidade / maxV) * 46))}px" title="${esc(c.nome)}"></i>`;
    }).join('');

    const potTxt = [
      m.potRec ? `${brl(m.potRec)}/mês recorrente` : '',
      m.potAvuMax ? (m.potAvuMin === m.potAvuMax ? brl(m.potAvuMax) : `${brl(m.potAvuMin)} a ${brl(m.potAvuMax)}`) + ' avulso' : '',
    ].filter(Boolean).join(' + ');

    const ren = m.renovacao;
    const cliRen = ren ? store.obter('cliente', ren.contrato.clienteId)?.nome || ren.contrato.contratanteNome : '';

    const encNota = m.encerrando.length
      ? `Com o fim de ${m.encerrando.map((c) => c.nome).join(' e ')}, a receita mensal passa de ${brl(m.mrrAgora)} para ${brl(m.mrr)}.`
      : `${m.ativos.length} clientes fixos hoje.`;

    const linhasBarra = todos.map((c) => `<div class="bar-row"><div class="bar-top"><span>${esc(c.nome)} ${c.status === 'encerrando' ? '<span class="chip warn" style="margin-left:6px">Encerrando</span>' : ''}</span><span>${brl(c.mensalidade)}</span></div>
      <div class="bar-track"><div class="bar-fill ${c.status === 'encerrando' ? 'stripe' : ''}" style="width:${Math.round((c.mensalidade / maxV) * 100)}%;${c.status === 'encerrando' ? '' : `background:${c === m.maior ? 'var(--petroleo)' : 'var(--verde)'}`}"></div></div></div>`).join('');

    const listaAl = al.slice(0, 6).map((a) => `<div class="li click" data-act="ir" data-rota="${a.rota}" data-ref="${esc(a.ref || '')}">
      <span class="li-ic ${a.tipo === 'warn' ? 'ic-coral' : a.tipo === 'info' ? 'ic-pet' : 'ic-graf'}">${ic(a.icone)}</span>
      <div class="li-t"><b>${esc(a.titulo)}</b><span>${esc(a.texto)}</span></div></div>`).join('');

    const listaProp = m.abertas.map((p) => {
      const f = faixaProposta(p);
      const valor = !f.max ? '' : f.min === f.max ? brl(f.max) : `${brl(f.min)} a ${brl(f.max)}`;
      return `<div class="li click" data-act="ir" data-rota="propostas" data-ref="${p.id}">
        <span class="li-ic ic-pet">${ic('send')}</span>
        <div class="li-t"><b>${esc(p.clienteNome)}</b><span>${esc(p.titulo)}</span></div>
        <div class="li-r"><b class="num" style="font:700 15px var(--ui)">${valor}${p.tipo === 'recorrente' ? '<small style="font:400 12px var(--ui);color:var(--ink-2)"> /mês</small>' : ''}</b></div></div>`;
    }).join('') || '<p class="lbl">Nenhuma proposta aguardando resposta.</p>';

    return `<div class="grid">
      <div class="card stat">
        <div><div class="lbl">Receita recorrente</div><div class="big num">${brl(m.mrr)}<small style="font:400 13px var(--ui);color:var(--ink-2)"> /mês</small></div><div class="hint">${m.ativos.length} clientes fixos</div></div>
        <div class="minibars" aria-hidden="true">${alturas}</div>
      </div>
      <div class="card stat tone-verde">
        <div><div class="lbl">Clientes ativos</div><div class="big num">${m.ativos.length}</div><div class="hint">${esc(m.ativos.map((c) => c.nome).join(' e '))}</div></div>
        <span class="stat-ic">${ic('users')}</span>
      </div>
      <div class="card stat tone-creme">
        <div><div class="lbl">Propostas em aberto</div><div class="big num">${m.abertas.length}</div><div class="hint">${esc(potTxt || 'Sem valor em aberto')}</div></div>
        <span class="stat-ic">${ic('send')}</span>
      </div>
      <div class="card hl stat" style="align-items:flex-start">
        <div><div class="lbl">Próxima renovação</div>
          <div class="big num">${ren ? dataBR(ren.contrato.fim) : 'Sem datas'}</div>
          <div class="hint">${ren ? `${esc(cliRen)} · ${diasTxt(ren.dias)}` : 'Cadastre a vigência nos contratos'}</div></div>${wave}
      </div>

      <div class="card c2">
        <div class="card-h"><div><h2>Receita mensal por cliente</h2><p class="sub">Contratos fixos, do maior para o menor</p></div>
          <button class="btn sec sm" data-act="ir" data-rota="financeiro">Ver financeiro</button></div>
        ${linhasBarra || '<p class="lbl">Cadastre os clientes para ver a receita.</p>'}
        <div class="hintbox">${esc(encNota)}</div>
      </div>

      <div class="card">
        <h2>Concentração</h2><p class="sub">Peso do maior cliente</p>
        <div class="gauge">${gauge(m.maiorParte)}<div class="g-v num">${m.maiorParte}%</div>
          <div class="g-l">da receita recorrente vem de <b>${esc(m.maior?.nome || '')}</b></div>
          ${m.maiorParte >= 60 ? '<span class="chip warn" style="margin-top:12px">Atenção: depende muito de um cliente</span>' : '<span class="chip ok" style="margin-top:12px">Receita bem distribuída</span>'}
        </div>
      </div>

      <div class="card r2">
        <div class="card-h"><div><h2>Pede atenção agora</h2><p class="sub">${al.length ? `${al.length} ${al.length === 1 ? 'ponto' : 'pontos'} em aberto` : 'Tudo em dia'}</p></div></div>
        <div class="list">${listaAl || '<p class="lbl">Nada pendente por aqui.</p>'}</div>
      </div>

      <div class="card c2">
        <div class="card-h"><div><h2>Propostas em aberto</h2><p class="sub">Enviadas, aguardando retorno do cliente</p></div>
          <button class="btn pri sm" data-act="nova-proposta">${ic('plus')}Nova proposta</button></div>
        <div class="list">${listaProp}</div>
      </div>

      <div class="card" data-asaas-home>
        <h2>Cobranças no Asaas</h2><p class="sub">Pago, pendente e atrasado</p>
        <p class="lbl">Carregando…</p>
      </div>
    </div>`;
  },

  async montar(el) {
    const alvo = el.querySelector('[data-asaas-home]');
    if (!alvo) return;
    const r = await asaas.resumo();
    if (!alvo.isConnected) return;
    if (r.estado === 'conectado') {
      const t = r.totais || {};
      alvo.innerHTML = `<h2>Cobranças no Asaas</h2><p class="sub">Mês atual</p>
        <div class="list"><div class="li"><span class="li-ic ic-verde">${ic('check')}</span><div class="li-t"><b>Recebido</b></div><div class="li-r num"><b>${brl(t.recebido)}</b></div></div>
        <div class="li"><span class="li-ic ic-pet">${ic('calendar')}</span><div class="li-t"><b>A receber</b></div><div class="li-r num"><b>${brl(t.pendente)}</b></div></div>
        <div class="li"><span class="li-ic ic-coral">${ic('alert')}</span><div class="li-t"><b>Atrasado</b></div><div class="li-r num"><b>${brl(t.atrasado)}</b></div></div></div>`;
      return;
    }
    const msg = r.estado === 'sem-banco' ? 'Disponível quando o painel estiver no ar, com login das sócias.'
      : r.estado === 'erro' ? 'Não consegui falar com o Asaas agora. Tente de novo em instantes.'
      : 'Conecte o Asaas para ver aqui o que foi pago e o que está pendente.';
    alvo.innerHTML = `<h2>Cobranças no Asaas</h2><p class="sub">Pago, pendente e atrasado</p>
      <div style="display:flex;gap:14px;align-items:flex-start"><span class="li-ic ic-pet" style="width:44px;height:44px;font-size:22px;border-radius:50%;display:grid;place-items:center;flex:none">${ic('plug')}</span>
      <div><p style="font-size:14.5px">${esc(msg)}</p><button class="btn sec sm" style="margin-top:12px" data-act="ir" data-rota="financeiro">Ver como conectar</button></div></div>`;
  },

  acoes: {},
};
