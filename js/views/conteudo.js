import { store } from '../store.js?v=137';
import { esc, toast, dataBR, urlSegura, hojeISO, mesNome, norm, slug } from '../util.js?v=137';
import { ic, flor } from '../icons.js?v=137';
import { formulario, confirmar, abrirModal } from '../ui.js?v=137';
import { ETAPAS, FORMATOS, REDES, formatoDe, redeDe, etapaDe, atrasada, pecas } from '../conteudo.js?v=137';
import { idDrive, urlAbrir, urlImagem } from '../drive.js?v=137';
import { feedPerfil } from '../feed-perfil.js?v=137';
import { igApi } from '../instagram-api.js?v=137';
import { lerPasta } from '../drive-pasta.js?v=137';
import { lerTabela } from '../planejamento.js?v=137';
import { config } from '../config.js?v=137';
import { histCartao, histMontar, importarHistorico } from '../historico.js?v=137';
import { abrirTarefa } from '../tarefa.js?v=137';

const RESPONSAVEIS = ['Érika', 'Milena'];
// Aprovação do planejamento (ideia e roteiro) pelo cliente, antes de a tarefa ser produzida.
// Etapa do funil de cada tarefa: topo (atrair), meio (considerar) e fundo (converter).
const FUNIL = { '': 'Sem etapa de funil', topo: 'Topo de funil', meio: 'Meio de funil', fundo: 'Fundo de funil' };
const FUNIL_COR = { topo: 'cor-mute', meio: 'cor-mute', fundo: 'cor-mute' };
// Cor por tipo de conteúdo: Reels, Carrossel, Estático e Story têm cada um a sua.
const fmCls = (p) => `fm-${FORMATOS[p.formato] ? p.formato : 'feed'}`;
const funilChip = (p) => (FUNIL_COR[p.funil] ? `<span class="chip ${FUNIL_COR[p.funil]}">${FUNIL[p.funil]}</span>` : '');
// Filtro do funil no Calendário: '' (todos), 'topo', 'meio', 'fundo' ou 'sem'. Vale até recarregar a página.
let filtroFunil = '';
let filtroTipo = ''; // '', 'reels', 'carrossel', 'feed' (estático) ou 'story'
const casaFunil = (p) => !filtroFunil || (filtroFunil === 'sem' ? !FUNIL_COR[p.funil] : p.funil === filtroFunil);
const casaTipo = (p) => !filtroTipo || (FORMATOS[p.formato] ? p.formato : 'feed') === filtroTipo;
let filtroPessoa = ''; // '', o nome de quem é responsável (Érika, Milena) ou 'sem'. Vale no Status, Calendário e Feed até recarregar a página.
const casaPessoa = (p) => !filtroPessoa || (filtroPessoa === 'sem' ? !p.responsavel : p.responsavel === filtroPessoa);
// Quem está usando o painel, para o botão "Minhas": o nome da conta ou o começo do e-mail (se for uma das responsáveis).
const meuNome = () => {
  const n = store.nomeUsuario() || (store.emailUsuario() || '').split('@')[0];
  const achado = ['Érika', 'Milena'].find((r) => norm(r) === norm(n) || norm(n).startsWith(norm(r)));
  return achado || '';
};
let filtroRede = ''; // '', um código de REDES ou 'sem'
const casaRede = (p) => !filtroRede || (filtroRede === 'sem' ? !REDES[p.rede] : p.rede === filtroRede);
const nFiltros = () => [filtroTipo, filtroFunil, filtroRede].filter(Boolean).length;
// Etiqueta da rede no cartão (cada rede tem a sua cor).
const redeChip = (p) => (REDES[p.rede] ? `<span class="chip rd-${p.rede}">${esc(REDES[p.rede].nome)}</span>` : '');

// Botão "Filtros" ao lado de "Nova tarefa": responsável, tipo, funil e rede num painel só.
// Tipo, funil e rede só valem no Calendário; o responsável vale no Status, Calendário e Feed.
let filtrosAberto = false;
let baseFiltros = []; // tarefas do mês mostrado (do cliente escolhido), para os números dentro do painel
const nAtivos = () => (filtroPessoa ? 1 : 0) + (aba === 'calendario' ? nFiltros() : 0);

function painelFiltros() {
  const eu = meuNome();
  const cal = aba === 'calendario';
  const doMes = baseFiltros.filter(casaPessoa);
  const chip = (cls, act, attr, on, html) => `<button type="button" class="chip ${cls} funil-btn${on ? ' on' : ''}" data-act="${act}" ${attr} aria-pressed="${on}">${html}</button>`;
  const grupo = (rot, botoes) => `<div class="fl-g"><span class="filtros-rot">${rot}</span><div class="fl-bt">${botoes}</div></div>`;

  const pessoas = ['Érika', 'Milena'].sort((x, y) => (y === eu) - (x === eu));
  const nPessoa = (f) => baseFiltros.filter(f).length;
  const resp = grupo('Responsável', [
    chip('cor-mute', 'filtro-pessoa', 'data-v=""', !filtroPessoa, `Todas ${baseFiltros.length}`),
    ...pessoas.map((r) => chip('cor-mute', 'filtro-pessoa', `data-v="${esc(r)}"`, filtroPessoa === r, `${r === eu ? 'Minhas' : esc(r)} ${nPessoa((p) => p.responsavel === r)}`)),
    chip('cor-mute', 'filtro-pessoa', 'data-v="sem"', filtroPessoa === 'sem', `Sem responsável ${nPessoa((p) => !p.responsavel)}`),
  ].join(''));

  let resto = '';
  if (cal) {
    const tipo = grupo('Tipo', Object.entries(FORMATOS).map(([id, f]) => chip(`fm-${id} tipo-btn`, 'filtro-tipo', `data-tipo="${id}"`, filtroTipo === id,
      `${ic(f.icone)}${esc(f.nome)} ${doMes.filter((p) => (FORMATOS[p.formato] ? p.formato : 'feed') === id).length}`)).join(''));

    const nf = (k) => doMes.filter((p) => p.funil === k).length;
    const semFunil = doMes.filter((p) => !FUNIL_COR[p.funil]).length;
    const funil = nf('topo') + nf('meio') + nf('fundo') === 0 ? '' : grupo('Funil', [
      ...['topo', 'meio', 'fundo'].map((k) => chip('cor-mute', 'filtro-funil', `data-funil="${k}"`, filtroFunil === k, `${FUNIL[k].replace(' de funil', '')} ${nf(k)}`)),
      semFunil ? chip('cor-mute', 'filtro-funil', 'data-funil="sem"', filtroFunil === 'sem', `Sem funil ${semFunil}`) : '',
    ].join(''));

    const nr = (k) => doMes.filter((p) => p.rede === k).length;
    const semRede = doMes.filter((p) => !REDES[p.rede]).length;
    const rede = !Object.keys(REDES).some((k) => nr(k)) ? '' : grupo('Rede', [
      ...Object.entries(REDES).filter(([k]) => nr(k)).map(([k, r]) => chip(`rd-${k}`, 'filtro-rede', `data-rede="${k}"`, filtroRede === k, `${esc(r.nome)} ${nr(k)}`)),
      semRede ? chip('cor-mute', 'filtro-rede', 'data-rede="sem"', filtroRede === 'sem', `Sem rede ${semRede}`) : '',
    ].join(''));
    resto = tipo + funil + rede;
  }

  const n = nAtivos();
  return `<div class="fl-fundo"></div><div class="fl-pop" role="dialog" aria-label="Filtros">
    <div class="fl-h"><b>Filtros</b><span>Números do mês mostrado</span></div>
    ${resp}${resto}
    <div class="fl-f"><button type="button" class="btn ghost sm" data-act="limpar-tudo"${n ? '' : ' disabled'}>Limpar filtros</button><button type="button" class="btn pri sm" data-act="fechar-filtros">Pronto</button></div></div>`;
}

