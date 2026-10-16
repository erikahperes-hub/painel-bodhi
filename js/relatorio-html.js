import { esc, mesNome, dataBR, urlSegura, iniciais } from './util.js?v=85';

// O visual do relatório do cliente (baseado no relatório do Reportei, com insights a mais).
// Este arquivo só monta o HTML a partir dos dados; é usado pelo painel e, depois, pela página que o cliente abre pelo link.

const num = (n) => (n === null || n === undefined || n === '' || Number.isNaN(Number(n)) ? '–' : Number(n).toLocaleString('pt-BR'));
const tem = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));
const pct1 = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
export const ymAnterior = (ym) => { const [a, m] = ym.split('-').map(Number); const d = new Date(a, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export const ymMais = (ym, passo) => { const [a, m] = ym.split('-').map(Number); const d = new Date(a, m - 1 + passo, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export const nomeMes = (ym) => { const n = mesNome(Number(ym.slice(5, 7)) - 1); return `${n[0].toUpperCase()}${n.slice(1)} de ${ym.slice(0, 4)}`; };
const mesCurto = (ym) => mesNome(Number(ym.slice(5, 7)) - 1).slice(0, 3);
const primeiroDia = (ym) => `${ym}-01`;
const ultimoDia = (ym) => { const [a, m] = ym.split('-').map(Number); return `${ym}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`; };
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// Variação em relação ao período anterior: ▲ verde quando subiu, ▼ vermelha quando caiu.
function variacao(atual, antes) {
  if (!tem(atual) || !tem(antes) || Number(antes) === 0) return '';
  const p = ((Number(atual) - Number(antes)) / Number(antes)) * 100;
  if (Math.abs(p) < 0.05) return '<span class="rl-var igual">= 0%</span>';
  return `<span class="rl-var ${p > 0 ? 'up' : 'down'}">${p > 0 ? '▲ +' : '▼ '}${pct1(p)}%</span>`;
}

function kpi(nome, dica, atual, antes) {
  if (!tem(atual)) return '';
  return `<div class="rl-kpi" title="${esc(dica)}"><div class="rl-kpi-n">${esc(nome)}</div>
    <div class="rl-kpi-v"><b>${num(atual)}</b>${variacao(atual, antes)}</div>
    ${tem(antes) ? `<div class="rl-kpi-a"><b>${num(antes)}</b> no período anterior</div>` : ''}</div>`;
}

const soma = (posts, campo) => (posts || []).reduce((t, p) => t + (Number(p[campo]) || 0), 0);
const temCampo = (posts, campo) => (posts || []).some((p) => tem(p[campo]));

// Linha da tabela de publicações.
function linhaPost(p) {
  const url = urlSegura(p.link);
  const leg = String(p.legenda || p.titulo || '(sem legenda)').replace(/\s+/g, ' ').trim();
  const titulo = esc(leg.length > 70 ? `${leg.slice(0, 70)}…` : leg);
  const eng = tem(p.alcance) && Number(p.alcance) > 0 && tem(p.interacoes) ? `${pct1((Number(p.interacoes) / Number(p.alcance)) * 100)}%` : '–';
  return `<tr><td class="rl-leg">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${titulo}</a>` : titulo}</td><td>${esc(p.tipo || '')}</td>
    <td>${num(p.alcance)}</td><td>${num(p.visualizacoes)}</td><td>${num(p.interacoes)}</td><td>${eng}</td><td>${num(p.curtidas)}</td><td>${num(p.comentarios)}</td><td>${num(p.compartilhamentos)}</td><td>${num(p.salvamentos)}</td><td>${p.data ? esc(dataBR(p.data)) : ''}</td></tr>`;
}

// Gráfico de barras da evolução (últimos 6 meses, terminando no mês mostrado).
function evolucao(serie, ym, campo, titulo) {
  const meses = [5, 4, 3, 2, 1, 0].map((i) => ymMais(ym, -i));
  const vals = meses.map((m) => serie[m]?.[campo]);
  if (vals.filter(tem).length < 2) return '';
  const max = Math.max(1, ...vals.map((v) => (tem(v) ? Number(v) : 0)));
  return `<section class="card rl-sec"><h3>${esc(titulo)}</h3><p class="rl-sub">Últimos 6 meses até ${esc(nomeMes(ym).toLowerCase())}.</p>
    <div class="rl-bars" role="img" aria-label="${esc(titulo)} por mês">${meses.map((m, i) => `<div class="rl-bar ${m === ym ? 'on' : ''}"><span class="rl-bar-v">${tem(vals[i]) ? num(vals[i]) : '–'}</span><i style="height:${tem(vals[i]) ? Math.max(4, Math.round((Number(vals[i]) / max) * 100)) : 2}%"></i><span class="rl-bar-m">${mesCurto(m)}</span></div>`).join('')}</div></section>`;
}

// Os números do mês em cartões, as publicações, o que funcionou e o que a Bôdhi entregou.
// ctx: { cliente, ym, atual, anterior, serie, producao, acoes? }
export function corpoRelatorio({ cliente, ym, atual, anterior, serie = {}, producao = { total: 0, porFormato: [] } }) {
  const posts = [...(atual.posts || [])].sort((a, b) => (Number(b.alcance) || 0) - (Number(a.alcance) || 0));
  const postsAnt = anterior?.posts || [];
  const nome = cliente.nome || '';
  const capa = `<section class="card rl-capa">
      <div class="rl-av">${cliente.imagem ? `<img src="${esc(cliente.imagem)}" alt="">` : esc(iniciais(nome))}</div>
      <h2>Relatório de ${esc(nome)}</h2><p class="rl-sub">Análise de desempenho no Instagram${cliente.instagram ? ` · ${esc(cliente.instagram)}` : ''}</p>
      <div class="rl-periodos"><div><small>Período de análise</small><b>${dataBR(primeiroDia(ym))} a ${dataBR(ultimoDia(ym))}</b></div>
        <div><small>Período de comparação</small><b>${dataBR(primeiroDia(ymAnterior(ym)))} a ${dataBR(ultimoDia(ymAnterior(ym)))}</b></div></div></section>`;

  const kpis = [
    kpi('Alcance', 'Contas diferentes que viram o perfil ou as publicações', atual.alcance, anterior?.alcance),
    kpi('Visualizações', 'Quantas vezes o conteúdo foi visto', atual.visualizacoes, anterior?.visualizacoes),
    kpi('Interações', 'Curtidas, comentários, salvamentos e compartilhamentos', atual.interacoes, anterior?.interacoes),
    kpi('Visitas ao perfil', 'Pessoas que abriram o perfil', atual.visitasPerfil, anterior?.visitasPerfil),
    kpi('Contas engajadas', 'Contas diferentes que interagiram com o conteúdo', atual.contasEngajadas, anterior?.contasEngajadas),
  ].join('');
  const seg = tem(atual.seguidores)
    ? `<div class="rl-kpi" title="Total de seguidores"><div class="rl-kpi-n">Seguidores</div><div class="rl-kpi-v"><b>${num(atual.seguidores)}</b>${tem(atual.seguidoresGanhos) ? `<span class="rl-var ${Number(atual.seguidoresGanhos) >= 0 ? 'up' : 'down'}">${Number(atual.seguidoresGanhos) >= 0 ? '▲ +' : '▼ '}${num(atual.seguidoresGanhos)} no mês</span>` : ''}</div>
        <div class="rl-kpi-a">${atual.seguidoresEm ? `Em ${esc(dataBR(atual.seguidoresEm))}` : 'Ao fim do mês'}</div></div>` : '';

  // Taxa de engajamento do mês: interações em relação ao alcance (o que o Reportei não mostra).
  const taxa = tem(atual.interacoes) && tem(atual.alcance) && Number(atual.alcance) > 0 ? (Number(atual.interacoes) / Number(atual.alcance)) * 100 : null;
  const taxaAnt = anterior && tem(anterior.interacoes) && tem(anterior.alcance) && Number(anterior.alcance) > 0 ? (Number(anterior.interacoes) / Number(anterior.alcance)) * 100 : null;
  const kpiTaxa = taxa === null ? '' : `<div class="rl-kpi" title="Interações divididas pelo alcance: mostra o quanto o público reage ao que viu"><div class="rl-kpi-n">Taxa de engajamento</div>
      <div class="rl-kpi-v"><b>${pct1(taxa)}%</b>${variacao(taxa, taxaAnt)}</div>${taxaAnt !== null ? `<div class="rl-kpi-a"><b>${pct1(taxaAnt)}%</b> no período anterior</div>` : ''}</div>`;

  // Publicações do mês, com o comparativo do mês anterior.
  const contadores = [
    ['Publicações no feed', 'Posts, carrosséis e reels publicados', posts.length, postsAnt.length || (anterior ? 0 : null), true],
    ['Curtidas', '', temCampo(posts, 'curtidas') ? soma(posts, 'curtidas') : null, temCampo(postsAnt, 'curtidas') ? soma(postsAnt, 'curtidas') : null],
    ['Comentários', '', temCampo(posts, 'comentarios') ? soma(posts, 'comentarios') : null, temCampo(postsAnt, 'comentarios') ? soma(postsAnt, 'comentarios') : null],
    ['Salvamentos', '', temCampo(posts, 'salvamentos') ? soma(posts, 'salvamentos') : null, temCampo(postsAnt, 'salvamentos') ? soma(postsAnt, 'salvamentos') : null],
    ['Compartilhamentos', '', temCampo(posts, 'compartilhamentos') ? soma(posts, 'compartilhamentos') : null, temCampo(postsAnt, 'compartilhamentos') ? soma(postsAnt, 'compartilhamentos') : null],
  ].map(([n, d, a, b, sempre]) => (sempre || tem(a) ? kpi(n, d, a, b) : '')).join('');

  const tabela = posts.length ? `<section class="card rl-sec"><h3>Dados orgânicos das publicações</h3><p class="rl-sub">${posts.length} ${posts.length === 1 ? 'publicação' : 'publicações'} em ${esc(nomeMes(ym).toLowerCase())}, da que mais alcançou para a que menos.</p>
      <div class="rl-tabela"><table><thead><tr><th>Publicação</th><th>Tipo</th><th>Alcance</th><th>Visualizações</th><th>Interações</th><th title="Interações ÷ alcance">Engaj.</th><th>Curtidas</th><th>Coment.</th><th>Compart.</th><th>Salvos</th><th>Data</th></tr></thead>
      <tbody>${posts.map(linhaPost).join('')}</tbody></table></div></section>` : `<section class="card rl-sec"><h3>Publicações</h3><p class="rl-sub">Nenhuma publicação no feed em ${esc(nomeMes(ym).toLowerCase())}. Os números acima vêm do perfil e dos conteúdos antigos que continuaram sendo vistos.</p></section>`;

  // Qual formato funcionou melhor e em qual dia da semana as publicações alcançaram mais.
  const porTipo = posts.length ? Object.entries(posts.reduce((m, p) => { (m[p.tipo || 'Outro'] ||= []).push(Number(p.alcance) || 0); return m; }, {}))
    .map(([t, v]) => [t, v.length, Math.round(v.reduce((a, b) => a + b, 0) / v.length)]).sort((a, b) => b[2] - a[2]) : [];
  const porDia = posts.length ? Object.entries(posts.reduce((m, p) => { if (!p.data) return m; const d = new Date(`${p.data}T12:00:00`).getDay(); (m[d] ||= []).push(Number(p.alcance) || 0); return m; }, {}))
    .map(([d, v]) => [DIAS[d], v.length, Math.round(v.reduce((a, b) => a + b, 0) / v.length)]).sort((a, b) => b[2] - a[2]) : [];
  const linhas = (lista, rotulo) => lista.map(([n, q, m], i) => `<div class="rl-lin ${i === 0 && lista.length > 1 ? 'top' : ''}"><b>${esc(n)}</b><span>${q} ${q === 1 ? 'publicação' : 'publicações'} · alcance médio ${num(m)}</span></div>`).join('') || `<p class="rl-sub">${rotulo}</p>`;
  const funcionou = posts.length ? `<section class="card rl-sec"><h3>O que funcionou melhor</h3><div class="rl-duas">
      <div><h4>Por formato</h4>${linhas(porTipo, '')}</div>
      <div><h4>Por dia da semana</h4>${linhas(porDia, '')}</div></div></section>` : '';

  const entregas = producao.total ? `<section class="card rl-sec"><h3>O que a Bôdhi entregou no mês</h3><p class="rl-sub">Tarefas de Conteúdo aprovadas ou publicadas em ${esc(nomeMes(ym).toLowerCase())}.</p>
      <div class="rl-chips"><span class="chip ok">${producao.total} ${producao.total === 1 ? 'tarefa' : 'tarefas'}</span>${producao.porFormato.map(([n, q]) => `<span class="chip mute">${q} ${esc(n)}</span>`).join('')}</div></section>` : '';
  const leitura = atual.observacao ? `<section class="card rl-sec"><h3>Leitura do mês</h3><p class="rl-texto">${esc(atual.observacao)}</p></section>` : '';

  return `${capa}
    <section class="rl-grid">${kpis}${seg}${kpiTaxa}</section>
    ${evolucao(serie, ym, 'alcance', 'Evolução do alcance')}
    ${evolucao(serie, ym, 'interacoes', 'Evolução das interações')}
    <section class="rl-grid">${contadores}</section>
    ${tabela}${funcionou}${entregas}${leitura}`;
}
