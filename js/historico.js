import { store } from './store.js?v=126';
import { esc, norm, slug, toast, dataBR } from './util.js?v=126';
import { ic, flor } from './icons.js?v=126';
import { confirmar } from './ui.js?v=126';

// Histórico do Asana: tarefas antigas guardadas à parte (tipo "historico" no banco). Elas NÃO entram na carga normal do painel
// (store.recarregar as ignora); só são buscadas quando alguém abre o Histórico de um cliente.
export const PASTA_DRIVE = 'https://drive.google.com/drive/folders/1TAtr4Li1-KfkPZJDrO7yEIUyXAs3uheT';
const POR_BLOCO = 120;
const MOSTRAR = 150;

const limpoNome = (s) => norm(s).replace(/[^a-z0-9]+/g, ' ').trim();

// ---------- Importação ----------

// Liga cada cliente do arquivo a um cliente que já existe no painel (pelo nome ou apelidos); se não houver, será criado.
export function casarClientes(arquivo, existentes) {
  return (arquivo.clientes || []).map((def) => {
    const nomes = new Set([def.nome, ...(def.aliases || [])].map(limpoNome));
    const achado = existentes.find((c) => nomes.has(limpoNome(c.nome)));
    return { def, existente: achado || null, id: achado?.id || slug(def.nome) };
  });
}

function blocosDe(def, clienteId) {
  const out = [];
  for (const p of def.projetos || []) {
    for (let i = 0, n = 1; i < p.tarefas.length; i += POR_BLOCO, n++) {
      out.push({ id: `asana-${p.gid}-${n}`, data: { clienteId, projeto: p.nome, projetoGid: p.gid, parte: n, origem: 'asana', tarefas: p.tarefas.slice(i, i + POR_BLOCO) } });
    }
  }
  return out;
}

export async function importarHistorico(arquivo) {
  const sb = store.supabase();
  if (!sb) throw new Error('O histórico só pode ser importado no painel online, com login.');
  if (!Array.isArray(arquivo?.clientes) || !arquivo.clientes.length) throw new Error('Este arquivo não é um histórico do Asana.');
  const casados = casarClientes(arquivo, store.todos('cliente'));
  const total = arquivo.clientes.reduce((s, c) => s + c.projetos.reduce((t, p) => t + p.tarefas.length, 0), 0);
  const novos = casados.filter((c) => !c.existente);
  const aviso = [
    `Trazer ${total.toLocaleString('pt-BR')} tarefas do Asana para ${casados.length} clientes?`,
    novos.length ? `Serão criados ${novos.length} clientes que ainda não existem no painel: ${novos.map((c) => `${c.def.nome} (${c.def.status === 'ativo' ? 'ativo' : 'inativo'})`).join(', ')}.` : 'Todos os clientes já existem no painel.',
    'O histórico fica guardado à parte, só para consulta, e não deixa o painel lento. Rodar de novo atualiza o que já foi trazido, sem duplicar.',
  ].join(' ');
  if (!(await confirmar(aviso, 'Trazer histórico'))) return;

  for (const c of novos) {
    const datas = c.def.projetos.flatMap((p) => p.tarefas.map((t) => t.d || t.cr || '')).filter(Boolean).sort();
    await store.salvar('cliente', {
      id: c.id, nome: c.def.nome, status: c.def.status === 'ativo' ? 'ativo' : 'inativo', modelo: 'recorrente',
      ...(c.def.interno ? { interno: true } : {}),
      ...(c.def.status === 'ativo' ? {} : { fim: datas[datas.length - 1] || '' }),
    });
  }
  const linhas = casados.flatMap((c) => blocosDe(c.def, c.id)).map((b) => ({ kind: 'historico', id: b.id, data: { ...b.data, id: b.id }, updated_by: store.emailUsuario() }));
  for (let i = 0; i < linhas.length; i += 3) {
    const { error } = await sb.from('records').upsert(linhas.slice(i, i + 3));
    if (error) throw new Error(`Não consegui guardar o histórico (${error.message || error.code}). O que já foi enviado fica; rode de novo para completar.`);
    toast(`Guardando histórico: ${Math.min(i + 3, linhas.length)} de ${linhas.length}`);
  }
  for (const k of Object.keys(cache)) delete cache[k];
  toast(`Histórico trazido: ${total.toLocaleString('pt-BR')} tarefas de ${casados.length} clientes`);
}