function botaoFiltros() {
  const n = nAtivos();
  const eu = meuNome();
  const minhas = eu ? `<button type="button" class="fl-eu${filtroPessoa === eu ? ' on' : ''}" data-act="filtro-pessoa" data-v="${esc(eu)}" aria-pressed="${filtroPessoa === eu}" aria-label="Só as minhas tarefas" title="Só as minhas tarefas">${esc(eu.charAt(0))}</button>` : '';
  return `<span class="fl-wrap">${minhas}<button type="button" class="btn sec sm fl-b${n ? ' ativo' : ''}" data-act="abrir-filtros" aria-expanded="${filtrosAberto}" aria-haspopup="dialog">${ic('sliders')}Filtros${n ? ` · ${n}` : ''}</button>${filtrosAberto ? painelFiltros() : ''}</span>`;
}
window.addEventListener('hashchange', () => { filtrosAberto = false; });
// O painel fecha ao clicar fora dele ou com Esc.
const fecharFiltros = () => { if (filtrosAberto) { filtrosAberto = false; window.dispatchEvent(new Event('atualizar-tela')); } };
document.addEventListener('click', (ev) => { if (filtrosAberto && ev.target.isConnected && !ev.target.closest('.fl-pop, [data-act="abrir-filtros"]')) fecharFiltros(); });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') fecharFiltros(); });

// Lista das tarefas do grupo escolhido no funil, logo abaixo do calendário.
function listaFunil(lista, mostrarCliente) {
  if (!nFiltros()) return '';
  const itens = ordenarPecas(lista.filter((p) => casaFunil(p) && casaTipo(p) && casaRede(p)));
  const nome = [filtroTipo ? FORMATOS[filtroTipo].nome : '', filtroFunil ? (filtroFunil === 'sem' ? 'Sem etapa de funil' : FUNIL[filtroFunil]) : '', filtroRede ? (filtroRede === 'sem' ? 'Sem rede' : REDES[filtroRede].nome) : ''].filter(Boolean).join(' · ');
  const linha = (p) => {
    const f = FORMATOS[p.formato] || FORMATOS.feed;
    const e = etapaDe(p);
    const cli = store.obter('cliente', p.clienteId)?.nome || '';
    const meta = [p.publicar ? dataBR(p.publicar).slice(0, 5) : 'Sem data', f.nome, mostrarCliente ? cli : ''].filter(Boolean).join(' · ');
    return `<div class="li click" data-act="editar-peca" data-id="${p.id}"><span class="chip ${fmCls(p)}" style="min-width:34px;justify-content:center">${ic(f.icone)}</span><div class="li-t"><b>${esc(p.titulo || '(sem título)')}</b><span>${esc(meta)}</span></div><span class="chip cor-${e.cor}">${esc(e.nome)}</span></div>`;
  };
  return `<div class="funil-lista"><div class="card-h" style="margin-bottom:6px"><div><h3 style="font:700 16px var(--ui)">${esc(nome)} · ${itens.length}</h3><p class="sub" style="margin:2px 0 0">Clique em uma tarefa para abrir.</p></div><button type="button" class="btn ghost sm" data-act="limpar-filtros">Limpar filtros</button></div><div class="list">${itens.map(linha).join('') || '<p class="lbl">Nenhuma tarefa com este filtro.</p>'}</div></div>`;
}

const PLANO = { '': 'Não enviado ao cliente', aprovacao: 'Aguardando aprovação do cliente', ajustes: 'Alteração pedida pelo cliente', aprovado: 'Aprovado pelo cliente' };
const PLANO_CHIP = { aprovacao: ['info', 'Plano enviado'], ajustes: ['warn', 'Plano: ajuste'], aprovado: ['ok', 'Plano aprovado'] };
const PUBLICADAS_VISIVEIS = 10;

// O que fazer em cada etapa: [etapa de destino, texto do botão, estilo].
const PROXIMOS = {
  briefing: [['criacao', 'Iniciar criação']],
  criacao: [['aprovacao', 'Enviar para aprovação']],
  aprovacao: [['aprovado', 'Cliente aprovou', 'verde'], ['ajustes', 'Pediu ajuste', 'sec']],
  ajustes: [['aprovacao', 'Reenviar para aprovação']],
  aprovado: [['publicado', 'Marcar como publicado']],
  publicado: [],
};

const clientesDeTrabalho = () => store.todos('cliente')
  .filter((c) => c.status !== 'inativo')
  .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));

// A ficha da tarefa (painel lateral, salva sozinha, com comentários) fica em js/tarefa.js.
const abrirPeca = (p = null, padrao = {}) => abrirTarefa(p, padrao);

// "Adicionar em lote": um só botão no topo que abre a escolha entre as três formas de trazer várias tarefas de uma vez.
// (Para criar uma tarefa só, usa-se "Nova tarefa".)
function escolherAdicionar(clienteId = '') {
  const opcoes = [
    ['planejamento', 'edit', 'Colar planejamento', 'Cole a tabela de ideias do mês (a que o Claude entrega). Cada linha vira uma ideia na coluna Planejamento.'],
    ['pasta', 'download', 'Importar da pasta do Drive', 'Lê as artes e os vídeos de uma pasta do Drive pelo nome do arquivo e liga às tarefas.'],
    ['arquivo', 'file', 'Arquivo de tarefas (.json)', 'Para casos especiais, como trazer tarefas de outra ferramenta. É um arquivo preparado pelo Claude.'],
    ['asana', 'layers', 'Histórico do Asana (.json)', 'Traz o histórico de tarefas de todos os clientes do Asana, só para consulta. Fica guardado à parte e não deixa o painel lento.'],
  ];
  const m = abrirModal({
    titulo: 'Adicionar em lote',
    subtitulo: 'Para trazer várias tarefas de uma vez. De onde elas vêm? O painel mostra o que vai criar e pede confirmação antes. Nada do que já existe é apagado.',
    corpo: `<div class="opcoes-add">${opcoes.map(([id, icone, t, d]) => `<button type="button" class="opcao-add" data-opcao="${id}"><span class="opcao-ic">${ic(icone)}</span><span><b>${esc(t)}</b><small>${esc(d)}</small></span></button>`).join('')}</div>`,
  });
  m.el.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-opcao]');
    if (!b) return;
    m.fechar();
    const o = b.dataset.opcao;
    if (o === 'planejamento') colarPlanejamento(clienteId);
    else if (o === 'pasta') importarDaPasta();
    else if (o === 'asana') document.querySelector('[data-asana]')?.click();
    else document.querySelector('[data-lote]')?.click();
  });
}

