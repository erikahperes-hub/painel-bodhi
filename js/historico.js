import { store } from './store.js?v=109';
import { esc, norm, slug, toast, dataBR } from './util.js?v=109';
import { ic, flor } from './icons.js?v=109';
import { confirmar } from './ui.js?v=109';

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

const f = { busca: '', situacao: 'todas', projeto: '' };
let atual = null; // { projetos } do cliente que está na tela, usado pelos filtros

const tamanho = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const links = (texto) => esc(texto).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u.length > 70 ? `${u.slice(0, 67)}…` : u}</a>`);
const mesDe = (t) => (t.d || t.cr || '').slice(0, 7);
const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function linhaTarefa(t, projeto, mostrarProjeto) {
  const meta = [t.d ? dataBR(t.d) : '', t.r, t.s && t.s !== 'Seção sem título' ? t.s : '', mostrarProjeto ? projeto : ''].filter(Boolean).join(' · ');
  const subs = (t.sb || []).map((s) => `<li class="${s.c ? 'ok' : ''}"><span>${s.c ? '✓' : '○'}</span><div><b>${esc(s.t || '(sem título)')}</b>${s.r || s.d ? `<small>${esc([s.d ? dataBR(s.d) : '', s.r].filter(Boolean).join(' · '))}</small>` : ''}${s.n ? `<p>${links(s.n)}</p>` : ''}</div></li>`).join('');
  const campos = Object.entries(t.cf || {}).map(([k, v]) => `<span class="chip mute">${esc(k)}: ${esc(v)}</span>`).join('');
  const anexos = (t.a || []).map(([n, b]) => `<li>${esc(n)}${b ? ` <small>${tamanho(b)}</small>` : ''}</li>`).join('');
  return `<details class="hi"><summary><i class="hi-st ${t.c ? 'ok' : ''}" title="${t.c ? 'Concluída' : 'Em aberto'}"></i><span class="hi-t">${esc(t.t || '(sem título)')}</span><span class="hi-m">${esc(meta)}</span></summary>
    <div class="hi-c">${t.n ? `<p class="hi-n">${links(t.n)}</p>` : '<p class="lbl">Sem descrição.</p>'}
      ${campos ? `<div class="hi-cf">${campos}</div>` : ''}
      ${subs ? `<div class="hi-sec"><b>Subtarefas</b><ul class="hi-sub">${subs}</ul></div>` : ''}
      ${anexos ? `<div class="hi-sec"><b>Arquivos anexados no Asana</b><ul class="hi-ax">${anexos}</ul><p class="lbl">Os arquivos estão guardados na <a href="${PASTA_DRIVE}" target="_blank" rel="noopener noreferrer">pasta Histórico Asana (backup) do Drive</a>, na subpasta do projeto.</p></div>` : ''}
      ${t.cq ? `<p class="lbl">Concluída em ${esc(dataBR(t.cq))}.</p>` : ''}</div></details>`;
}

function listaHtml() {
  if (!atual) return '';
  const projetos = atual.projetos.filter((p) => !f.projeto || p.gid === f.projeto);
  const q = norm(f.busca).trim();
  const achadas = [];
  for (const p of projetos) {
    for (const t of p.tarefas) {
      if (f.situacao === 'abertas' && t.c) continue;
      if (f.situacao === 'concluidas' && !t.c) continue;
      if (q) {
        const palheiro = norm([t.t, t.n, t.r, t.s, ...(t.sb || []).flatMap((s) => [s.t, s.n]), ...(t.a || []).map((a) => a[0])].join(' '));
        if (!palheiro.includes(q)) continue;
      }
      achadas.push([t, p.nome]);
    }
  }
  achadas.sort((a, b) => (b[0].d || b[0].cr || '').localeCompare(a[0].d || a[0].cr || ''));
  if (!achadas.length) return '<p class="lbl" style="padding:18px 4px">Nenhuma tarefa com esse filtro.</p>';
  const mostrar = achadas.slice(0, MOSTRAR);
  const multi = atual.projetos.length > 1;
  let mes = null;
  const html = mostrar.map(([t, p]) => {
    const m = mesDe(t);
    const cab = m !== mes ? `<h3 class="hi-mes">${m ? `${NOME_MES[Number(m.slice(5, 7)) - 1].replace(/^./, (c) => c.toUpperCase())} de ${m.slice(0, 4)}` : 'Sem data'}</h3>` : '';
    mes = m;
    return cab + linhaTarefa(t, p, multi);
  }).join('');
  return `${html}${achadas.length > mostrar.length ? `<p class="lbl" style="padding:14px 4px">Mostrando as ${mostrar.length} mais recentes de ${achadas.length}. Use a busca para achar as outras.</p>` : ''}<p class="lbl" style="padding:6px 4px">${achadas.length.toLocaleString('pt-BR')} ${achadas.length === 1 ? 'tarefa' : 'tarefas'}.</p>`;
}

export function histCartao(cliente, redesenhar) {
  const d = garantir(cliente.id, redesenhar);
  const cab = `<div class="card-h"><div><h2>Histórico do Asana: ${esc(cliente.nome)}</h2><p class="sub">Tarefas antigas trazidas do Asana, só para consulta. Os arquivos anexados estão no Drive.</p></div><a class="btn sec sm" href="${PASTA_DRIVE}" target="_blank" rel="noopener noreferrer">${ic('link')}Abrir pasta no Drive</a></div>`;
  if (d.estado === 'carregando') return `<div class="card">${cab}<p class="lbl" style="padding:18px 4px">Abrindo o histórico…</p></div>`;
  if (d.estado === 'erro') return `<div class="card">${cab}<div class="aviso">${ic('alert')}<span>${esc(d.erro)}</span></div></div>`;
  if (!d.projetos.length) return `<div class="card">${cab}<div class="empty" style="padding:30px 10px">${flor()}<h2>Sem histórico do Asana</h2><p>Este cliente não tem tarefas trazidas do Asana. Se ele tinha projeto lá, use Adicionar em lote > Histórico do Asana.</p></div></div>`;
  atual = d;
  const todas = d.projetos.flatMap((p) => p.tarefas);
  const datas = todas.map((t) => t.d || t.cr || '').filter(Boolean).sort();
  const resumo = `${todas.length.toLocaleString('pt-BR')} tarefas${datas.length ? `, de ${dataBR(datas[0])} a ${dataBR(datas[datas.length - 1])}` : ''}`;
  const projetos = d.projetos.length > 1 ? `<select data-hist-projeto aria-label="Projeto"><option value="">Todos os projetos</option>${d.projetos.map((p) => `<option value="${esc(p.gid)}" ${f.projeto === p.gid ? 'selected' : ''}>${esc(p.nome)} (${p.tarefas.length})</option>`).join('')}</select>` : '';
  return `<div class="card">${cab}
    <p class="lbl" style="margin:-4px 0 12px">${esc(resumo)}</p>
    <div class="hi-filtros"><input type="search" data-hist-busca placeholder="Buscar no histórico" value="${esc(f.busca)}" aria-label="Buscar no histórico">
      <select data-hist-situacao aria-label="Situação"><option value="todas" ${f.situacao === 'todas' ? 'selected' : ''}>Todas</option><option value="abertas" ${f.situacao === 'abertas' ? 'selected' : ''}>Em aberto</option><option value="concluidas" ${f.situacao === 'concluidas' ? 'selected' : ''}>Concluídas</option></select>${projetos}</div>
    <div class="hi-lista" data-hist-lista>${listaHtml()}</div></div>`;
}

// Liga busca e filtros sem redesenhar a tela inteira (para o cursor não sair do campo).
export function histMontar(el) {
  const lista = el.querySelector('[data-hist-lista]');
  if (!lista) return;
  const pintar = () => { lista.innerHTML = listaHtml(); };
  el.querySelector('[data-hist-busca]')?.addEventListener('input', (ev) => { f.busca = ev.target.value; pintar(); });
  el.querySelector('[data-hist-situacao]')?.addEventListener('change', (ev) => { f.situacao = ev.target.value; pintar(); });
  el.querySelector('[data-hist-projeto]')?.addEventListener('change', (ev) => { f.projeto = ev.target.value; pintar(); });
}