// ---------- Leitura (só do cliente aberto) ----------

const cache = {}; // clienteId -> { estado: 'carregando'|'ok'|'erro', projetos: [{nome, gid, tarefas}], erro }
let semente = null; // modo local (?local): lê seed/asana-historico.json uma vez

async function lerDoBanco(clienteId) {
  const sb = store.supabase();
  if (sb) {
    const { data, error } = await sb.from('records').select('id,data').eq('kind', 'historico').eq('data->>clienteId', clienteId);
    if (error) throw new Error('Não consegui abrir o histórico agora. Confira a conexão e tente de novo.');
    return (data || []).map((r) => r.data);
  }
  if (!semente) {
    const r = await fetch('seed/asana-historico.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('No modo de teste, o histórico só aparece se o arquivo seed/asana-historico.json existir.');
    semente = await r.json();
  }
  return casarClientes(semente, store.todos('cliente')).filter((c) => c.id === clienteId).flatMap((c) => blocosDe(c.def, c.id).map((b) => b.data));
}

function agrupar(blocos) {
  const mapa = new Map();
  for (const b of blocos.sort((a, c) => (a.parte || 0) - (c.parte || 0))) {
    if (!mapa.has(b.projetoGid)) mapa.set(b.projetoGid, { nome: b.projeto, gid: b.projetoGid, tarefas: [] });
    mapa.get(b.projetoGid).tarefas.push(...(b.tarefas || []));
  }
  return [...mapa.values()];
}

// Busca uma vez por cliente; quando chegar, chama "redesenhar" para a tela mostrar.
function garantir(clienteId, redesenhar) {
  if (cache[clienteId]) return cache[clienteId];
  cache[clienteId] = { estado: 'carregando', projetos: [] };
  lerDoBanco(clienteId)
    .then((blocos) => { cache[clienteId] = { estado: 'ok', projetos: agrupar(blocos) }; })
    .catch((err) => { cache[clienteId] = { estado: 'erro', projetos: [], erro: err.message || 'Não consegui abrir o histórico.' }; })
    .finally(redesenhar);
  return cache[clienteId];
}

// ---------- Tela ----------

const f = { busca: '', situacao: 'todas', projeto: '', vista: 'calendario', mes: '', sel: '', dia: '' };
let atual = null; // { projetos } do cliente que está na tela, usado pelos filtros

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const cap = (t) => t.replace(/^./, (c) => c.toUpperCase());
const tamanho = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const links = (texto) => esc(texto).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u.length > 70 ? `${u.slice(0, 67)}…` : u}</a>`);
// Data que posiciona a tarefa: o prazo; sem prazo, a conclusão; sem conclusão, a criação.
const dataDe = (t) => t.d || t.cq || t.cr || '';
const mesDe = (t) => dataDe(t).slice(0, 7);
const isoDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function detalhe(t, projeto, mostrarProjeto, aberto = false) {
  const meta = [t.d ? dataBR(t.d) : '', t.r, t.s && t.s !== 'Seção sem título' ? t.s : '', mostrarProjeto ? projeto : ''].filter(Boolean).join(' · ');
  const subs = (t.sb || []).map((x) => `<li class="${x.c ? 'ok' : ''}"><span>${x.c ? '✓' : '○'}</span><div><b>${esc(x.t || '(sem título)')}</b>${x.r || x.d ? `<small>${esc([x.d ? dataBR(x.d) : '', x.r].filter(Boolean).join(' · '))}</small>` : ''}${x.n ? `<p>${links(x.n)}</p>` : ''}</div></li>`).join('');
  const campos = Object.entries(t.cf || {}).map(([k, v]) => `<span class="chip mute">${esc(k)}: ${esc(v)}</span>`).join('');
  const anexos = (t.a || []).map(([n, b]) => `<li>${esc(n)}${b ? ` <small>${tamanho(b)}</small>` : ''}</li>`).join('');
  const coments = (t.cm || []).map((c) => `<li><small>${esc([c.d ? dataBR(c.d) : '', c.a].filter(Boolean).join(' · '))}</small><p>${links(c.t)}</p></li>`).join('');
  return `<details class="hi"${aberto ? ' open' : ''}><summary><i class="hi-st ${t.c ? 'ok' : ''}" title="${t.c ? 'Concluída' : 'Em aberto'}"></i><span class="hi-t">${esc(t.t || '(sem título)')}</span><span class="hi-m">${esc(meta)}</span></summary>
    <div class="hi-c"><div class="hi-sec"><b>Descrição</b>${t.n ? `<p class="hi-n">${links(t.n)}</p>` : '<p class="lbl">Sem descrição.</p>'}</div>
      ${coments ? `<div class="hi-sec"><b>Comentários</b><ul class="hi-com">${coments}</ul></div>` : ''}
      ${campos ? `<div class="hi-cf">${campos}</div>` : ''}
      ${subs ? `<div class="hi-sec"><b>Subtarefas</b><ul class="hi-sub">${subs}</ul></div>` : ''}
      ${anexos ? `<div class="hi-sec"><b>Arquivos anexados no Asana</b><ul class="hi-ax">${anexos}</ul><p class="lbl">Os arquivos estão guardados na <a href="${PASTA_DRIVE}" target="_blank" rel="noopener noreferrer">pasta Histórico Asana (backup) do Drive</a>, na subpasta do projeto.</p></div>` : ''}
      ${t.cq ? `<p class="lbl">Concluída em ${esc(dataBR(t.cq))}.</p>` : ''}</div></details>`;
}

// Tarefas que passam pelos filtros (busca, situação, projeto): [[tarefa, nomeDoProjeto], ...]
function filtradas() {
  if (!atual) return [];
  const q = norm(f.busca).trim();
  const out = [];
  for (const p of atual.projetos.filter((x) => !f.projeto || x.gid === f.projeto)) {
    for (const t of p.tarefas) {
      if (f.situacao === 'abertas' && t.c) continue;
      if (f.situacao === 'concluidas' && !t.c) continue;
      if (q && !norm([t.t, t.n, t.r, t.s, ...(t.sb || []).flatMap((x) => [x.t, x.n]), ...(t.cm || []).map((c) => c.t), ...(t.a || []).map((a) => a[0])].join(' ')).includes(q)) continue;
      out.push([t, p.nome]);
    }
  }
  return out;
}

function listaHtml() {
  const achadas = filtradas().sort((a, b) => dataDe(b[0]).localeCompare(dataDe(a[0])));
  if (!achadas.length) return '<p class="lbl" style="padding:18px 4px">Nenhuma tarefa com esse filtro.</p>';
  const mostrar = achadas.slice(0, 150);
  const multi = atual.projetos.length > 1;
  let mes = null;
  const html = mostrar.map(([t, p]) => {
    const m = mesDe(t);
    const cab = m !== mes ? `<h3 class="hi-mes">${m ? `${cap(NOME_MES[Number(m.slice(5, 7)) - 1])} de ${m.slice(0, 4)}` : 'Sem data'}</h3>` : '';
    mes = m;
    return cab + detalhe(t, p, multi);
  }).join('');
  return `${html}${achadas.length > mostrar.length ? `<p class="lbl" style="padding:14px 4px">Mostrando as ${mostrar.length} mais recentes de ${achadas.length}. Use a busca para achar as outras.</p>` : ''}<p class="lbl" style="padding:6px 4px">${achadas.length.toLocaleString('pt-BR')} ${achadas.length === 1 ? 'tarefa' : 'tarefas'}.</p>`;
}

// Calendário do mês: cada tarefa no dia do prazo, com o círculo verde nas concluídas.
function calendarioHtml() {
  const achadas = filtradas();
  if (!achadas.length) return '<p class="lbl" style="padding:18px 4px">Nenhuma tarefa com esse filtro.</p>';
  const meses = [...new Set(achadas.map(([t]) => mesDe(t)).filter(Boolean))].sort();
  if (!f.mes || !/^\d{4}-\d{2}$/.test(f.mes)) f.mes = meses[meses.length - 1] || isoDia(new Date()).slice(0, 7);
  const [a, m] = f.mes.split('-').map(Number);
  const porDia = {};
  const semData = [];
  for (const par of achadas) { const d = dataDe(par[0]); if (!d) semData.push(par); else (porDia[d] ||= []).push(par); }
  const primeiro = new Date(a, m - 1, 1).getDay();
  const semanas = Math.ceil((primeiro + new Date(a, m, 0).getDate()) / 7);
  let doMes = 0, feitas = 0;
  const celulas = Array.from({ length: semanas * 7 }, (_, i) => {
    const d = new Date(a, m - 1, 1 - primeiro + i);
    const iso = isoDia(d);
    const dentro = d.getMonth() === m - 1;
    const tarefas = porDia[iso] || [];
    if (dentro) { doMes += tarefas.length; feitas += tarefas.filter(([t]) => t.c).length; }
    const chips = tarefas.slice(0, 4).map(([t]) => `<button type="button" class="hc-t${t.c ? ' ok' : ''}${f.sel === t.i ? ' sel' : ''}" data-hist-abrir="${esc(t.i)}" title="${esc(t.t || '')}"><i class="hi-st ${t.c ? 'ok' : ''}"></i><span>${esc(t.t || '(sem título)')}</span></button>`).join('');
    const mais = tarefas.length > 4 ? `<button type="button" class="hc-mais" data-hist-dia="${iso}">+${tarefas.length - 4} mais</button>` : '';
    return `<div class="dia${dentro ? '' : ' fora'}"><div class="dia-h"><b>${d.getDate()}</b></div>${chips}${mais}</div>`;
  }).join('');
  const multi = atual.projetos.length > 1;
  let painel = '';
  if (f.sel) {
    const par = achadas.find(([t]) => t.i === f.sel);
    if (par) painel = `<div class="hc-det">${detalhe(par[0], par[1], multi, true)}</div>`;
  } else if (f.dia && porDia[f.dia]) {
    painel = `<div class="hc-det"><h3 class="hi-mes">${esc(dataBR(f.dia))}</h3>${porDia[f.dia].map(([t, p]) => detalhe(t, p, multi)).join('')}</div>`;
  }
  return `<div class="toolbar" style="margin-bottom:12px"><div class="mes">
      <button type="button" class="iconbtn" data-hist-mes="-1" aria-label="Mês anterior"><span style="display:grid;transform:scaleX(-1)">${ic('chev')}</span></button>
      <b>${cap(NOME_MES[m - 1])} de ${a}</b>
      <button type="button" class="iconbtn" data-hist-mes="1" aria-label="Próximo mês">${ic('chev')}</button>
      <button type="button" class="btn ghost sm" data-hist-mes="ultimo">Último mês com tarefas</button></div>
      <span class="lbl">${doMes} ${doMes === 1 ? 'tarefa' : 'tarefas'} neste mês, ${feitas} concluídas</span></div>
    <div class="calbox"><div class="calgrid">${DIAS.map((d) => `<div class="dow">${d}</div>`).join('')}${celulas}</div></div>
    ${painel}
    ${semData.length ? `<p class="lbl" style="padding:10px 4px">${semData.length} ${semData.length === 1 ? 'tarefa sem nenhuma data não aparece' : 'tarefas sem nenhuma data não aparecem'} no calendário (veja na lista).</p>` : ''}`;
}

const corpoHtml = () => (f.vista === 'lista' ? listaHtml() : calendarioHtml());

export function histCartao(cliente, redesenhar) {
  const d = garantir(cliente.id, redesenhar);
  const cab = `<div class="card-h"><div><h2>Histórico do Asana: ${esc(cliente.nome)}</h2><p class="sub">Tarefas antigas trazidas do Asana, só para consulta, com os comentários (legendas e conversa). Os arquivos anexados estão no Drive.</p></div><a class="btn sec sm" href="${PASTA_DRIVE}" target="_blank" rel="noopener noreferrer">${ic('link')}Abrir pasta no Drive</a></div>`;
  if (d.estado === 'carregando') return `<div class="card">${cab}<p class="lbl" style="padding:18px 4px">Abrindo o histórico…</p></div>`;
  if (d.estado === 'erro') return `<div class="card">${cab}<div class="aviso">${ic('alert')}<span>${esc(d.erro)}</span></div></div>`;
  if (!d.projetos.length) return `<div class="card">${cab}<div class="empty" style="padding:30px 10px">${flor()}<h2>Sem histórico do Asana</h2><p>Este cliente não tem tarefas trazidas do Asana. Se ele tinha projeto lá, use Adicionar em lote > Histórico do Asana.</p></div></div>`;
  atual = d;
  const todas = d.projetos.flatMap((p) => p.tarefas);
  const datas = todas.map(dataDe).filter(Boolean).sort();
  const feitas = todas.filter((t) => t.c).length;
  const resumo = `${todas.length.toLocaleString('pt-BR')} tarefas (${feitas.toLocaleString('pt-BR')} concluídas)${datas.length ? `, de ${dataBR(datas[0])} a ${dataBR(datas[datas.length - 1])}` : ''}`;
  const projetos = d.projetos.length > 1 ? `<select data-hist-projeto aria-label="Projeto"><option value="">Todos os projetos</option>${d.projetos.map((p) => `<option value="${esc(p.gid)}" ${f.projeto === p.gid ? 'selected' : ''}>${esc(p.nome)} (${p.tarefas.length})</option>`).join('')}</select>` : '';
  return `<div class="card">${cab}
    <p class="lbl" style="margin:-4px 0 12px">${esc(resumo)}</p>
    <div class="hi-filtros"><div class="seg" style="margin:0" role="group" aria-label="Forma de ver"><button type="button" class="seg-b ${f.vista === 'calendario' ? 'on' : ''}" data-hist-vista="calendario">Calendário</button><button type="button" class="seg-b ${f.vista === 'lista' ? 'on' : ''}" data-hist-vista="lista">Lista</button></div>
      <input type="search" data-hist-busca placeholder="Buscar no histórico (título, legenda, comentário)" value="${esc(f.busca)}" aria-label="Buscar no histórico">
      <select data-hist-situacao aria-label="Situação"><option value="todas" ${f.situacao === 'todas' ? 'selected' : ''}>Todas</option><option value="abertas" ${f.situacao === 'abertas' ? 'selected' : ''}>Em aberto</option><option value="concluidas" ${f.situacao === 'concluidas' ? 'selected' : ''}>Concluídas</option></select>${projetos}</div>
    <div class="hi-lista" data-hist-lista>${corpoHtml()}</div></div>`;
}

// Liga busca, filtros, mudança de mês e abertura de tarefa sem redesenhar a tela inteira (o cursor não sai do campo).
export function histMontar(el) {
  const lista = el.querySelector('[data-hist-lista]');
  if (!lista) return;
  const pintar = () => { lista.innerHTML = corpoHtml(); };
  el.querySelector('[data-hist-busca]')?.addEventListener('input', (ev) => { f.busca = ev.target.value; f.sel = ''; f.dia = ''; pintar(); });
  el.querySelector('[data-hist-situacao]')?.addEventListener('change', (ev) => { f.situacao = ev.target.value; f.sel = ''; f.dia = ''; pintar(); });
  el.querySelector('[data-hist-projeto]')?.addEventListener('change', (ev) => { f.projeto = ev.target.value; f.sel = ''; f.dia = ''; pintar(); });
  el.querySelectorAll('[data-hist-vista]').forEach((b) => b.addEventListener('click', () => {
    f.vista = b.dataset.histVista;
    el.querySelectorAll('[data-hist-vista]').forEach((x) => x.classList.toggle('on', x === b));
    pintar();
  }));
  lista.addEventListener('click', (ev) => {
    const mes = ev.target.closest('[data-hist-mes]');
    if (mes) {
      const v = mes.dataset.histMes;
      if (v === 'ultimo') f.mes = '';
      else { const [a, m] = f.mes.split('-').map(Number); const d = new Date(a, m - 1 + Number(v), 1); f.mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
      f.sel = ''; f.dia = '';
      pintar();
      return;
    }
    const abrir = ev.target.closest('[data-hist-abrir]');
    if (abrir) { f.sel = f.sel === abrir.dataset.histAbrir ? '' : abrir.dataset.histAbrir; f.dia = ''; pintar(); lista.querySelector('.hc-det')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
    const dia = ev.target.closest('[data-hist-dia]');
    if (dia) { f.dia = dia.dataset.histDia; f.sel = ''; pintar(); lista.querySelector('.hc-det')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  });
}