// Botões do topo do cartão, iguais nas abas Status e Calendário.
function botoesCabecalho(filtro) {
  return `<div class="actions">${filtro ? `<button class="btn sec sm" data-act="ir" data-rota="previa" data-ref="${esc(filtro)}">${ic('image')}Prévia do cliente</button><button class="btn sec sm" data-act="enviar-planejamento" data-cliente="${esc(filtro)}">${ic('send')}Enviar planejamento</button><button class="btn sec sm" data-act="link-aprovacao" data-cliente="${esc(filtro)}">${ic('link')}Link de aprovação</button>` : ''}
    <button class="btn sec sm" data-act="adicionar-pecas" data-cliente="${esc(filtro)}">${ic('upload')}Adicionar em lote</button>
    ${botaoFiltros()}
    <button class="btn pri sm" data-act="nova-peca" data-cliente="${esc(filtro)}">${ic('plus')}Nova tarefa</button>
    <input type="file" accept="application/json,.json" hidden data-lote><input type="file" accept="application/json,.json" hidden data-asana></div>`;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// O tipo da tarefa (reels, carrossel, estático, story) já aparece pela cor e pelo ícone, então o título não precisa repeti-lo.
const PALAVRA_DO_TIPO = { reels: /^reels?$/i, carrossel: /^(carrossel|carross[eé]is)$/i, story: /^(story|stories)$/i, feed: /^(feed|est[aá]ticos?)$/i };
function semTipoNoTitulo(titulo, formato) {
  const m = titulo.match(/^\s*(reels?|carrossel|carross[eé]is|stories|story|feed|est[aá]ticos?)\s*(?:([:\-–])\s*|((?:de|do|da)\s+))?/i);
  if (!m) return titulo;
  const resto = titulo.slice(m[0].length).trim();
  const temSeparador = !!m[2];
  const mesmoTipo = !!PALAVRA_DO_TIPO[formato]?.test(m[1]);
  if (!resto || !(temSeparador || mesmoTipo)) return titulo;
  return resto[0].toUpperCase() + resto.slice(1);
}

// "Adicionar em lote": lê um arquivo de tarefas (preparado pelo Claude) e cria as que ainda não existem.
// O arquivo pode trazer o cliente pelo nome ("clienteNome": "TRE Clinic") ou pelo código. Aceita
// { "pecas": [ ... ] } ou o formato de backup { "registros": [ { "kind": "conteudo", ... } ] }.
// Só entram campos de tarefa conhecidos, e o que já existe só tem campos vazios preenchidos (nada que vocês editaram é apagado).
const palavrasDe = (t) => new Set(norm(t).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
const palavrasEmComum = (a, b) => { const B = palavrasDe(b); return [...palavrasDe(a)].filter((w) => B.has(w)).length; };

async function adicionarEmLote(arquivo, detalhe = '') {
  const brutas = [
    ...(Array.isArray(arquivo?.registros) ? arquivo.registros.filter((r) => r?.kind === 'conteudo' && r.data).map((r) => ({ ...r.data, id: r.id || r.data.id })) : []),
    ...(Array.isArray(arquivo?.pecas) ? arquivo.pecas : []),
  ].filter((p) => p && typeof p === 'object');
  if (!brutas.length) throw new Error('Este arquivo não tem tarefas para adicionar.');

  const clientes = store.todos('cliente');
  const achar = (p) => {
    const porId = store.obter('cliente', p.clienteId);
    if (porId) return porId;
    const nome = norm(p.clienteNome || '');
    const iguais = nome ? clientes.filter((c) => norm(c.nome) === nome) : [];
    return iguais.length === 1 ? iguais[0] : null;
  };
  const existentes = store.todos('conteudo');
  const usados = new Set();
  // Liga a tarefa do arquivo a uma tarefa que já existe: mesma data e formato, ou mesmo título.
  // Assim o planejamento (ideia e roteiro) e a versão completa (arquivos e legenda) viram uma tarefa só.
  const acharExistente = (clienteId, titulo, publicar, formato) => {
    const livres = existentes.filter((x) => x.clienteId === clienteId && !usados.has(x.id));
    const mesmaData = publicar ? livres.filter((x) => x.publicar === publicar && x.formato === formato) : [];
    if (mesmaData.length === 1) return mesmaData[0];
    if (mesmaData.length > 1) {
      // Vários no mesmo dia e formato: escolhe o de título mais parecido (palavras em comum), se houver um claramente melhor.
      const pont = mesmaData.map((x) => [x, palavrasEmComum(x.titulo, titulo)]).sort((m, n) => n[1] - m[1]);
      if (pont[0][1] > 0 && pont[0][1] > pont[1][1]) return pont[0][0];
    }
    const t = norm(titulo);
    return mesmaData.find((x) => norm(x.titulo) === t) || livres.find((x) => norm(x.titulo) === t && (!publicar || !x.publicar || x.publicar === publicar)) || null;
  };
  const semCliente = new Set();
  const validas = [];
  for (const p of brutas) {
    const c = achar(p);
    if (!c) { semCliente.add(String(p.clienteNome || p.clienteId || '(sem cliente)')); continue; }
    const publicar = DATA_ISO.test(p.publicar || '') ? p.publicar : '';
    const formato = formatoDe(p.formato) || 'feed';
    const titulo = semTipoNoTitulo(String(p.titulo || '').trim(), formato) || '(sem título)';
    const etapaIn = p.etapa === 'planejamento' ? 'briefing' : p.etapa;
    const etapaExplicita = ETAPAS.some((e) => e.id === etapaIn);
    const existente = p.id && store.obter('conteudo', String(p.id)) ? store.obter('conteudo', String(p.id)) : (p.id ? null : acharExistente(c.id, titulo, publicar, formato));
    const id = String(p.id || existente?.id || `lote-${c.id}-${publicar || 'sem-data'}-${slug(titulo)}`);
    if (existente) usados.add(existente.id);
    validas.push({
      id,
      clienteId: c.id,
      titulo,
      formato,
      etapa: etapaExplicita ? etapaIn : 'criacao',
      publicar,
      roteiro: String(p.roteiro || ''),
      funil: ['topo', 'meio', 'fundo'].includes(p.funil) ? p.funil : '',
      rede: redeDe(p.rede),
      planejamento: ['aprovacao', 'ajustes', 'aprovado'].includes(p.planejamento) ? p.planejamento : '',
      ajustePlano: String(p.ajustePlano || ''),
      legenda: String(p.legenda || ''),
      midias: (Array.isArray(p.midias) ? p.midias : []).map((m) => ({ tipo: m?.tipo === 'video' ? 'video' : 'imagem', id: idDrive(m?.id || m?.url) })).filter((m) => m.id),
      capa: idDrive(p.capa),
      ajuste: String(p.ajuste || ''),
      ...(p.concluida === true || p.concluida === 'sim' ? { concluida: true, concluidaEm: String(p.concluidaEm || new Date().toISOString()) } : {}),
      briefing: String(p.observacoes || p.briefing || ''), // "observacoes" é o nome novo; "briefing" continua valendo (backups e dados antigos)
      responsavel: RESPONSAVEIS.includes(p.responsavel) ? p.responsavel : '',
      link: urlSegura(p.link),
      criadoEm: new Date().toISOString(),
      _etapaExplicita: etapaExplicita,
    });
  }
  if (!validas.length) throw new Error(`Nenhuma tarefa tem cliente cadastrado no painel (${[...semCliente].join(', ')}). Confira o nome do cliente no arquivo.`);

  const novas = validas.filter((r) => !store.obter('conteudo', r.id)).length;
  const jaExistem = validas.length - novas;
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const aviso = [
    `Adicionar ${plural(novas, 'tarefa nova', 'tarefas novas')}?`,
    jaExistem ? `${plural(jaExistem, 'já existe', 'já existem')} (mesma data e formato, ou mesmo título): só os campos vazios serão completados, sem apagar o que vocês editaram.` : '',
    semCliente.size ? `Ignoradas por cliente não encontrado: ${[...semCliente].join(', ')}.` : '',
    detalhe,
  ].filter(Boolean).join(' ');
  if (!(await confirmar(aviso, 'Adicionar'))) return;
  // Tarefa que estava só no Planejamento e agora chegou com arquivos sai do Planejamento sozinha.
  const rank = (e) => ETAPAS.findIndex((x) => x.id === e);
  const avancos = validas.map((d) => {
    const antes = store.obter('conteudo', d.id);
    const alvo = d._etapaExplicita ? d.etapa : (d.midias.length ? 'criacao' : antes?.etapa);
    return antes && antes.etapa === 'briefing' && d.midias.length && alvo && rank(alvo) > rank('briefing') ? { id: d.id, etapa: alvo } : null;
  }).filter(Boolean);
  await store.importar({ registros: validas.map(({ _etapaExplicita, ...d }) => ({ kind: 'conteudo', id: d.id, data: d, mesclar: 'preencher' })) });
  for (const a of avancos) await store.salvar('conteudo', { ...store.obter('conteudo', a.id), etapa: a.etapa });
  toast(novas ? `${plural(novas, 'tarefa adicionada', 'tarefas adicionadas')}` : (jaExistem ? 'Tarefas completadas' : 'Nada novo para adicionar'));
}

// "Importar da pasta": o usuário cola o link da pasta do cliente (ou do mês) no Drive; o painel lê os arquivos com o
// nome padrão e passa as tarefas pelo mesmo caminho do "Adicionar em lote" (que pede confirmação e não apaga nada).
function importarDaPasta() {
  formulario({
    titulo: 'Importar da pasta do Drive',
    subtitulo: 'O painel lê os arquivos da pasta pelo nome padrão (data_formato_titulo) e cria ou completa as tarefas.',
    salvarTexto: 'Ler pasta',
    campos: [
      { nome: 'pasta', rotulo: 'Link da pasta no Drive', obrigatorio: true, cheio: true, placeholder: 'https://drive.google.com/drive/folders/…', ajuda: 'Use a pasta do cliente (ex.: Aprovação / TRE Clinic) ou a de um mês (ex.: 2026-10). Subpastas entram junto. Arquivos fora do padrão de nome são ignorados.' },
    ],
    aoSalvar: async (v) => {
      let r;
      try {
        r = await lerPasta(v.pasta, { chave: config.driveKey, clientes: store.todos('cliente').map((c) => c.nome) });
      } catch (err) { toast(err.message || 'Não consegui ler a pasta.', true); return false; }
      if (!r.pecas.length) { toast(`Nenhum arquivo com o nome padrão nessa pasta.${r.ignorados.length ? ` ${r.ignorados.length} fora do padrão.` : ''}`, true); return false; }
      if (r.ignorados.length) toast(`${r.ignorados.length} ${r.ignorados.length === 1 ? 'arquivo fora do padrão foi ignorado' : 'arquivos fora do padrão foram ignorados'}.`);
      try { await adicionarEmLote({ pecas: r.pecas }); } catch (err) { toast(err.message || 'Não foi possível adicionar.', true); return false; }
    },
  });
}

// "Colar planejamento": cola a tabela do planejamento (do chat do Claude ou de uma planilha) e cria as ideias na etapa
// Planejamento, pelo mesmo caminho do lote (pede confirmação, completa só o que está vazio e não apaga nada).
function colarPlanejamento(clienteId = '') {
  const clientes = clientesDeTrabalho();
  formulario({
    titulo: 'Colar planejamento',
    subtitulo: 'Cole a tabela do planejamento (Data, Formato, Funil, Título, Ideia e roteiro, Legenda). Cada linha vira uma ideia na coluna Planejamento.',
    largo: true,
    salvarTexto: 'Adicionar ao planejamento',
    valores: { clienteId: store.obter('cliente', clienteId) ? clienteId : '' },
    campos: [
      { nome: 'clienteId', rotulo: 'Cliente', tipo: 'select', cheio: true, opcoes: [{ v: '', t: 'Automático (pela linha “Cliente: …” da tabela colada)' }, ...clientes.map((c) => ({ v: c.id, t: c.nome || '(sem nome)' }))] },
      { nome: 'tabela', rotulo: 'Tabela do planejamento', tipo: 'area', obrigatorio: true, cheio: true, linhas: 10, placeholder: 'Cliente: TRE Clinic\n\nData | Formato | Funil | Título | Ideia e roteiro | Legenda\n11/10 | Reels | Topo | Tipos de cicatrização | Gancho: nem toda cicatriz é igual…', ajuda: 'Copie tudo que o Claude entregou (com a linha “Cliente: …”) e cole aqui: o cliente é reconhecido sozinho. Sem data completa (ex.: 11/10), vale o ano atual. A legenda pode ficar em branco; ela entra na etapa seguinte.' },
    ],
    aoSalvar: async (v) => {
      // Cliente: o escolhido na lista ou, se ficou em "Automático", o da linha "Cliente: Nome" colada junto da tabela.
      let c = store.obter('cliente', v.clienteId);
      if (!c) {
        const nomeColado = String(v.tabela || '').match(/^\s*\**cliente\**\s*[:\-]\s*\**\s*(.+?)\s*\**\s*$/im)?.[1] || '';
        const iguais = nomeColado ? store.todos('cliente').filter((x) => norm(x.nome) === norm(nomeColado)) : [];
        c = iguais.length === 1 ? iguais[0] : null;
        if (!c) { toast(nomeColado ? `Não encontrei o cliente “${nomeColado}” no painel. Escolha o cliente na lista.` : 'Escolha o cliente na lista ou cole a tabela com a linha “Cliente: Nome” em cima.', true); return false; }
      }
      const r = lerTabela(v.tabela, { clienteNome: c.nome || '' });
      if (!r.pecas.length) { toast('Não encontrei nenhuma linha com título na tabela colada.', true); return false; }
      if (r.ignoradas.length) toast(`${r.ignoradas.length} ${r.ignoradas.length === 1 ? 'linha sem título foi ignorada' : 'linhas sem título foram ignoradas'}.`);
      const lidas = r.pecas.map((p) => `${p.publicar ? dataBR(p.publicar).slice(0, 5) : 'sem data'} ${FORMATOS[p.formato].nome}${p.funil ? ` (${p.funil})` : ''}: ${p.titulo}`).join('; ');
      try { await adicionarEmLote({ pecas: r.pecas }, `Cliente: ${c.nome}. Ideias lidas: ${lidas}.`); } catch (err) { toast(err.message || 'Não foi possível adicionar.', true); return false; }
    },
  });
}

// O que ainda falta na tarefa: mostra o que precisa ser completado depois do planejamento.
// Ideia que ainda está no Planejamento e já foi enviada ao cliente (aguardando, com alteração ou aprovada).
const enviadaNoPlano = (p) => p.etapa === 'briefing' && !!p.planejamento;

function faltas(p) {
  const chips = [];
  if (p.roteiro) chips.push('<span class="chip mute">Roteiro</span>');
  if (PLANO_CHIP[p.planejamento]) chips.push(`<span class="chip ${PLANO_CHIP[p.planejamento][0]}">${PLANO_CHIP[p.planejamento][1]}</span>`);
  if (!(p.midias || []).length) chips.push('<span class="chip mute">Sem arte</span>');
  if (!String(p.legenda || '').trim()) chips.push('<span class="chip mute">Sem legenda</span>');
  return chips.length ? `<div class="actions" style="gap:5px">${chips.join('')}</div>` : '';
}

// Arrastar e soltar (computador): cartão entre as colunas muda a etapa; tarefa entre os dias do calendário muda a data.
// No celular continuam valendo os botões de cada cartão.
function ligarArrastar(el) {
  let arrastando = null;
  const limpar = () => el.querySelectorAll('.arrastando, .alvo').forEach((x) => x.classList.remove('arrastando', 'alvo'));
  el.addEventListener('dragstart', (ev) => {
    const c = ev.target.closest?.('[data-peca]');
    if (!c) return;
    arrastando = c.dataset.peca;
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', arrastando);
    setTimeout(() => c.classList.add('arrastando'), 0);
  });
  el.addEventListener('dragend', () => { arrastando = null; limpar(); });
  el.addEventListener('dragover', (ev) => {
    if (!arrastando) return;
    // Perto da borda do quadro, rola para o lado para alcançar as outras colunas.
    const quadro = ev.target.closest?.('.kanban');
    if (quadro) {
      const r = quadro.getBoundingClientRect();
      if (ev.clientX < r.left + 80) quadro.scrollLeft -= 28;
      else if (ev.clientX > r.right - 80) quadro.scrollLeft += 28;
    }
    const alvo = ev.target.closest?.('.kol[data-etapa], .dia[data-dia]');
    if (!alvo) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    if (!alvo.classList.contains('alvo')) { el.querySelectorAll('.alvo').forEach((x) => x.classList.remove('alvo')); alvo.classList.add('alvo'); }
  });
  el.addEventListener('dragleave', (ev) => {
    const alvo = ev.target.closest?.('.kol[data-etapa], .dia[data-dia]');
    if (alvo && !alvo.contains(ev.relatedTarget)) alvo.classList.remove('alvo');
  });
  el.addEventListener('drop', async (ev) => {
    const id = arrastando || ev.dataTransfer.getData('text/plain');
    const alvo = ev.target.closest?.('.kol[data-etapa], .dia[data-dia]');
    limpar();
    arrastando = null;
    const p = id && store.obter('conteudo', id);
    if (!alvo || !p) return;
    ev.preventDefault();
    try {
      if (alvo.dataset.etapa) {
        const etapa = alvo.dataset.etapa;
        if (p.etapa === etapa) return;
        // Ao mandar para Ajustes, abre a tarefa para já anotar o que o cliente pediu.
        if (etapa === 'ajustes') { abrirPeca(p, { etapa: 'ajustes' }); return; }
        await store.salvar('conteudo', { ...p, etapa, ...(etapa === 'publicado' && !p.concluida ? { concluida: true, concluidaEm: new Date().toISOString() } : {}) });
        toast(`Movida para ${etapaDe({ etapa }).nome}`);
      } else {
        const dia = alvo.dataset.dia;
        if (p.publicar === dia) return;
        await store.salvar('conteudo', { ...p, publicar: dia });
        toast(`Publicação marcada para ${dataBR(dia).slice(0, 5)}`);
      }
    } catch (err) { toast(err?.message || 'Não foi possível mover.', true); }
  });
}

// Botão de concluir, como no Asana: um círculo que vira verde com o visto. No calendário o bloco já é um <button>,
// e botão dentro de botão não vale em HTML, então lá o círculo é um <span> com papel de caixa de seleção.
function botaoConcluir(p, noCalendario = false) {
  const on = !!p.concluida;
  const rotulo = on ? 'Marcar como em aberto' : 'Marcar como concluída';
  const comum = `class="chk${on ? ' on' : ''}" data-act="concluir-peca" data-id="${p.id}" title="${rotulo}" aria-label="${rotulo}: ${esc(p.titulo || 'tarefa')}"`;
  return noCalendario
    ? `<span ${comum} role="checkbox" tabindex="0" aria-checked="${on}">${ic('check')}</span>`
    : `<button type="button" ${comum} aria-pressed="${on}">${ic('check')}</button>`;
}

function cartao(p, mostrarCliente) {
  const f = FORMATOS[p.formato] || FORMATOS.feed;
  const cli = store.obter('cliente', p.clienteId);
  const meta = [mostrarCliente ? (cli?.nome || 'Cliente removido') : '', p.publicar ? dataBR(p.publicar).slice(0, 5) : 'Sem data', p.responsavel].filter(Boolean).join(' · ');
  const atras = atrasada(p);
  const botoes = (PROXIMOS[p.etapa] || []).map(([para, texto, estilo]) => `<button class="btn ${estilo || 'sec'} sm" data-act="mover-peca" data-id="${p.id}" data-para="${para}">${esc(texto)}</button>`).join('');
  return `<div class="peca${enviadaNoPlano(p) ? ' enviado' : ''}${p.concluida ? ' feita' : ''}" draggable="true" data-peca="${p.id}">
    <div class="actions" style="gap:6px">${botaoConcluir(p)}<span class="chip ${fmCls(p)}">${ic(f.icone)}${esc(f.nome)}</span>${redeChip(p)}${funilChip(p)}${atras ? '<span class="chip warn">Atrasada</span>' : ''}${p.link && urlSegura(p.link) ? `<a class="chip mute" href="${esc(urlSegura(p.link))}" target="_blank" rel="noopener noreferrer" title="Abrir a arte">${ic('file')}Arte</a>` : ''}</div>
    <button class="peca-t" data-act="editar-peca" data-id="${p.id}">${esc(p.titulo || '(sem título)')}</button>
    <div class="peca-m">${esc(meta)}</div>
    ${faltas(p)}
    ${p.etapa === 'ajustes' && p.ajuste ? `<div class="peca-aj">${esc(p.ajuste)}</div>` : ''}
    ${p.planejamento === 'ajustes' && p.ajustePlano ? `<div class="peca-aj"><b>Plano:</b> ${esc(p.ajustePlano)}</div>` : ''}
    ${botoes ? `<div class="peca-a">${botoes}</div>` : ''}
  </div>`;
}

// Visão escolhida (Status ou Calendário) e mês mostrado no calendário; valem até recarregar a página.
let aba = 'status';
let feedFiltro = 'tudo'; // filtro da grade do Feed
let feedAba = 'grade'; // 'grade' ou 'reels'
let mesCal = null;
const recarregarTela = () => window.dispatchEvent(new Event('atualizar-tela'));
const perfilPedido = new Set(); // clientes cujo perfil do Instagram já foi pedido nesta abertura do painel
let verInativos = false; // Ativos ou Inativos na lista de clientes

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const isoDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Inicial de quem cuida da tarefa (no lugar do ponto de etapa e do ícone do formato). Sem responsável, um círculo vazio.
const inicialResp = (p) => `<i class="cal-ini${p.responsavel ? '' : ' vazio'}" title="${esc(p.responsavel ? `Responsável: ${p.responsavel}` : 'Sem responsável')}" aria-hidden="true">${p.responsavel ? esc(String(p.responsavel).trim().charAt(0).toUpperCase()) : ''}</i>`;

function blocoPeca(p, mostrarCliente) {
  const f = FORMATOS[p.formato] || FORMATOS.feed;
  const e = etapaDe(p);
  const cli = store.obter('cliente', p.clienteId)?.nome || '';
  return `<button class="cal-p ${fmCls(p)}${atrasada(p) ? ' atras' : ''}${p.concluida ? ' feita' : ''}${casaFunil(p) && casaTipo(p) && casaRede(p) ? '' : ' apagado'}" data-act="editar-peca" data-id="${p.id}" draggable="true" data-peca="${p.id}" title="${esc([p.titulo, cli, f.nome, REDES[p.rede]?.nome, e.nome, p.concluida ? 'Concluída' : ''].filter(Boolean).join(' · '))}">
    ${botaoConcluir(p, true)}${inicialResp(p)}<span><b>${esc(p.titulo || '(sem título)')}</b>${mostrarCliente && cli ? `<small>${esc(cli)}</small>` : ''}</span></button>`;
}

// Escolha do mês, igual no Status e no Calendário (o mês escolhido vale nas duas abas).
function seletorMes(ym) {
  const [a, m] = ym.split('-').map(Number);
  const nome = mesNome(m - 1);
  return `<div class="toolbar" style="margin-bottom:12px">
      <div class="mes"><button class="iconbtn" data-act="cal-mes" data-passo="-1" aria-label="Mês anterior"><span style="display:grid;transform:scaleX(-1)">${ic('chev')}</span></button>
        <b>${nome[0].toUpperCase()}${nome.slice(1)} de ${a}</b><button class="iconbtn" data-act="cal-mes" data-passo="1" aria-label="Próximo mês">${ic('chev')}</button>
        ${ym !== hojeISO().slice(0, 7) ? '<button class="btn ghost sm" data-act="cal-mes" data-passo="0">Mês atual</button>' : ''}</div>
    </div>`;
}

function calendario({ filtro, lista, chipsClientes }) {
  const hoje = hojeISO();
  const ym = mesCal || hoje.slice(0, 7);
  const [a, m] = ym.split('-').map(Number);
  const nomeMes = mesNome(m - 1);
  const primeiroDia = new Date(a, m - 1, 1).getDay();
  const semanas = Math.ceil((primeiroDia + new Date(a, m, 0).getDate()) / 7);
  const porDia = {};
  lista.forEach((p) => { if (p.publicar) (porDia[p.publicar.slice(0, 10)] ||= []).push(p); });
  const semData = lista.filter((p) => !p.publicar && p.etapa !== 'publicado');
  // Contadores, filtros de Tipo e Funil e a lista abaixo do calendário valem só para o mês mostrado.
  const listaMes = lista.filter((p) => !!p.publicar && p.publicar.slice(0, 7) === ym);

  const celulas = Array.from({ length: semanas * 7 }, (_, i) => {
    const d = new Date(a, m - 1, 1 - primeiroDia + i);
    const iso = isoDia(d);
    const pecasDia = porDia[iso] || [];
    return `<div class="dia${d.getMonth() !== m - 1 ? ' fora' : ''}${iso === hoje ? ' hoje' : ''}" data-dia="${iso}">
      <div class="dia-h"><b>${d.getDate()}</b><span class="dia-sem">${DIAS_SEMANA[d.getDay()]}</span><button class="dia-add" data-act="nova-peca" data-data="${iso}" data-cliente="${esc(filtro)}" aria-label="Nova tarefa em ${dataBR(iso)}" title="Nova tarefa neste dia">+</button></div>
      ${pecasDia.map((p) => blocoPeca(p, !filtro)).join('')}</div>`;
  }).join('');

  return `<div class="card">
    <div class="card-h"><div><h2>${filtro ? esc(store.obter('cliente', filtro).nome) : 'Todos os clientes'}</h2><p class="sub">${listaMes.length} ${listaMes.length === 1 ? 'tarefa' : 'tarefas'} em ${nomeMes}.</p></div>
      ${botoesCabecalho(filtro)}</div>
    ${seletorMes(ym)}
    <div class="calbox"><div class="calgrid">${DIAS_SEMANA.map((d) => `<div class="dow">${d}</div>`).join('')}${celulas}</div></div>
    ${listaFunil(listaMes, !filtro)}
    ${semData.length ? `<div class="semdata"><h3>Sem data de publicação</h3><p class="lbl">Abra a tarefa e escolha a data para ela aparecer no calendário.</p><div class="semdata-l">${semData.map((p) => blocoPeca(p, !filtro)).join('')}</div></div>` : ''}
  </div>`;
}

function ordenarPecas(lista, recentesPrimeiro = false) {
  const dir = recentesPrimeiro ? -1 : 1;
  return [...lista].sort((a, b) => {
    if (!a.publicar && !b.publicar) return 0;
    if (!a.publicar) return 1;
    if (!b.publicar) return -1;
    return dir * a.publicar.localeCompare(b.publicar);
  });
}

export default {
  titulo: () => 'Conteúdo',
  sub: () => 'O que está sendo criado para cada cliente e em que etapa está cada tarefa.',

  render({ ref }) {
    const ativos = clientesDeTrabalho();
    const inativos = store.todos('cliente').filter((c) => c.status === 'inativo').sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
    if (!ativos.length && !inativos.length) {
      return `<div class="card empty">${flor()}<h2>Cadastre um cliente primeiro</h2><p>As tarefas de conteúdo ficam ligadas a um cliente. Cadastre o cliente e volte aqui.</p><button class="btn pri" data-act="ir" data-rota="clientes">Ir para Clientes</button></div>`;
    }
    const refCli = store.obter('cliente', ref);
    if (refCli) verInativos = refCli.status === 'inativo';
    const clientes = verInativos ? inativos : ativos;
    const filtro = refCli && (refCli.status === 'inativo') === verInativos ? ref : '';
    const seg = `<div class="seg" role="group" aria-label="Clientes ativos ou inativos"><button type="button" class="seg-b ${verInativos ? '' : 'on'}" data-act="ver-clientes" data-v="ativos" aria-pressed="${!verInativos}">Ativos · ${ativos.length}</button><button type="button" class="seg-b ${verInativos ? 'on' : ''}" data-act="ver-clientes" data-v="inativos" aria-pressed="${verInativos}">Inativos · ${inativos.length}</button></div>`;
    if (verInativos) {
      const chipsIn = inativos.map((c) => `<button class="cbtn ex ${c.id === filtro ? 'on' : ''}" data-act="ir" data-rota="conteudo" data-ref="${c.id}"><i></i>${esc(c.nome || '(sem nome)')}</button>`).join('');
      const corpoIn = filtro ? histCartao(store.obter('cliente', filtro), recarregarTela) : `<div class="card empty">${flor()}<h2>Escolha um cliente inativo</h2><p>Aqui ficam os clientes que já saíram, com todo o histórico de tarefas que vinha do Asana. Toque no nome do cliente acima.</p></div>`;
      return `${seg}<div class="cbtns" style="margin-bottom:16px">${chipsIn}</div>${corpoIn}`;
    }
    const todasBase = pecas();
    const todas = todasBase.filter(casaPessoa);
    const lista = filtro ? todas.filter((p) => p.clienteId === filtro) : todas;
    // Mês escolhido (vale no Status e no Calendário). Status e números mostram esse mês, mais as tarefas sem data (para não sumirem).
    const ym = mesCal || hojeISO().slice(0, 7);
    const listaV = lista.filter((p) => !p.publicar || p.publicar.slice(0, 7) === ym);
    const em = (...ids) => listaV.filter((p) => ids.includes(p.etapa));

    // O número de cada cliente conta só as tarefas do mês mostrado.
    const ymChips = ym;
    const doMesChips = todas.filter((p) => !!p.publicar && p.publicar.slice(0, 7) === ymChips);
    const dicaMes = `Tarefas com publicação em ${mesNome(Number(ymChips.slice(5, 7)) - 1)}`;
    const chipsClientes = [`<button class="cbtn ${filtro ? '' : 'on'}" data-act="ir" data-rota="conteudo" title="${esc(dicaMes)}">Todos · ${doMesChips.length}</button>`,
      ...clientes.map((c) => `<button class="cbtn ${c.id === filtro ? 'on' : ''}" data-act="ir" data-rota="conteudo" data-ref="${c.id}" title="${esc(dicaMes)}"><i></i>${esc(c.nome || '(sem nome)')} · ${doMesChips.filter((p) => p.clienteId === c.id).length}</button>`)].join('');

    const abas = `<div class="tabs" role="tablist" aria-label="Visões de conteúdo">
      <button class="tab ${aba === 'status' ? 'on' : ''}" role="tab" aria-selected="${aba === 'status'}" data-act="aba-conteudo" data-aba="status">${ic('grid')}Status</button>
      <button class="tab ${aba === 'calendario' ? 'on' : ''}" role="tab" aria-selected="${aba === 'calendario'}" data-act="aba-conteudo" data-aba="calendario">${ic('calendar')}Calendário</button>
      <button class="tab ${aba === 'feed' ? 'on' : ''}" role="tab" aria-selected="${aba === 'feed'}" data-act="aba-conteudo" data-aba="feed">${ic('image')}Feed</button></div>`;
    // Cabeça igual nas duas abas, nesta ordem: clientes, números e, logo acima do conteúdo, as abas Status e Calendário.
    const numeros = `<div class="grid" style="margin-bottom:16px">
        <div class="card stat tone-verde"><div><div class="lbl">Em produção</div><div class="big num">${em('briefing', 'criacao').length}</div><div class="hint">Planejamento e criação</div></div><span class="stat-ic">${ic('grid')}</span></div>
        <div class="card stat tone-creme"><div><div class="lbl">Aguardando aprovação</div><div class="big num">${em('aprovacao').length}</div><div class="hint">Com o cliente</div></div><span class="stat-ic">${ic('send')}</span></div>
        <div class="card stat tone-coral"><div><div class="lbl">Pedidos de ajuste</div><div class="big num">${em('ajustes').length}</div><div class="hint">Para refazer</div></div><span class="stat-ic">${ic('edit')}</span></div>
        <div class="card stat tone-coral"><div><div class="lbl">Atrasadas</div><div class="big num">${lista.filter(atrasada).length}</div><div class="hint">Passaram da data, em todos os meses</div></div><span class="stat-ic">${ic('calendar')}</span></div>
      </div>`;
    // Números do painel Filtros: tarefas do mês mostrado (do cliente escolhido), antes de aplicar o responsável.
    const baseMes = (filtro ? todasBase.filter((p) => p.clienteId === filtro) : todasBase).filter((p) => !!p.publicar && p.publicar.slice(0, 7) === ymChips);
    baseFiltros = baseMes;
    const cabeca = `${seg}<div class="cbtns" style="margin-bottom:16px">${chipsClientes}</div>${numeros}${abas}`;
    if (aba === 'calendario') return cabeca + calendario({ filtro, lista });
    if (aba === 'feed') {
      const cabecaFeed = `${cabeca}<div class="actions barra-filtros">${botaoFiltros()}</div>`;
      if (!filtro) return `${cabecaFeed}<div class="card empty">${flor()}<h2>Escolha um cliente</h2><p>O feed mostra o perfil de um cliente por vez, como ele fica no Instagram. Toque no nome do cliente acima.</p></div>`;
      const cli = store.obter('cliente', filtro);
      const ultimo = store.todos('insights').filter((i) => i.clienteId === filtro && Number.isFinite(Number(i.seguidores))).sort((a, b) => String(b.mes).localeCompare(String(a.mes)))[0];
      // Perfil real do Instagram, quando o cliente está conectado: busca uma vez e redesenha quando chegar.
      const conectado = igApi.disponivel() && !!igApi.conexao(filtro);
      if (conectado && !igApi.perfilGuardado(filtro) && !perfilPedido.has(filtro)) {
        perfilPedido.add(filtro);
        igApi.perfil(filtro).then(recarregarTela);
      }
      return cabecaFeed + feedPerfil({ cliente: cli, pecas: lista, seguidores: ultimo?.seguidores, filtro: feedFiltro, aba: feedAba, real: conectado ? igApi.perfilGuardado(filtro) : null, conectado });
    }

    const colunas = ETAPAS.map((e) => {
      let itens = e.id === 'publicado' ? ordenarPecas(em(e.id), true) : ordenarPecas(em(e.id));
      const total = itens.length;
      if (e.id === 'publicado') itens = itens.slice(0, PUBLICADAS_VISIVEIS);
      return `<section class="kol" data-etapa="${e.id}" aria-label="${esc(e.nome)}">
        <div class="kol-h"><span>${esc(e.nome)}</span><b class="chip ${e.chip}">${total}</b></div>
        ${e.id === 'briefing' ? `<div class="kol-legenda"><div class="kol-dica"><i></i>Já enviado ao cliente<b class="kol-n">${itens.filter(enviadaNoPlano).length}</b></div><div class="kol-dica"><i class="claro"></i>Ainda não enviado<b class="kol-n">${itens.filter((x) => !enviadaNoPlano(x)).length}</b></div></div>` : ''}
        ${itens.map((p) => cartao(p, !filtro)).join('') || '<div class="kol-vazio">Nada aqui</div>'}
        ${total > itens.length ? `<div class="kol-vazio">E mais ${total - itens.length} publicadas</div>` : ''}
      </section>`;
    }).join('');

    return cabeca + `<div class="card">
        <div class="card-h"><div><h2>${filtro ? esc(store.obter('cliente', filtro).nome) : 'Todos os clientes'}</h2></div>
          ${botoesCabecalho(filtro)}</div>
        ${lista.length ? `${seletorMes(ym)}<div class="kanban">${colunas}</div>` : `<div class="empty" style="padding:30px 10px">${flor()}<h2>Nenhuma tarefa ainda</h2><p>Use “Nova tarefa” para registrar o primeiro reels, carrossel, estático ou story.</p></div>`}
      </div>`;
  },

  montar(el) {
    ligarArrastar(el);
    // As artes do Drive às vezes falham em rajada: o Feed tenta de novo algumas vezes antes de desistir.
    if (!el.dataset.feedErro) {
      el.dataset.feedErro = '1';
      el.addEventListener('error', (ev) => {
        const img = ev.target;
        if (img.tagName !== 'IMG' || !img.dataset.id || !img.closest('.fp')) return;
        const n = Number(img.dataset.tent || 0);
        if (n >= 8) return;
        img.dataset.tent = n + 1;
        setTimeout(() => { img.src = urlImagem(img.dataset.id, Number(img.dataset.w), n + 1); }, 700 * (n + 1));
      }, true);
    }
    // O círculo de concluir no calendário é um <span>: Enter ou Espaço também funcionam.
    // A tela é redesenhada sem trocar este elemento: registra o ouvinte uma vez só (senão dois se cancelam).
    if (!el.dataset.chkTeclado) {
      el.dataset.chkTeclado = '1';
      el.addEventListener('keydown', (ev) => {
        const c = ev.target.closest?.('.chk[role=checkbox]');
        if (c && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); ev.stopPropagation(); c.click(); }
      });
    }
    histMontar(el);
    el.querySelector('[data-asana]')?.addEventListener('change', async (ev) => {
      const f = ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      try { await importarHistorico(JSON.parse(await f.text())); recarregarTela(); } catch (err) { toast(err instanceof SyntaxError ? 'Este arquivo não é válido.' : (err.message || 'Não foi possível trazer o histórico.'), true); }
    });
    el.querySelector('[data-lote]')?.addEventListener('change', async (ev) => {
      const f = ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      try { await adicionarEmLote(JSON.parse(await f.text())); } catch (err) { toast(err instanceof SyntaxError ? 'Este arquivo não é válido.' : (err.message || 'Não foi possível adicionar.'), true); }
    });
  },

  acoes: {
    'enviar-planejamento': async (el) => {
      const c = store.obter('cliente', el.dataset.cliente);
      if (!c) return;
      const prontas = pecas().filter((p) => p.clienteId === c.id && p.etapa === 'briefing' && !p.planejamento);
      if (!prontas.length) { toast('Não há ideias novas no Planejamento para enviar.', true); return; }
      const sem = prontas.filter((p) => !String(p.roteiro || '').trim()).length;
      const jaEnviadas = pecas().filter((p) => p.clienteId === c.id && p.planejamento).length;
      const aviso = `Enviar ${prontas.length} ${prontas.length === 1 ? 'ideia nova' : 'ideias novas'} (as que estão no Planejamento e ainda não foram enviadas${jaEnviadas ? `; ${jaEnviadas} já foram enviadas antes` : ''}) para ${c.nome} aprovar? Elas aparecem na aba Planejamento do link de aprovação dele, com data, formato, título e o texto de “Ideia e roteiro”.${sem ? ` ${sem} ${sem === 1 ? 'não tem' : 'não têm'} roteiro escrito.` : ''}`;
      if (!(await confirmar(aviso, 'Enviar'))) return;
      for (const p of prontas) await store.salvar('conteudo', { ...p, planejamento: 'aprovacao' });
      toast(`${prontas.length} ${prontas.length === 1 ? 'ideia enviada' : 'ideias enviadas'} para aprovação`);
    },
    'abrir-filtros': () => { filtrosAberto = !filtrosAberto; recarregarTela(); },
    'fechar-filtros': () => { filtrosAberto = false; recarregarTela(); },
    'limpar-tudo': () => { filtroPessoa = ''; filtroFunil = ''; filtroTipo = ''; filtroRede = ''; recarregarTela(); },
    'filtro-tipo': (el) => { filtroTipo = el.dataset.tipo === filtroTipo ? '' : el.dataset.tipo; recarregarTela(); },
    'limpar-filtros': () => { filtroFunil = ''; filtroTipo = ''; filtroRede = ''; recarregarTela(); },
    'filtro-rede': (el) => { filtroRede = el.dataset.rede === filtroRede ? '' : el.dataset.rede; recarregarTela(); },
    'filtro-funil': (el) => { filtroFunil = el.dataset.funil === filtroFunil ? '' : el.dataset.funil; recarregarTela(); },
    'adicionar-lote': () => document.querySelector('[data-lote]')?.click(),
    'adicionar-pecas': (el) => escolherAdicionar(el.dataset.cliente),
    'importar-pasta': () => importarDaPasta(),
    'colar-planejamento': (el) => colarPlanejamento(el.dataset.cliente),
    'link-aprovacao': async (el) => {
      const c = store.obter('cliente', el.dataset.cliente);
      if (!c) return;
      const montar = (token) => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}aprovar.html#${token}`;
      let url = montar(await store.linkAprovacao(c.id));
      const m = abrirModal({
        titulo: `Link de aprovação: ${c.nome}`,
        subtitulo: 'Envie este link ao cliente. Ele vê só as tarefas dele (as que estão em “Aguardando aprovação” ou depois) e não precisa de senha.',
        corpo: `<div class="field"><label for="link-ap">Link do cliente</label><input id="link-ap" readonly value="${esc(url)}"></div>
          <p class="lbl" style="margin-top:10px">Quem tem este link consegue ver e aprovar as tarefas de ${esc(c.nome)}. Se ele for parar em mãos erradas, gere um novo: o antigo deixa de funcionar.</p>
          <div class="modal-f"><button class="btn ghost danger" data-renovar>Gerar novo link</button><div class="actions"><button class="btn sec" data-fechar-link>Fechar</button>${navigator.share ? `<button class="btn sec" data-compartilhar>${ic('send')}Compartilhar</button>` : ''}<button class="btn pri" data-copiar>${ic('link')}Copiar link</button></div></div>`,
      });
      const campo = m.el.querySelector('#link-ap');
      campo.addEventListener('focus', () => campo.select());
      m.el.querySelector('[data-fechar-link]').onclick = () => m.fechar();
      m.el.querySelector('[data-copiar]').onclick = async () => {
        try { await navigator.clipboard.writeText(campo.value); toast('Link copiado'); } catch { campo.select(); toast('Selecionei o link: use Ctrl+C para copiar'); }
      };
      const compartilhar = m.el.querySelector('[data-compartilhar]');
      if (compartilhar) compartilhar.onclick = async () => {
        try { await navigator.share({ title: `Aprovação de conteúdo: ${c.nome}`, text: 'Link para aprovar o conteúdo:', url: campo.value }); } catch { /* a pessoa fechou a janela de compartilhar */ }
      };
      m.el.querySelector('[data-renovar]').onclick = async () => {
        if (!(await confirmar('Gerar um novo link? O link atual deixa de funcionar e você precisa enviar o novo ao cliente.', 'Gerar novo link', true))) return;
        url = montar(await store.linkAprovacao(c.id, true));
        campo.value = url;
        toast('Novo link gerado');
      };
    },
    'aba-conteudo': (el) => { aba = ['calendario', 'feed'].includes(el.dataset.aba) ? el.dataset.aba : 'status'; recarregarTela(); },
    // Alterna entre clientes ativos e inativos (volta para a lista, sem cliente escolhido).
    'ver-clientes': (el) => { verInativos = el.dataset.v === 'inativos'; if (location.hash.replace(/^#\/?/, '').split('/').length > 1) location.hash = '#/conteudo'; recarregarTela(); },
    'feed-filtro': (el) => { feedFiltro = el.dataset.filtro || 'tudo'; recarregarTela(); },
    'feed-puxar': async (el) => {
      const perfil = await igApi.perfil(el.dataset.cliente, true);
      toast(perfil ? 'Perfil atualizado com o que está no Instagram.' : 'Não consegui ler o perfil. Veja se a conexão do Instagram do cliente está ativa.', !perfil);
      recarregarTela();
    },
    'feed-aba': (el) => { feedAba = el.dataset.aba === 'reels' ? 'reels' : 'grade'; recarregarTela(); },
    // Bio, link, destaques e "seguindo" do perfil simulado no Feed (ficam na ficha do cliente).
    'feed-perfil': (el) => {
      const c = store.obter('cliente', el.dataset.cliente);
      if (!c) return;
      formulario({
        titulo: `Perfil de ${c.nome}`,
        subtitulo: 'Como o perfil aparece na aba Feed. Não muda nada no Instagram do cliente; é só para a equipe ver como o feed fica.',
        salvarTexto: 'Salvar perfil',
        valores: { bio: c.bio || '', categoria: c.categoria || '', linkBio: c.linkBio || '', seguindo: c.seguindo ?? '', destaques: c.destaques || [] },
        campos: [
          { nome: 'categoria', rotulo: 'Categoria (a linha cinza abaixo do nome)', placeholder: 'Agência de mídia social' },
          { nome: 'bio', rotulo: 'Bio', tipo: 'area', cheio: true, linhas: 5, placeholder: 'Texto da bio, como está no Instagram' },
          { nome: 'linkBio', rotulo: 'Link da bio', placeholder: 'https://...' },
          { nome: 'seguindo', rotulo: 'Quantos o perfil segue', tipo: 'numero' },
          { nome: 'destaques', rotulo: 'Destaques (um por linha)', tipo: 'lista', cheio: true, ajuda: 'Os nomes dos destaques, na ordem em que aparecem.' },
        ],
        aoSalvar: async (v) => {
          try { await store.salvar('cliente', { ...c, bio: v.bio, categoria: v.categoria, linkBio: v.linkBio, seguindo: v.seguindo === '' ? null : Number(v.seguindo), destaques: v.destaques || [] }); } catch (err) { toast(err.message, true); return false; }
          toast('Perfil salvo.');
          recarregarTela();
        },
      });
    },
    'cal-mes': (el) => {
      const passo = Number(el.dataset.passo);
      if (!passo) mesCal = null;
      else {
        const [a, m] = (mesCal || hojeISO().slice(0, 7)).split('-').map(Number);
        const d = new Date(a, m - 1 + passo, 1);
        mesCal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      recarregarTela();
    },
    'filtro-pessoa': (el) => { filtroPessoa = el.dataset.v === filtroPessoa ? '' : el.dataset.v; recarregarTela(); },
    'nova-peca': (el) => abrirPeca(null, { ...(el.dataset.cliente ? { clienteId: el.dataset.cliente } : {}), ...(el.dataset.data ? { publicar: el.dataset.data } : {}) }),
    'editar-peca': (el) => abrirPeca(store.obter('conteudo', el.dataset.id)),
    'mover-peca': async (el) => {
      const p = store.obter('conteudo', el.dataset.id);
      if (!p) return;
      // Ao pedir ajuste, abre a ficha para já anotar o que o cliente pediu.
      if (el.dataset.para === 'ajustes') { abrirPeca(p, { etapa: 'ajustes' }); return; }
      await store.salvar('conteudo', { ...p, etapa: el.dataset.para, ...(el.dataset.para === 'publicado' && !p.concluida ? { concluida: true, concluidaEm: new Date().toISOString() } : {}) });
      toast(`Movida para ${etapaDe({ etapa: el.dataset.para }).nome}`);
    },
    // Concluir ou reabrir a tarefa, como no Asana. Não muda a etapa da tarefa.
    'concluir-peca': async (el) => {
      const p = store.obter('conteudo', el.dataset.id);
      if (!p) return;
      const feita = !p.concluida;
      await store.salvar('conteudo', { ...p, concluida: feita, concluidaEm: feita ? new Date().toISOString() : '' });
      toast(feita ? 'Marcada como concluída' : 'Voltou para em aberto');
    },
  },
};
