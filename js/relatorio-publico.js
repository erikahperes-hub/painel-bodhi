import { config } from './config.js?v=118';
import { logo } from './logo.js?v=118';
import { ligarDicas } from './dicas.js?v=118';
import { esc, hojeISO } from './util.js?v=118';
import { ic, flor } from './icons.js?v=118';
import { corpoRelatorio, ligarIndice, ymAnterior, ymMais, nomeMes } from './relatorio-html.js?v=118';

// Página pública do relatório do cliente. Não tem login: o código do link (depois do #) identifica o cliente.
// O banco só entrega os números DELE (função relatorio_ver): resultados do Instagram, stories, entregas do mês e metas.
const SB_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const app = document.getElementById('app');
const token = location.hash.replace(/^#\/?/, '').trim();
const NOME_FORMATO = { reels: 'Reels', carrossel: 'Carrossel', feed: 'Estático', story: 'Story' };

function aviso(titulo, texto) {
  app.innerHTML = `<div class="setup"><div class="card empty">${flor()}<h2>${esc(titulo)}</h2><p>${esc(texto)}</p></div></div>`;
}

ligarDicas();

async function iniciar() {
  if (!/^[0-9a-f]{20,}$/i.test(token)) return aviso('Link incompleto', 'Confira se você copiou o link inteiro ou peça um novo para a Bôdhi Marketing.');
  const { createClient } = await import(SB_CDN);
  const sb = createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc('relatorio_ver', { p_token: token });
  if (error) throw error;
  if (!data) return aviso('Este link não está mais ativo', 'Peça um novo link do relatório para a Bôdhi Marketing.');

  const cliente = data.cliente;
  const serie = Object.fromEntries((data.insights || []).map((i) => [i.mes, i]));
  const meses = Object.keys(serie).sort();
  const fechado = ymAnterior(hojeISO().slice(0, 7));
  let ym = serie[fechado] ? fechado : meses[meses.length - 1] || fechado;
  document.title = `Relatório de desempenho · ${cliente.nome}`;

  const entregasDoMes = (m) => {
    const lista = (data.entregas || []).filter((e) => e.mes === m);
    return { total: lista.reduce((t, e) => t + e.n, 0), porFormato: lista.map((e) => [NOME_FORMATO[e.formato] || e.formato, e.n]) };
  };
  const storiesDoMes = (m) => (data.stories || []).filter((s) => String(s.dados?.data || '').slice(0, 7) === m);

  function desenhar() {
    const atual = serie[ym];
    const primeiro = meses[0] || ym;
    const ultimo = meses[meses.length - 1] || ym;
    const nav = `<div class="toolbar no-print" style="margin:0 0 14px"><div class="mes">
        <button class="iconbtn" data-passo="-1" aria-label="Mês anterior" ${ym <= primeiro ? 'disabled' : ''}><span style="display:grid;transform:scaleX(-1)">${ic('chev')}</span></button>
        <b>${esc(nomeMes(ym))}</b>
        <button class="iconbtn" data-passo="1" aria-label="Próximo mês" ${ym >= ultimo ? 'disabled' : ''}>${ic('chev')}</button></div>
        ${atual ? `<button class="btn sec sm" data-imprimir>${ic('printer')}Salvar em PDF</button>` : ''}</div>`;
    const corpo = atual
      ? `<div class="rl">${corpoRelatorio({ cliente, ym, atual, anterior: serie[ymAnterior(ym)], serie, producao: entregasDoMes(ym), stories: storiesDoMes(ym), storiesAnt: storiesDoMes(ymAnterior(ym)), painel: false })}</div>`
      : `<div class="card empty">${flor()}<h2>Ainda não há números deste mês</h2><p>Use as setas para ver os outros meses.</p></div>`;
    app.innerHTML = `<div class="pub">
      <header class="pub-h"><a href="https://bodhi.marketing" aria-label="Bôdhi Marketing" rel="noopener">${logo('verde', '#F8F4EA')}</a><p>Relatório de desempenho</p></header>
      ${nav}${corpo}
      <p class="pub-f">Bôdhi Marketing · Se tiver qualquer dúvida, é só nos chamar.</p></div>`;
    app.querySelectorAll('[data-passo]').forEach((b) => b.addEventListener('click', () => { ym = ymMais(ym, Number(b.dataset.passo)); desenhar(); window.scrollTo(0, 0); }));
    app.querySelector('[data-imprimir]')?.addEventListener('click', () => window.print());
    ligarIndice();
  }
  desenhar();
}

iniciar().catch((err) => {
  console.error(err);
  aviso('Não consegui abrir a página', 'Verifique sua conexão com a internet e tente de novo em instantes. Se continuar, avise a Bôdhi Marketing.');
});
