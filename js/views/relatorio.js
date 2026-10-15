import { store } from '../store.js?v=81';
import { esc, toast, mesNome, norm, hojeISO, dataBR, urlSegura } from '../util.js?v=81';
import { ic, flor } from '../icons.js?v=81';
import { formulario } from '../ui.js?v=81';
import { FORMATOS, pecas } from '../conteudo.js?v=81';

// Relatório mensal do cliente nas redes sociais. Começa pelo Instagram.
// Cada mês de cada cliente é um registro `insights` (id "clienteId_AAAA-MM"). Os números chegam por importação
// (arquivo ou texto em JSON, que o Claude Code monta) e, depois, direto do Instagram.
const recarregarTela = () => window.dispatchEvent(new Event('atualizar-tela'));
let mes = null; // AAAA-MM mostrado; vazio = mês anterior ao atual (o último mês fechado)

const CAMPOS = [
  ['alcance', 'Alcance', 'Contas diferentes que viram o perfil ou as publicações'],
  ['visualizacoes', 'Visualizações', 'Quantas vezes o conteúdo foi visto'],
  ['interacoes', 'Interações', 'Curtidas, comentários, salvamentos e compartilhamentos'],
  ['visitasPerfil', 'Visitas ao perfil', 'Pessoas que abriram o perfil'],
];
const num = (n) => (n === null || n === undefined || n === '' ? '–' : Number(n).toLocaleString('pt-BR'));
const ymAnterior = (ym) => { const [a, m] = ym.split('-').map(Number); const d = new Date(a, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const ymMais = (ym, passo) => { const [a, m] = ym.split('-').map(Number); const d = new Date(a, m - 1 + passo, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const mesPadrao = () => ymAnterior(hojeISO().slice(0, 7));
const nomeMes = (ym) => { const n = mesNome(Number(ym.slice(5, 7)) - 1); return `${n[0].toUpperCase()}${n.slice(1)} de ${ym.slice(0, 4)}`; };
const idInsight = (clienteId, ym) => `${clienteId}_${ym}`;
const temNumero = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));

function variacao(atual, antes) {
  if (!temNumero(atual) || !temNumero(antes) || Number(antes) === 0) return '';
  const p = ((Number(atual) - Number(antes)) / Number(antes)) * 100;
  const cls = p > 0.5 ? 'ok' : p < -0.5 ? 'warn' : 'mute';
  return `<span class="chip ${cls}" title="Comparado com o mês anterior">${p > 0 ? '+' : ''}${p.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</span>`;
}

function clientesDoRelatorio() {
  const comDados = new Set(store.todos('insights').map((i) => i.clienteId));
  return store.todos('cliente')
    .filter((c) => c.status !== 'inativo' || comDados.has(c.id))
    .filter((c) => c.instagram || comDados.has(c.id))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

// O que a Bôdhi produziu no mês, a partir das tarefas do Conteúdo (publicadas ou aprovadas com data no mês).
function producaoDoMes(clienteId, ym) {
  const lista = pecas().filter((p) => p.clienteId === clienteId && (p.publicar || '').slice(0, 7) === ym && ['aprovado', 'publicado'].includes(p.etapa));
  const porFormato = Object.keys(FORMATOS).map((f) => [FORMATOS[f].nome, lista.filter((p) => (FORMATOS[p.formato] ? p.formato : 'feed') === f).length]).filter(([, n]) => n);
  return { total: lista.length, porFormato };
}

function seletorMes(ym) {
  const padrao = mesPadrao();
  return `<div class="toolbar" style="margin-bottom:12px"><div class="mes">
      <button class="iconbtn" data-act="rel-mes" data-passo="-1" aria-label="Mês anterior"><span style="display:grid;transform:scaleX(-1)">${ic('chev')}</span></button>
      <b>${nomeMes(ym)}</b>
      <button class="iconbtn" data-act="rel-mes" data-passo="1" aria-label="Próximo mês">${ic('chev')}</button>
      ${ym !== padrao ? '<button class="btn ghost sm" data-act="rel-mes" data-passo="0">Último mês fechado</button>' : ''}</div></div>`;
}

function cartaoPost(p) {
  const f = FORMATOS[p.formato] ? FORMATOS[p.formato].nome : (p.tipo || 'Publicação');
  const url = urlSegura(p.link);
  const titulo = esc(String(p.legenda || p.titulo || '(sem legenda)').split('\n')[0].slice(0, 90));
  return `<div class="li"><span class="li-ic ic-graf">${ic('image')}</span><div class="li-t"><b>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${titulo}</a>` : titulo}</b>
    <span>${esc(f)}${p.data ? ` · ${esc(dataBR(p.data))}` : ''} · alcance ${num(p.alcance)} · interações ${num(p.interacoes)}${temNumero(p.salvamentos) ? ` · salvamentos ${num(p.salvamentos)}` : ''}</span></div></div>`;
}

function blocoCliente(c, ym) {
  const atual = store.obter('insights', idInsight(c.id, ym));
  const antes = store.obter('insights', idInsight(c.id, ymAnterior(ym)));
  const prod = producaoDoMes(c.id, ym);
  const cab = `<div class="card-h"><div><h2>${esc(c.nome)}${c.instagram ? ` <span class="lbl" style="font-weight:600">${esc(c.instagram)}</span>` : ''}</h2>
      <p class="sub">Instagram em ${nomeMes(ym)}${atual?.fonte === 'instagram' ? ', direto do Instagram' : atual ? ', dados importados' : ''}.</p></div>
      <div class="actions no-print"><button class="btn sec sm" data-act="rel-importar" data-cliente="${esc(c.id)}">${ic('upload')}Importar dados</button>
        ${atual ? `<button class="btn sec sm" data-act="rel-imprimir">${ic('printer')}Imprimir ou salvar PDF</button>` : ''}</div></div>`;
  if (!atual) {
    return `<div class="card">${cab}<div class="empty" style="padding:26px 10px">${flor()}<h2>Sem números deste mês</h2>
      <p>Importe os dados do Instagram de ${nomeMes(ym)} (botão acima). Enquanto isso, o painel já mostra o que foi produzido.</p>
      ${prod.total ? `<p class="lbl">Produzido no mês: ${prod.total} ${prod.total === 1 ? 'tarefa' : 'tarefas'} (${prod.porFormato.map(([n, q]) => `${q} ${n}`).join(', ')}).</p>` : ''}</div></div>`;
  }
  const seg = temNumero(atual.seguidores)
    ? `<div class="card stat tone-verde"><div><div class="lbl">Seguidores</div><div class="big num">${num(atual.seguidores)}</div>
        <div class="hint">${temNumero(atual.seguidoresGanhos) ? `${Number(atual.seguidoresGanhos) >= 0 ? '+' : ''}${num(atual.seguidoresGanhos)} no mês` : 'Ao fim do mês'}</div></div><span class="stat-ic">${ic('users')}</span></div>` : '';
  const cartoes = CAMPOS.filter(([k]) => temNumero(atual[k])).map(([k, nome, dica], i) =>
    `<div class="card stat ${['tone-creme', 'tone-verde', 'tone-coral', 'tone-creme'][i % 4]}"><div><div class="lbl">${nome}</div><div class="big num">${num(atual[k])}</div>
      <div class="hint">${variacao(atual[k], antes?.[k])} ${esc(dica)}</div></div></div>`).join('');
  const posts = [...(atual.posts || [])].sort((a, b) => (Number(b.alcance) || 0) - (Number(a.alcance) || 0));
  const melhores = posts.slice(0, 5);
  const tipos = posts.length ? Object.entries(posts.reduce((m, p) => { const t = FORMATOS[p.formato]?.nome || p.tipo || 'Outro'; (m[t] ||= []).push(Number(p.alcance) || 0); return m; }, {}))
    .map(([t, v]) => [t, v.length, Math.round(v.reduce((a, b) => a + b, 0) / v.length)]).sort((a, b) => b[2] - a[2]) : [];
  return `<div class="card">${cab}</div>
    <div class="grid" style="margin:16px 0">${seg}${cartoes}</div>
    ${melhores.length ? `<div class="card" style="margin-bottom:16px"><div class="card-h"><div><h2>Publicações que mais alcançaram</h2><p class="sub">${posts.length} ${posts.length === 1 ? 'publicação' : 'publicações'} no mês, em ordem de alcance.</p></div></div><div class="list">${melhores.map(cartaoPost).join('')}</div></div>` : ''}
    ${tipos.length > 1 ? `<div class="card" style="margin-bottom:16px"><div class="card-h"><div><h2>Qual formato funcionou melhor</h2><p class="sub">Alcance médio por tipo de publicação.</p></div></div>
      <div class="list">${tipos.map(([t, q, m]) => `<div class="li"><div class="li-t"><b>${esc(t)}</b><span>${q} ${q === 1 ? 'publicação' : 'publicações'} · alcance médio ${num(m)}</span></div></div>`).join('')}</div></div>` : ''}
    ${prod.total ? `<div class="card" style="margin-bottom:16px"><div class="card-h"><div><h2>O que a Bôdhi entregou no mês</h2><p class="sub">Tarefas de Conteúdo aprovadas ou publicadas com data em ${nomeMes(ym)}.</p></div></div>
      <div class="actions" style="gap:8px"><span class="chip ok">${prod.total} ${prod.total === 1 ? 'tarefa' : 'tarefas'}</span>${prod.porFormato.map(([n, q]) => `<span class="chip mute">${q} ${esc(n)}</span>`).join('')}</div></div>` : ''}
    ${atual.observacao ? `<div class="card"><div class="card-h"><div><h2>Leitura do mês</h2></div></div><p style="white-space:pre-wrap;margin:0">${esc(atual.observacao)}</p></div>` : ''}`;
}

// Aceita um objeto, uma lista ou `{insights:[...]}`. Cada item: clienteNome (ou clienteId), mes e os números.
function lerImportacao(texto, clienteIdPadrao) {
  let bruto;
  try { bruto = JSON.parse(String(texto).trim()); } catch { throw new Error('Não consegui ler o texto. Ele precisa estar em JSON, como o Claude Code entrega.'); }
  const itens = Array.isArray(bruto) ? bruto : Array.isArray(bruto?.insights) ? bruto.insights : [bruto];
  const clientes = store.todos('cliente');
  return itens.map((x, i) => {
    let c = store.obter('cliente', x.clienteId) || (x.clienteNome ? clientes.find((k) => norm(k.nome) === norm(x.clienteNome)) : null) || store.obter('cliente', clienteIdPadrao);
    if (!c) throw new Error(`Item ${i + 1}: não achei o cliente${x.clienteNome ? ` “${x.clienteNome}”` : ''}. Escolha o cliente na tela ou confira o nome.`);
    if (!/^\d{4}-\d{2}$/.test(String(x.mes || ''))) throw new Error(`Item ${i + 1}: falta o mês no formato AAAA-MM (por exemplo 2026-10).`);
    return { ...x, clienteId: c.id, clienteNome: undefined, rede: 'instagram', id: idInsight(c.id, x.mes), fonte: x.fonte || 'importado' };
  });
}

async function importar(clienteId) {
  const c = store.obter('cliente', clienteId);
  formulario({
    titulo: 'Importar dados do Instagram',
    subtitulo: `${c ? c.nome + '. ' : ''}Cole o texto em JSON que o Claude Code montou (um mês ou vários). Se o mês já existe, os números dele são substituídos.`,
    largo: true,
    salvarTexto: 'Importar',
    campos: [{ nome: 'texto', rotulo: 'Dados em JSON', tipo: 'area', obrigatorio: true, cheio: true, linhas: 12, placeholder: '{"clienteNome":"Arena Pixel","mes":"2026-09","seguidores":1200,"seguidoresGanhos":85,"alcance":15400,"visualizacoes":42000,"interacoes":1800,"visitasPerfil":950,"posts":[{"data":"2026-09-12","tipo":"Reels","legenda":"...","alcance":5200,"interacoes":410,"link":"https://..."}],"observacao":"..."}' }],
    aoSalvar: async (v) => {
      let itens;
      try { itens = lerImportacao(v.texto, clienteId); } catch (err) { toast(err.message, true); return false; }
      try { for (const it of itens) await store.salvar('insights', it); } catch (err) { toast(err.message || 'Não foi possível importar.', true); return false; }
      mes = itens[0].mes;
      toast(`${itens.length} ${itens.length === 1 ? 'mês importado' : 'meses importados'}.`);
      recarregarTela();
    },
  });
}

export default {
  titulo: () => 'Relatório',
  sub: () => 'Resultados do cliente nas redes sociais, mês a mês.',

  render({ ref }) {
    const ym = mes || mesPadrao();
    const clientes = clientesDoRelatorio();
    if (!clientes.length) return `<div class="card empty">${flor()}<h2>Nenhum cliente com Instagram</h2><p>Preencha o campo “Instagram do cliente” na ficha de um cliente. Ele passa a aparecer aqui.</p><button class="btn pri" data-act="ir" data-rota="clientes">Ir para Clientes</button></div>`;
    const c = clientes.find((x) => x.id === ref) || clientes[0];
    const chips = clientes.map((x) => `<button class="cbtn ${x.id === c.id ? 'on' : ''} no-print" data-act="ir" data-rota="relatorio" data-ref="${esc(x.id)}"><i></i>${esc(x.nome)}</button>`).join('');
    return `<div class="cbtns no-print" style="margin-bottom:16px">${chips}</div><div class="no-print">${seletorMes(ym)}</div><div id="rel-corpo" data-cliente="${esc(c.id)}">${blocoCliente(c, ym)}</div>`;
  },

  acoes: {
    'rel-mes': (el) => {
      const passo = Number(el.dataset.passo);
      mes = passo ? ymMais(mes || mesPadrao(), passo) : null;
      recarregarTela();
    },
    'rel-importar': (el) => importar(el.dataset.cliente),
    'rel-imprimir': () => {
      document.body.classList.add('imprimindo');
      window.addEventListener('afterprint', () => document.body.classList.remove('imprimindo'), { once: true });
      window.print();
    },
  },
};
