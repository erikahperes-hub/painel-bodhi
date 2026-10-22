import { esc, mesNome, dataBR, urlSegura, iniciais } from './util.js?v=119';

// O visual do relatório do cliente (baseado no relatório do Reportei, com insights a mais).
// Só monta o HTML a partir dos dados; é usado pelo painel (js/views/relatorio.js) e pela página que o cliente abre pelo link (relatorio.html).
//
// Como ler os números (a lógica por trás da ordem das seções):
//  1. Resumo do mês: o que aconteceu, em frases, antes de qualquer número.
//  2. Visibilidade (alcance, visualizações), interesse (visitas, seguidores) e qualidade (engajamento, salvamentos, compartilhamentos).
//  3. Comparação sempre com o mês anterior e com a média dos 3 meses antes, para não tirar conclusão de um mês isolado.
//  4. Metas do mês, quando existirem.

const num = (n) => (n === null || n === undefined || n === '' || Number.isNaN(Number(n)) ? '–' : Number(n).toLocaleString('pt-BR'));
const tem = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));
const pct1 = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const dec1 = (n) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const ymAnterior = (ym) => { const [a, m] = ym.split('-').map(Number); const d = new Date(a, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export const ymMais = (ym, passo) => { const [a, m] = ym.split('-').map(Number); const d = new Date(a, m - 1 + passo, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export const nomeMes = (ym) => { const n = mesNome(Number(ym.slice(5, 7)) - 1); return `${n[0].toUpperCase()}${n.slice(1)} de ${ym.slice(0, 4)}`; };
const nomeMesMin = (ym) => nomeMes(ym).toLowerCase();
const mesCurto = (ym) => mesNome(Number(ym.slice(5, 7)) - 1).slice(0, 3);
const primeiroDia = (ym) => `${ym}-01`;
const ultimoDia = (ym) => { const [a, m] = ym.split('-').map(Number); return `${ym}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`; };
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const soma = (lista, campo) => (lista || []).reduce((t, p) => t + (Number(p[campo]) || 0), 0);
const temCampo = (lista, campo) => (lista || []).some((p) => tem(p[campo]));
const razao = (a, b) => (tem(a) && tem(b) && Number(b) > 0 ? Number(a) / Number(b) : null);
const porcento = (p) => (p === null ? null : p * 100);

// Média do mesmo número nos 3 meses antes do mostrado (só conta meses que têm o dado; precisa de pelo menos 2).
function media3(serie, ym, campo) {
  const v = [1, 2, 3].map((i) => serie[ymMais(ym, -i)]?.[campo]).filter(tem).map(Number);
  return v.length >= 2 ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// Variação em relação ao período anterior: ▲ verde quando subiu, ▼ vermelha quando caiu.
function variacao(atual, antes) {
  if (!tem(atual) || !tem(antes) || Number(antes) === 0) return '';
  const p = ((Number(atual) - Number(antes)) / Number(antes)) * 100;
  if (Math.abs(p) < 0.05) return '<span class="rl-var igual">= 0%</span>';
  return `<span class="rl-var ${p > 0 ? 'up' : 'down'}">${p > 0 ? '▲ +' : '▼ '}${pct1(p)}%</span>`;
}
const frasePct = (atual, antes) => {
  if (!tem(atual) || !tem(antes) || Number(antes) === 0) return '';
  const p = ((Number(atual) - Number(antes)) / Number(antes)) * 100;
  return Math.abs(p) < 2 ? 'ficou estável' : p > 0 ? `subiu ${pct1(p)}%` : `caiu ${pct1(-p)}%`;
};

// Grade dos cartões: as colunas dependem de quantos cartões há, para a última fileira nunca ficar com buraco.
function grade(html) {
  const n = (html.match(/class="rl-kpi"/g) || []).length;
  if (!n) return '';
  const cols = n === 4 || n === 2 ? 2 : n === 1 ? 1 : 3;
  return `<div class="rl-grid cols${cols} resto${n % cols}">${html}</div>`;
}

function kpi(nome, dica, atual, antes, extra = '', formato = num) {
  if (!tem(atual)) return '';
  return `<div class="rl-kpi" data-dica="${esc(dica)}" tabindex="0"><div class="rl-kpi-n">${esc(nome)}</div>
    <div class="rl-kpi-v"><b>${formato(atual)}</b>${variacao(atual, antes)}</div>
    ${tem(antes) ? `<div class="rl-kpi-a"><b>${formato(antes)}</b> no período anterior</div>` : ''}${extra}</div>`;
}
const mediaNota = (m, formato = num) => (m === null ? '' : `<div class="rl-kpi-a">média dos 3 meses antes: <b>${formato(Math.round(m * 10) / 10)}</b></div>`);

/* ---------- stories ---------- */
export function resumoStories(lista) {
  const l = lista || [];
  const g = (s, k) => Number(s.dados?.[k]) || 0;
  const total = (k) => l.reduce((t, s) => t + g(s, k), 0);
  // A taxa de saída só conta stories que têm os dois números (visualizações e saídas).
  const comNav = l.filter((s) => tem(s.dados?.sair) && tem(s.dados?.visualizacoes));
  const viewsNav = comNav.reduce((t, s) => t + g(s, 'visualizacoes'), 0);
  const sairNav = comNav.reduce((t, s) => t + g(s, 'sair'), 0);
  return { n: l.length, views: total('visualizacoes'), alcance: total('alcance'), interacoes: total('interacoes'), respostas: total('respostas'), saida: viewsNav > 0 ? (sairNav / viewsNav) * 100 : null };
}
const dataHoraStory = (s) => { const d = s.dados || {}; return d.data ? `${dataBR(d.data).slice(0, 5)}${tem(d.hora) ? ` ${String(d.hora).padStart(2, '0')}h` : ''}` : ''; };
function linhaStory(s) {
  const d = s.dados || {};
  const saida = razao(d.sair, d.visualizacoes);
  const url = urlSegura(d.link);
  return `<tr><td>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(dataHoraStory(s))}</a>` : esc(dataHoraStory(s))}</td><td>${esc(d.tipo || '')}</td>
    <td>${num(d.alcance)}</td><td>${num(d.visualizacoes)}</td><td>${num(d.interacoes)}</td><td>${num(d.respostas)}</td><td>${num(d.compartilhamentos)}</td>
    <td>${num(d.avancar)}</td><td>${num(d.proximo)}</td><td>${num(d.voltar)}</td><td>${num(d.sair)}</td><td>${saida === null ? '–' : `${pct1(saida * 100)}%`}</td></tr>`;
}
function secaoStories(stories, storiesAnt, painel) {
  if (!stories.length) {
    return painel ? `<section class="card rl-sec rl-nota"><h3>Stories</h3><p class="rl-sub">Nenhum story guardado neste mês. O Instagram só entrega cada story por 24 horas; a leitura automática do painel copia os stories de hora em hora, então eles aparecem aqui a partir da primeira leitura com o Instagram conectado.</p></section>` : '';
  }
  const r = resumoStories(stories);
  const ant = storiesAnt.length ? resumoStories(storiesAnt) : null;
  const cards = [
    kpi('Stories publicados', 'Quantidade de stories no mês', r.n, ant?.n),
    kpi('Visualizações dos stories', 'Soma das visualizações de todos os stories', r.views, ant?.views),
    kpi('Alcance somado dos stories', 'Soma do alcance de cada story (a mesma pessoa pode ser contada em mais de um)', r.alcance, ant?.alcance),
    kpi('Interações nos stories', 'Respostas, compartilhamentos e outras ações', r.interacoes, ant?.interacoes),
    r.saida === null ? '' : kpi('Taxa de saída', 'De cada 100 visualizações, quantas terminaram com a pessoa saindo do story. Quanto menor, melhor.', r.saida, ant?.saida, '', (x) => `${pct1(x)}%`),
  ].join('');
  const ordem = [...stories].sort((a, b) => String(a.dados?.data || '').localeCompare(String(b.dados?.data || '')) || (a.dados?.hora ?? 0) - (b.dados?.hora ?? 0));
  return `<section class="card rl-sec"><h3>Stories</h3><p class="rl-sub">${r.n} ${r.n === 1 ? 'story' : 'stories'} no mês. Números de cada um, na ordem em que foram publicados.</p></section>
    ${grade(cards)}
    <section class="card rl-sec"><div class="rl-tabela"><table><thead><tr><th>Quando</th><th>Tipo</th><th>Alcance</th><th>Visualiz.</th><th>Interações</th><th>Respostas</th><th>Compart.</th><th data-dica="Toques para avançar">Avançar</th><th data-dica="Deslizes para o próximo story">Próximo</th><th data-dica="Toques para voltar">Voltar</th><th data-dica="Saídas do story">Sair</th><th data-dica="Saídas ÷ visualizações">Saída</th></tr></thead>
    <tbody>${ordem.map(linhaStory).join('')}</tbody></table></div></section>`;
}

/* ---------- público ---------- */
const ROTULO_GENERO = { F: 'Feminino', M: 'Masculino', U: 'Não informado' };
const COR_GENERO = { F: 'var(--verde)', M: 'var(--petroleo)', U: 'var(--ink-3)' };
const nomeCidade = (c) => String(c).replace(/\s*\(state\)/i, '').replace(/\s*\(estado\)/i, '');
const NOME_PAIS = { BR: 'Brasil', PT: 'Portugal', US: 'Estados Unidos', AR: 'Argentina', CL: 'Chile', ES: 'Espanha', GB: 'Reino Unido', FR: 'França', DE: 'Alemanha', IT: 'Itália', MX: 'México', CA: 'Canadá', AU: 'Austrália', JP: 'Japão', PY: 'Paraguai', UY: 'Uruguai', CO: 'Colômbia' };
function secaoPublico(pub, em, seguidores) {
  if (!pub || !Object.keys(pub).some((k) => k !== 'horasOnline' && (pub[k] || []).length)) return '';
  const tot = (l) => (l || []).reduce((t, x) => t + (Number(x.v) || 0), 0);
  const barras = (lista, rotulo, max = 7) => {
    const t = tot(lista);
    return (lista || []).slice(0, max).map((x) => `<div class="rl-h"><span>${esc(rotulo(x.k))}</span><div class="rl-h-b"><i style="width:${t ? Math.max(2, Math.round((x.v / t) * 100)) : 0}%"></i></div><b>${t ? pct1((x.v / t) * 100) : 0}%</b></div>`).join('');
  };
  const genero = (pub.genero || []).length ? (() => {
    const t = tot(pub.genero);
    const ord = ['F', 'M', 'U'].map((k) => (pub.genero.find((x) => x.k === k) || { k, v: 0 })).filter((x) => x.v > 0);
    return `<div class="rl-stack">${ord.map((x) => `<i style="width:${(x.v / t) * 100}%;background:${COR_GENERO[x.k]}" data-dica="${ROTULO_GENERO[x.k]}: ${pct1((x.v / t) * 100)}%"></i>`).join('')}</div>
      <div class="rl-leg-g">${ord.map((x) => `<span><i style="background:${COR_GENERO[x.k]}"></i>${ROTULO_GENERO[x.k]} <b>${pct1((x.v / t) * 100)}%</b></span>`).join('')}</div>`;
  })() : '';
  const ordemIdade = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
  const idades = [...(pub.idades || [])].sort((a, b) => ordemIdade.indexOf(a.k) - ordemIdade.indexOf(b.k));
  const horas = pub.horasOnline ? [...pub.horasOnline.map((v, h) => [h, v])].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => `${String(h).padStart(2, '0')}h`).join(', ') : '';
  return `<section class="card rl-sec"><h3>Quem é o público</h3><p class="rl-sub">Retrato dos seguidores${em ? ` em ${esc(dataBR(em))}` : ''}${tem(seguidores) ? `, de um total de ${num(seguidores)}` : ''}. O Instagram não guarda o histórico deste dado.</p>
    <div class="rl-duas">
      <div>${genero ? `<h4>Gênero</h4>${genero}` : ''}${idades.length ? `<h4 style="margin-top:16px">Faixa etária</h4>${barras(idades, (k) => k, 7)}` : ''}</div>
      <div>${(pub.cidades || []).length ? `<h4>Principais cidades</h4>${barras(pub.cidades, nomeCidade, 7)}` : ''}${(pub.paises || []).length > 1 ? `<h4 style="margin-top:16px">Países</h4>${barras(pub.paises, (k) => NOME_PAIS[k] || k, 3)}` : ''}</div>
    </div>${horas ? `<p class="rl-sub" style="margin-top:12px">Horários de maior atividade dos seguidores: <b>${horas}</b>.</p>` : ''}</section>`;
}

/* ---------- melhores dias e horários (com as publicações dos últimos 6 meses) ---------- */
function melhoresMomentos(serie, ym) {
  const posts = [];
  for (let i = 0; i < 6; i++) for (const p of serie[ymMais(ym, -i)]?.posts || []) if (p.data && tem(p.alcance)) posts.push(p);
  if (posts.length < 6) return { posts: posts.length, dias: [], periodos: [] };
  const grupo = (chave) => Object.entries(posts.reduce((m, p) => { const k = chave(p); if (k !== null) (m[k] ||= []).push(Number(p.alcance)); return m; }, {}))
    .map(([k, v]) => ({ k, n: v.length, media: Math.round(v.reduce((a, b) => a + b, 0) / v.length) })).sort((a, b) => b.media - a.media);
  const dias = grupo((p) => DIAS[new Date(`${p.data}T12:00:00`).getDay()]);
  const periodo = (h) => (h < 6 ? 'madrugada (0h às 5h)' : h < 12 ? 'manhã (6h às 11h)' : h < 18 ? 'tarde (12h às 17h)' : 'noite (18h às 23h)');
  const periodos = posts.some((p) => tem(p.hora)) ? grupo((p) => (tem(p.hora) ? periodo(Number(p.hora)) : null)) : [];
  return { posts: posts.length, dias, periodos };
}

/* ---------- resumo do mês em frases (regras simples, sem inventar nada) ---------- */
export function frasesResumo({ ym, atual, anterior, serie, stories = [] }) {
  const f = [];
  const posts = atual.posts || [];
  const mAnt = mesNome(Number(ymAnterior(ym).slice(5, 7)) - 1);
  if (tem(atual.alcance)) {
    const v = frasePct(atual.alcance, anterior?.alcance);
    let t = `Em ${nomeMesMin(ym)}, o perfil alcançou ${num(atual.alcance)} contas${v ? `: o alcance ${v} em relação a ${mAnt}` : ''}.`;
    if (anterior && tem(anterior.alcance) && Number(atual.alcance) < Number(anterior.alcance) * 0.9 && posts.length < (anterior.posts || []).length) t += ` A queda acompanha a menor quantidade de publicações (${posts.length}, contra ${(anterior.posts || []).length} no mês anterior).`;
    if (anterior && tem(anterior.alcance) && Number(atual.alcance) > Number(anterior.alcance) * 1.1 && posts.length > (anterior.posts || []).length) t += ` Foram mais publicações (${posts.length}, contra ${(anterior.posts || []).length} no mês anterior).`;
    f.push(t);
  }
  const taxa = porcento(razao(atual.interacoes, atual.alcance));
  if (taxa !== null) {
    const tAnt = [1, 2, 3].map((i) => serie[ymMais(ym, -i)]).map((x) => porcento(razao(x?.interacoes, x?.alcance))).filter((x) => x !== null);
    const mediaT = tAnt.length >= 2 ? tAnt.reduce((a, b) => a + b, 0) / tAnt.length : null;
    f.push(`A taxa de engajamento foi de ${pct1(taxa)}% (interações em relação ao alcance)${mediaT !== null ? `, ${taxa > mediaT * 1.05 ? 'acima da' : taxa < mediaT * 0.95 ? 'abaixo da' : 'em linha com a'} média dos 3 meses anteriores (${pct1(mediaT)}%)` : ''}.`);
  }
  const ord = [...posts].filter((p) => tem(p.alcance)).sort((a, b) => b.alcance - a.alcance);
  if (ord.length) {
    const top = ord[0];
    const outros = ord.slice(1);
    const mediaOutros = outros.length ? outros.reduce((t, p) => t + Number(p.alcance), 0) / outros.length : null;
    const leg = String(top.legenda || '').replace(/\s+/g, ' ').trim();
    f.push(`Destaque do mês: ${leg ? `“${leg.length > 70 ? `${leg.slice(0, 70)}…` : leg}” ` : 'a publicação '}(${top.tipo || 'publicação'}, ${dataBR(top.data).slice(0, 5)}), com ${num(top.alcance)} de alcance${mediaOutros && top.alcance > mediaOutros * 1.3 ? `, ${(top.alcance / mediaOutros).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} vezes a média das outras` : ''}.`);
  }
  if (tem(atual.seguidoresGanhos)) f.push(`${Number(atual.seguidoresGanhos) >= 0 ? 'Entraram' : 'Saíram'} ${num(Math.abs(atual.seguidoresGanhos))} seguidores no mês${tem(atual.seguidores) ? ` (total hoje: ${num(atual.seguidores)})` : ''}.`);
  if (stories.length) {
    const r = resumoStories(stories);
    f.push(`Foram ${r.n} ${r.n === 1 ? 'story' : 'stories'}, com ${num(r.views)} visualizações no total${r.saida !== null ? ` e taxa de saída de ${pct1(r.saida)}%` : ''}.`);
  }
  const tipos = Object.entries(posts.reduce((m, p) => { if (tem(p.alcance)) (m[p.tipo || 'Outro'] ||= []).push(Number(p.alcance)); return m; }, {}))
    .map(([t, v]) => [t, v.length, v.reduce((a, b) => a + b, 0) / v.length]).sort((a, b) => b[2] - a[2]);
  if (tipos.length > 1) f.push(`${tipos[0][0]} teve o maior alcance médio (${num(Math.round(tipos[0][2]))}), contra ${num(Math.round(tipos[tipos.length - 1][2]))} de ${tipos[tipos.length - 1][0]}.`);
  return f;
}

// Linha da tabela de publicações.
function linhaPost(p) {
  const url = urlSegura(p.link);
  const leg = String(p.legenda || p.titulo || '(sem legenda)').replace(/\s+/g, ' ').trim();
  const titulo = esc(leg.length > 70 ? `${leg.slice(0, 70)}…` : leg);
  const eng = razao(p.interacoes, p.alcance);
  return `<tr><td class="rl-leg">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${titulo}</a>` : titulo}</td><td>${esc(p.tipo || '')}</td>
    <td>${num(p.alcance)}</td><td>${num(p.visualizacoes)}</td><td>${num(p.interacoes)}</td><td>${eng === null ? '–' : `${pct1(eng * 100)}%`}</td><td>${num(p.curtidas)}</td><td>${num(p.comentarios)}</td><td>${num(p.compartilhamentos)}</td><td>${num(p.salvamentos)}</td><td>${p.data ? esc(dataBR(p.data)) : ''}</td></tr>`;
}

// Gráfico de barras da evolução (últimos 6 meses, terminando no mês mostrado).
function evolucao(serie, ym, campo, titulo) {
  const meses = [5, 4, 3, 2, 1, 0].map((i) => ymMais(ym, -i));
  const vals = meses.map((m) => serie[m]?.[campo]);
  if (vals.filter(tem).length < 2) return '';
  const max = Math.max(1, ...vals.map((v) => (tem(v) ? Number(v) : 0)));
  return `<section class="card rl-sec"><h3>${esc(titulo)}</h3><p class="rl-sub">Últimos 6 meses até ${esc(nomeMesMin(ym))}.</p>
    <div class="rl-bars" role="img" aria-label="${esc(titulo)} por mês">${meses.map((m, i) => `<div class="rl-bar ${m === ym ? 'on' : ''}"><span class="rl-bar-v">${tem(vals[i]) ? num(vals[i]) : '–'}</span><i style="height:${tem(vals[i]) ? Math.max(4, Math.round((Number(vals[i]) / max) * 100)) : 2}%"></i><span class="rl-bar-m">${mesCurto(m)}</span></div>`).join('')}</div></section>`;
}

// Metas do mês (definidas no painel, por cliente).
function secaoMetas(metas, atual, posts, stories) {
  const m = metas || {};
  const itens = [
    ['Alcance', m.alcance, atual.alcance],
    ['Seguidores novos', m.seguidoresNovos, atual.seguidoresGanhos],
    ['Interações', m.interacoes, atual.interacoes],
    ['Publicações no feed', m.publicacoes, posts.length],
    ['Stories', m.stories, stories.length || null],
  ].filter(([, meta]) => tem(meta) && Number(meta) > 0);
  if (!itens.length) return '';
  return `<section class="card rl-sec"><h3>Metas do mês</h3><p class="rl-sub">Quanto já foi atingido do que combinamos para o mês.</p>
    ${itens.map(([n, meta, real]) => { const p = tem(real) ? (Number(real) / Number(meta)) * 100 : 0; return `<div class="rl-meta"><div class="rl-meta-t"><b>${esc(n)}</b><span>${num(real)} de ${num(meta)} · <b>${pct1(p)}%</b></span></div><div class="rl-meta-b"><i class="${p >= 100 ? 'ok' : ''}" style="width:${Math.min(100, Math.max(2, p))}%"></i></div></div>`; }).join('')}</section>`;
}

// ctx: { cliente, ym, atual, anterior, serie, producao, stories, storiesAnt, painel, funil }
export function corpoRelatorio({ cliente, ym, atual, anterior, serie = {}, producao = { total: 0, porFormato: [] }, stories = [], storiesAnt = [], painel = false, funil = null }) {
  const posts = [...(atual.posts || [])].sort((a, b) => (Number(b.alcance) || 0) - (Number(a.alcance) || 0));
  const postsAnt = anterior?.posts || [];
  const nome = cliente.nome || '';
  const mesTxt = mesNome(Number(ym.slice(5, 7)) - 1);
  const mesAntTxt = mesNome(Number(ymAnterior(ym).slice(5, 7)) - 1);
  const capa = `<section class="card rl-capa">
      <span class="rl-flor-w" aria-hidden="true"><svg class="rl-flor" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="38" r="26"/><circle cx="38" cy="72" r="26"/><circle cx="82" cy="72" r="26"/></svg></span>
      <div class="rl-capa-l">
        <div class="rl-capa-top"><div class="rl-av">${cliente.imagem ? `<img src="${esc(cliente.imagem)}" alt="">` : esc(iniciais(nome))}</div>
          <span class="rl-sub">Instagram${cliente.instagram ? ` · ${esc(cliente.instagram)}` : ''}</span></div>
        <p class="rl-ey">Relatório de desempenho</p>
        <h2>${esc(nome)}</h2><i class="rl-traco"></i>
        <div class="rl-periodos"><div><small>Período de análise</small><b>${dataBR(primeiroDia(ym))} a ${dataBR(ultimoDia(ym))}</b></div>
          <div><small>Período de comparação</small><b>${dataBR(primeiroDia(ymAnterior(ym)))} a ${dataBR(ultimoDia(ymAnterior(ym)))}</b></div></div>
      </div>
      <div class="rl-mes"><small>${esc(mesTxt)}</small><b>${esc(ym.slice(0, 4))}</b><span>vs. ${esc(mesAntTxt)}</span></div></section>`;

  const frases = frasesResumo({ ym, atual, anterior, serie, stories });
  const resumo = frases.length ? `<section class="card rl-sec rl-resumo"><h3>Resumo do mês</h3><ul>${frases.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : '';

  const principais = [
    kpi('Alcance', 'Contas diferentes que viram o perfil ou as publicações', atual.alcance, anterior?.alcance, mediaNota(media3(serie, ym, 'alcance'))),
    kpi('Visualizações', 'Quantas vezes o conteúdo foi visto', atual.visualizacoes, anterior?.visualizacoes, mediaNota(media3(serie, ym, 'visualizacoes'))),
    kpi('Interações', 'Curtidas, comentários, salvamentos e compartilhamentos', atual.interacoes, anterior?.interacoes, mediaNota(media3(serie, ym, 'interacoes'))),
    kpi('Visitas ao perfil', 'Pessoas que abriram o perfil', atual.visitasPerfil, anterior?.visitasPerfil, mediaNota(media3(serie, ym, 'visitasPerfil'))),
    kpi('Contas engajadas', 'Contas diferentes que interagiram com o conteúdo', atual.contasEngajadas, anterior?.contasEngajadas),
  ].join('');
  const seg = tem(atual.seguidores)
    ? `<div class="rl-kpi" data-dica="Total de seguidores" tabindex="0"><div class="rl-kpi-n">Seguidores</div><div class="rl-kpi-v"><b>${num(atual.seguidores)}</b>${tem(atual.seguidoresGanhos) ? `<span class="rl-var ${Number(atual.seguidoresGanhos) >= 0 ? 'up' : 'down'}">${Number(atual.seguidoresGanhos) >= 0 ? '▲ +' : '▼ '}${num(atual.seguidoresGanhos)} no mês</span>` : ''}</div>
        <div class="rl-kpi-a">${atual.seguidoresEm ? `Em ${esc(dataBR(atual.seguidoresEm))}` : 'Ao fim do mês'}</div></div>` : '';

  // Indicadores de qualidade: mostram se o resultado foi bom em proporção, não só em volume.
  const taxa = porcento(razao(atual.interacoes, atual.alcance));
  const taxaAnt = anterior ? porcento(razao(anterior.interacoes, anterior.alcance)) : null;
  const freq = razao(atual.visualizacoes, atual.alcance);
  const freqAnt = anterior ? razao(anterior.visualizacoes, anterior.alcance) : null;
  const interesse = porcento(razao(atual.visitasPerfil, atual.alcance));
  const interesseAnt = anterior ? porcento(razao(anterior.visitasPerfil, anterior.alcance)) : null;
  const salvComp = temCampo(posts, 'salvamentos') || temCampo(posts, 'compartilhamentos') ? soma(posts, 'salvamentos') + soma(posts, 'compartilhamentos') : null;
  const salvCompAnt = temCampo(postsAnt, 'salvamentos') || temCampo(postsAnt, 'compartilhamentos') ? soma(postsAnt, 'salvamentos') + soma(postsAnt, 'compartilhamentos') : null;
  const indicadores = [
    taxa === null ? '' : kpi('Taxa de engajamento', 'Interações divididas pelo alcance: mostra o quanto o público reage ao que viu', taxa, taxaAnt, '', (x) => `${pct1(x)}%`),
    freq === null ? '' : kpi('Visualizações por pessoa', 'Visualizações divididas pelo alcance. Acima de 1 indica que as pessoas viram o conteúdo mais de uma vez (comum em reels).', freq, freqAnt, '', dec1),
    interesse === null ? '' : kpi('Interesse pelo perfil', 'De cada 100 pessoas alcançadas, quantas abriram o perfil', interesse, interesseAnt, '', (x) => `${pct1(x)}%`),
    salvComp === null || !posts.length ? '' : kpi('Salvos e compartilhados', 'Salvamentos e compartilhamentos das publicações: os sinais mais fortes de que o conteúdo foi útil', salvComp, salvCompAnt),
  ].join('');

  const contadores = [
    ['Publicações no feed', 'Posts, carrosséis e reels publicados', posts.length, postsAnt.length || (anterior ? 0 : null), true],
    ['Curtidas', '', temCampo(posts, 'curtidas') ? soma(posts, 'curtidas') : null, temCampo(postsAnt, 'curtidas') ? soma(postsAnt, 'curtidas') : null],
    ['Comentários', '', temCampo(posts, 'comentarios') ? soma(posts, 'comentarios') : null, temCampo(postsAnt, 'comentarios') ? soma(postsAnt, 'comentarios') : null],
    ['Salvamentos', '', temCampo(posts, 'salvamentos') ? soma(posts, 'salvamentos') : null, temCampo(postsAnt, 'salvamentos') ? soma(postsAnt, 'salvamentos') : null],
    ['Compartilhamentos', '', temCampo(posts, 'compartilhamentos') ? soma(posts, 'compartilhamentos') : null, temCampo(postsAnt, 'compartilhamentos') ? soma(postsAnt, 'compartilhamentos') : null],
  ].map(([n, d, a, b, sempre]) => (sempre || tem(a) ? kpi(n, d, a, b) : '')).join('');

  const tabela = posts.length ? `<section class="card rl-sec"><h3>Dados orgânicos das publicações</h3><p class="rl-sub">${posts.length} ${posts.length === 1 ? 'publicação' : 'publicações'} em ${esc(nomeMesMin(ym))}, da que mais alcançou para a que menos.</p>
      <div class="rl-tabela"><table><thead><tr><th>Publicação</th><th>Tipo</th><th>Alcance</th><th>Visualizações</th><th>Interações</th><th data-dica="Interações ÷ alcance">Engaj.</th><th>Curtidas</th><th>Coment.</th><th>Compart.</th><th>Salvos</th><th>Data</th></tr></thead>
      <tbody>${posts.map(linhaPost).join('')}</tbody></table></div></section>` : `<section class="card rl-sec"><h3>Publicações</h3><p class="rl-sub">Nenhuma publicação no feed em ${esc(nomeMesMin(ym))}. Os números do perfil acima incluem conteúdos antigos que continuaram sendo vistos.</p></section>`;

  const porTipo = posts.length ? Object.entries(posts.reduce((m, p) => { (m[p.tipo || 'Outro'] ||= []).push(Number(p.alcance) || 0); return m; }, {}))
    .map(([t, v]) => ({ k: t, n: v.length, media: Math.round(v.reduce((a, b) => a + b, 0) / v.length) })).sort((a, b) => b.media - a.media) : [];
  const mm = melhoresMomentos(serie, ym);
  const linhas = (lista) => lista.map((x, i) => `<div class="rl-lin ${i === 0 && lista.length > 1 ? 'top' : ''}"><b>${esc(x.k)}</b><span>${x.n} ${x.n === 1 ? 'publicação' : 'publicações'} · alcance médio ${num(x.media)}</span></div>`).join('');
  const funcionou = posts.length || mm.dias.length ? `<section class="card rl-sec"><h3>O que funcionou melhor</h3><div class="rl-duas">
      <div><h4>Por formato (neste mês)</h4>${porTipo.length ? linhas(porTipo) : '<p class="rl-sub">Sem publicações com alcance neste mês.</p>'}</div>
      <div><h4>Por dia da semana (últimos 6 meses)</h4>${mm.dias.length ? linhas(mm.dias.slice(0, 4)) : `<p class="rl-sub">Precisa de pelo menos 6 publicações nos últimos 6 meses para indicar (hoje: ${mm.posts}).</p>`}
        ${mm.periodos.length ? `<h4 style="margin-top:14px">Por período do dia</h4>${linhas(mm.periodos)}` : ''}</div></div></section>` : '';

  // O perfil do público é um retrato do dia da leitura: usa o do próprio mês e, se não houver, o mais recente que existir.
  const pubDados = atual.publico ? { pub: atual.publico, em: atual.publicoEm } : (() => {
    const r = Object.values(serie).filter((x) => x?.publico).sort((x, y) => String(y.publicoEm || '').localeCompare(String(x.publicoEm || '')))[0];
    return r ? { pub: r.publico, em: r.publicoEm } : { pub: null, em: '' };
  })();

  const entregas = producao.total ? `<section class="card rl-sec"><h3>O que a Bôdhi entregou no mês</h3><p class="rl-sub">Tarefas de Conteúdo aprovadas ou publicadas em ${esc(nomeMesMin(ym))}.</p>
      <div class="rl-chips"><span class="chip ok">${producao.total} ${producao.total === 1 ? 'tarefa' : 'tarefas'}</span>${producao.porFormato.map(([n, q]) => `<span class="chip mute">${q} ${esc(n)}</span>`).join('')}</div></section>` : '';
  const leitura = atual.observacao ? `<section class="card rl-sec"><h3>Leitura do mês</h3><p class="rl-texto">${esc(atual.observacao)}</p></section>` : '';

  const interno = funil && funil.length ? `<section class="card rl-sec rl-interno no-print"><h3>Por etapa do funil <span class="chip mute">só para a equipe</span></h3><p class="rl-sub">Cruza as tarefas do Conteúdo com o alcance de cada publicação (últimos 6 meses). Não aparece no link do cliente.</p>
      <div class="rl-duas"><div>${linhas(funil.map((x) => ({ k: x.nome, n: x.n, media: x.media })))}</div></div></section>` : '';

  // Layout em capítulos, com índice ao lado: cada assunto tem o seu capítulo e só aparece quando há conteúdo.
  const capitulos = [
    { id: 'resumo', nome: 'Resumo', titulo: 'Resumo e leitura do mês', html: `${resumo}${leitura}` },
    { id: 'numeros', nome: 'Números', titulo: 'Os números do mês', html: `${grade(principais + seg)}${indicadores ? `<section class="rl-bloco"><h3 class="rl-t">Qualidade do resultado</h3>${grade(indicadores)}</section>` : ''}${secaoMetas(cliente.metas, atual, posts, stories)}` },
    { id: 'evolucao', nome: 'Evolução', titulo: 'Evolução nos últimos meses', html: `${evolucao(serie, ym, 'alcance', 'Evolução do alcance')}${evolucao(serie, ym, 'interacoes', 'Evolução das interações')}` },
    { id: 'publicacoes', nome: 'Publicações', titulo: 'Publicações do mês', html: `${grade(contadores)}${tabela}${funcionou}` },
    { id: 'stories', nome: 'Stories', titulo: 'Stories', html: secaoStories(stories, storiesAnt, painel) },
    { id: 'publico', nome: 'Público', titulo: 'Quem acompanha o perfil', html: secaoPublico(pubDados.pub, pubDados.em, atual.seguidores) },
    { id: 'entregas', nome: 'Entregas', titulo: 'O que a Bôdhi entregou', html: entregas },
    { id: 'equipe', nome: 'Equipe', titulo: 'Só para a equipe', html: interno },
  ].filter((c) => c.html.trim());
  const indice = `<nav class="rl-ind no-print" aria-label="Capítulos do relatório">${capitulos.map((c, i) => `<button type="button" data-rl-ir="rl-cap-${c.id}"><span>${i + 1}</span>${esc(c.nome)}</button>`).join('')}</nav>`;
  const corpo = capitulos.map((c, i) => `<section class="rl-cap" id="rl-cap-${c.id}"><h2 class="rl-cap-t"><span>${i + 1}</span>${esc(c.titulo)}</h2>${c.html}</section>`).join('');
  return `${capa}<div class="rl-c">${indice}<div class="rl-corpo">${corpo}</div></div>`;
}

// Índice dos capítulos: clicar leva ao capítulo (sem mexer no endereço da página) e o capítulo que está na tela fica marcado,
// tanto ao clicar quanto ao rolar. O clique é ouvido no documento inteiro, então continua valendo depois que a tela é redesenhada.
let indiceLigado = false;
let travado = null; // capítulo escolhido por clique: vale até a rolagem suave terminar
let aguardando = false;

function marcar(id) {
  document.querySelectorAll('[data-rl-ir]').forEach((b) => {
    const ativo = b.dataset.rlIr === id;
    b.classList.toggle('on', ativo);
    // No celular o índice é uma faixa com rolagem lateral: mantém o botão ativo à vista.
    const faixa = b.parentElement;
    if (ativo && faixa && faixa.scrollWidth > faixa.clientWidth) faixa.scrollTo({ left: b.offsetLeft - faixa.clientWidth / 2 + b.clientWidth / 2, behavior: 'smooth' });
  });
}

function descobrir() {
  const caps = [...document.querySelectorAll('.rl-cap')];
  if (!caps.length) return;
  let ativo = caps[0].id;
  for (const c of caps) if (c.getBoundingClientRect().top <= 170) ativo = c.id;
  // Chegou ao fim da página: o último capítulo (que pode ser curto demais para chegar ao topo) fica marcado.
  const se = document.scrollingElement;
  if (se.scrollTop + window.innerHeight >= se.scrollHeight - 3) ativo = caps[caps.length - 1].id;
  marcar(travado || ativo);
}

export function ligarIndice() {
  if (!indiceLigado) {
    indiceLigado = true;
    document.addEventListener('click', (e) => {
      const b = e.target.closest?.('[data-rl-ir]');
      const alvo = b && document.getElementById(b.dataset.rlIr);
      if (!alvo) return;
      travado = b.dataset.rlIr;
      marcar(travado);
      // Rolagem suave; se o navegador não anima (ou o usuário pediu menos movimento), pula direto para o capítulo.
      const antes = alvo.getBoundingClientRect().top;
      alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => { if (Math.abs(antes) > 24 && Math.abs(alvo.getBoundingClientRect().top - antes) < 2) alvo.scrollIntoView({ block: 'start' }); }, 450);
      // Acabamento: se a rolagem suave parou antes de chegar (e a página ainda tem para onde rolar), vai direto.
      setTimeout(() => {
        const se = document.scrollingElement;
        const noFim = se.scrollTop + window.innerHeight >= se.scrollHeight - 3;
        if (!noFim && Math.abs(alvo.getBoundingClientRect().top - 16) > 40) alvo.scrollIntoView({ block: 'start' });
      }, 1000);
    });
    const aoRolar = () => { if (aguardando) return; aguardando = true; requestAnimationFrame(() => { aguardando = false; descobrir(); }); };
    document.addEventListener('scroll', aoRolar, { passive: true, capture: true });
    window.addEventListener('resize', aoRolar);
    // O capítulo escolhido por clique fica marcado até a pessoa rolar por conta própria (roda do mouse, toque ou teclado).
    const soltar = () => { travado = null; };
    ['wheel', 'touchstart', 'pointerdown'].forEach((ev) => document.addEventListener(ev, (e) => { if (!e.target.closest?.('[data-rl-ir]')) soltar(); }, { passive: true }));
    document.addEventListener('keydown', (e) => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) soltar(); });
  }
  descobrir();
}
