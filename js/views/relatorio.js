import { store } from '../store.js?v=145';
import { esc, toast, norm, hojeISO } from '../util.js?v=145';
import { ic, flor } from '../icons.js?v=145';
import { formulario, confirmar, abrirModal } from '../ui.js?v=145';
import { FORMATOS, pecas } from '../conteudo.js?v=145';
import { igApi } from '../instagram-api.js?v=145';
import { corpoRelatorio, painelMetricas, frasesResumo, ligarIndice, ymAnterior, ymMais, nomeMes } from '../relatorio-html.js?v=145';

// Métricas do cliente nas redes sociais (no menu: Métricas) e o relatório mensal. Começa pelo Instagram.
// Três abas: Métricas (indicadores do mês), Relatório mensal (o relatório completo, para enviar ao cliente) e Contas (conectar e atualizar o Instagram).
// Cada mês de cada cliente é um registro `insights` (id "clienteId_AAAA-MM"). Os números chegam direto do Instagram
// (botão "Atualizar do Instagram") ou por importação (arquivo ou texto em JSON, que o Claude Code monta).
// O visual do relatório fica em js/relatorio-html.js (o mesmo será usado na página do link do cliente).
const recarregarTela = () => window.dispatchEvent(new Event('atualizar-tela'));
let mes = null; // AAAA-MM mostrado; vazio = mês anterior ao atual (o último mês fechado)
let aba = 'metricas'; // 'metricas', 'relatorio' ou 'contas'

const mesPadrao = () => ymAnterior(hojeISO().slice(0, 7));
const idInsight = (clienteId, ym) => `${clienteId}_${ym}`;

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

const storiesPedidos = new Set(); // clientes cujos stories já foram pedidos ao banco nesta visita

// Conectar o Instagram do cliente (ele autoriza uma vez) e atualizar os números do mês mostrado.
function botoesInstagram(c, ym) {
  if (!igApi.disponivel()) return '';
  const ig = igApi.conexao(c.id);
  if (ig) return `<button class="btn pri sm" data-act="rel-sync" data-cliente="${esc(c.id)}" data-mes="${ym}">${ic('refresh')}Atualizar do Instagram</button>
    <button class="btn sec sm" data-act="rel-stories" data-cliente="${esc(c.id)}" title="Lê agora os stories ativos (a leitura automática faz isso de hora em hora)">${ic('play')}Ler stories agora</button>`;
  return `<button class="btn pri sm" data-act="rel-conectar" data-cliente="${esc(c.id)}">${ic('link')}Conectar Instagram</button>
    <button class="btn sec sm" data-act="rel-link-cliente" data-cliente="${esc(c.id)}" title="Copia um link para o dono do Instagram autorizar no celular">${ic('send')}Link para autorizar</button>`;
}

// Estado da leitura automática: avisa se parou ou falhou.
function avisoLeitura(c) {
  const ig = igApi.conexao(c.id);
  if (!ig) return '';
  const hora = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  if (ig.ultimoErro) return `<div class="card rl-aviso no-print"><b>A leitura automática do Instagram falhou.</b> ${esc(ig.ultimoErro)} Se pedir, conecte o Instagram deste cliente de novo.</div>`;
  const parada = ig.ultimaLeitura && Date.now() - new Date(ig.ultimaLeitura).getTime() > 36 * 3600e3;
  return parada ? `<div class="card rl-aviso no-print"><b>A leitura automática está parada.</b> A última foi em ${hora(ig.ultimaLeitura)}. Confira as rotinas no Supabase (supabase/instagram-cron.sql).</div>` : '';
}

// Cruza as publicações com as tarefas do Conteúdo (mesmo dia e mesmo formato) para ver qual etapa do funil alcançou mais.
const NOME_FUNIL = { topo: 'Topo de funil (atrair)', meio: 'Meio de funil (considerar)', fundo: 'Fundo de funil (converter)' };
const FORMATO_DO_TIPO = { Reels: 'reels', Carrossel: 'carrossel', 'Estático': 'feed' };
function funilPorEtapa(clienteId, serie, ym) {
  const tarefas = pecas().filter((p) => p.clienteId === clienteId && NOME_FUNIL[p.funil] && p.publicar);
  const usadas = new Set();
  const grupos = {};
  for (let i = 0; i < 6; i++) {
    for (const post of serie[ymMais(ym, -i)]?.posts || []) {
      if (!post.data || !Number.isFinite(Number(post.alcance))) continue;
      const t = tarefas.find((x) => !usadas.has(x.id) && x.publicar === post.data && (FORMATOS[x.formato] ? x.formato : 'feed') === FORMATO_DO_TIPO[post.tipo]);
      if (!t) continue;
      usadas.add(t.id);
      (grupos[t.funil] ||= []).push(Number(post.alcance));
    }
  }
  const total = Object.values(grupos).reduce((n, v) => n + v.length, 0);
  if (total < 3) return null;
  return Object.entries(grupos).map(([f, v]) => ({ nome: NOME_FUNIL[f], n: v.length, media: Math.round(v.reduce((a, b) => a + b, 0) / v.length) })).sort((a, b) => b.media - a.media);
}

// Aba Contas: a conexão com o Instagram do cliente, a atualização dos números e a importação.
function abaContas(c, ym) {
  const ig = igApi.conexao(c.id);
  const atual = store.obter('insights', idInsight(c.id, ym));
  const hora = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const estado = !igApi.disponivel() ? 'Modo local: a conexão com o Instagram só existe no painel publicado.'
    : ig ? `Conectado${ig.username ? ` como @${ig.username}` : ''}${ig.ultimaLeitura ? ` · última leitura em ${hora(ig.ultimaLeitura)}` : ''}`
      : 'Ainda não conectado. O dono do Instagram autoriza uma vez e os números passam a vir sozinhos.';
  const fonte = atual?.fonte === 'instagram' ? 'números direto do Instagram' : atual ? 'dados importados' : 'sem números neste mês';
  return `<div class="card mt-redes"><div class="card-h"><div><h2>Contas de ${esc(c.nome)}</h2><p class="sub">Hoje o painel lê só o Instagram. Outras redes entram aqui no futuro.</p></div></div>
      <div class="mt-rede"><span class="mt-rede-ic">${ic('image')}</span>
        <div class="mt-rede-t"><b>Instagram ${c.instagram ? `<small>${esc(c.instagram)}</small>` : ''}</b><span>${esc(estado)}</span><span class="lbl">${esc(nomeMes(ym))}: ${esc(fonte)}</span></div>
        <div class="actions">${botoesInstagram(c, ym)}<button class="btn sec sm" data-act="rel-importar" data-cliente="${esc(c.id)}">${ic('upload')}Importar dados</button></div></div></div>
    ${avisoLeitura(c)}`;
}

function blocoCliente(c, ym) {
  if (aba === 'contas') return abaContas(c, ym);
  const atual = store.obter('insights', idInsight(c.id, ym));
  const anterior = store.obter('insights', idInsight(c.id, ymAnterior(ym)));
  const prod = producaoDoMes(c.id, ym);
  const online = igApi.disponivel();
  const todasStories = online ? igApi.storiesGuardadas(c.id) : [];
  if (online && !storiesPedidos.has(c.id)) { storiesPedidos.add(c.id); igApi.stories(c.id).then(recarregarTela); }
  const doMes = (m) => todasStories.filter((s) => String(s.dados?.data || '').slice(0, 7) === m);
  if (!atual) {
    return `${avisoLeitura(c)}<div class="card empty" style="padding:26px 10px">${flor()}<h2>Sem números deste mês</h2>
      <p>Na aba Contas, use “Atualizar do Instagram” (se o Instagram deste cliente estiver conectado) ou “Importar dados”. Enquanto isso, o painel já mostra o que foi produzido.</p>
      ${prod.total ? `<p class="lbl">Produzido no mês: ${prod.total} ${prod.total === 1 ? 'tarefa' : 'tarefas'} (${prod.porFormato.map(([n, q]) => `${q} ${n}`).join(', ')}).</p>` : ''}
      <button class="btn pri" data-act="mt-aba" data-aba="contas">Ir para Contas</button></div>`;
  }
  const serie = Object.fromEntries(store.todos('insights').filter((i) => i.clienteId === c.id).map((i) => [i.mes, i]));
  if (aba === 'metricas') {
    return `${avisoLeitura(c)}<div class="mt">${painelMetricas({ cliente: c, ym, atual, anterior, serie })}</div>
      <div class="card mt-enviar no-print"><div><b>Relatório de ${esc(nomeMes(ym))}</b><span class="lbl"> · o relatório completo, com a nossa leitura do mês, para o cliente abrir sem senha</span></div>
        <div class="actions"><button class="btn sec sm" data-act="mt-aba" data-aba="relatorio">${ic('doc')}Ver o relatório</button>${online ? `<button class="btn pri sm" data-act="rel-enviar" data-cliente="${esc(c.id)}" data-mes="${ym}">${ic('send')}Enviar relatório mensal</button>` : ''}</div></div>`;
  }
  const acoes2 = `<div class="rl-acoes no-print">
      ${online ? `<button class="btn pri sm" data-act="rel-enviar" data-cliente="${esc(c.id)}" data-mes="${ym}">${ic('send')}Enviar relatório mensal</button>` : ''}
      <button class="btn sec sm" data-act="rel-leitura" data-cliente="${esc(c.id)}" data-mes="${ym}">${ic('edit')}Escrever a leitura do mês</button>
      <button class="btn sec sm" data-act="rel-metas" data-cliente="${esc(c.id)}">${ic('target')}Metas do cliente</button>
      <button class="btn sec sm" data-act="rel-imprimir">${ic('printer')}Imprimir ou salvar PDF</button>
      ${online ? `<button class="btn sec sm" data-act="rel-link-relatorio" data-cliente="${esc(c.id)}" title="Copia o link que o cliente abre para ver só este relatório">${ic('link')}Copiar link do cliente</button>
      <button class="btn ghost sm" data-act="rel-link-novo" data-cliente="${esc(c.id)}" title="Cria um link novo e desativa o anterior">Novo link</button>` : ''}</div>`;
  return `${avisoLeitura(c)}${acoes2}<div class="rl">${corpoRelatorio({ cliente: c, ym, atual, anterior, serie, producao: prod, stories: doMes(ym), storiesAnt: doMes(ymAnterior(ym)), painel: true, funil: funilPorEtapa(c.id, serie, ym) })}</div>`;
}

// Janela "Enviar relatório mensal": mensagem pronta (editável), link, WhatsApp e PDF.
async function enviarRelatorio(clienteId, ym) {
  const c = store.obter('cliente', clienteId);
  if (!c) return;
  let url;
  try { url = await igApi.linkRelatorio(clienteId); } catch (err) { toast(err.message, true); return; }
  const mensagem = `Olá! Segue o relatório de ${nomeMes(ym)} do Instagram da ${c.nome}, com os números do mês e a nossa leitura. Você abre direto pelo link, sem senha:\n${url}\n\nQualquer dúvida, é só chamar. Bôdhi Marketing`;
  const m = abrirModal({
    titulo: `Enviar o relatório de ${nomeMes(ym)}`,
    subtitulo: `${c.nome}. O cliente abre o relatório pelo link, sem senha. Revise o texto, copie e mande pelo WhatsApp ou por e-mail.`,
    largo: true,
    corpo: `<div class="field"><label for="rel-msg">Mensagem</label><textarea id="rel-msg" rows="7">${esc(mensagem)}</textarea></div>
      <div class="field"><label for="rel-url">Link do relatório</label><input id="rel-url" readonly value="${esc(url)}"></div>
      <p class="lbl" style="margin-top:8px">O link mostra o relatório mais recente do cliente e deixa navegar pelos meses. Se ele cair em mãos erradas, use “Novo link” na aba Relatório mensal: o antigo deixa de funcionar.</p>
      <div class="modal-f"><button class="btn ghost" data-fechar-env>Fechar</button><div class="actions">
        <button class="btn sec" data-env-pdf>${ic('printer')}Salvar em PDF</button>
        <button class="btn sec" data-env-link>${ic('link')}Copiar link</button>
        <button class="btn sec" data-env-msg>Copiar mensagem</button>
        <button class="btn pri" data-env-wa>${ic('send')}Abrir no WhatsApp</button></div></div>`,
  });
  const msg = m.el.querySelector('#rel-msg');
  const copiar = async (texto, ok) => { try { await navigator.clipboard.writeText(texto); toast(ok); } catch { toast('Não consegui copiar sozinho: selecione o texto e use Ctrl+C.', true); } };
  m.el.querySelector('[data-fechar-env]').onclick = () => m.fechar();
  m.el.querySelector('[data-env-link]').onclick = () => copiar(url, 'Link copiado');
  m.el.querySelector('[data-env-msg]').onclick = () => copiar(msg.value, 'Mensagem copiada');
  m.el.querySelector('[data-env-wa]').onclick = () => { window.open(`https://wa.me/?text=${encodeURIComponent(msg.value)}`, '_blank', 'noopener'); };
  m.el.querySelector('[data-env-pdf]').onclick = () => { m.fechar(); aba = 'relatorio'; recarregarTela(); setTimeout(() => document.querySelector('[data-act="rel-imprimir"]')?.click(), 600); };
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
  titulo: () => 'Métricas',
  sub: () => 'Resultados do cliente nas redes sociais, o relatório mensal e as contas conectadas.',

  render({ ref }) {
    const ym = mes || mesPadrao();
    const clientes = clientesDoRelatorio();
    if (!clientes.length) return `<div class="card empty">${flor()}<h2>Nenhum cliente com Instagram</h2><p>Preencha o campo “Instagram do cliente” na ficha de um cliente. Ele passa a aparecer aqui.</p><button class="btn pri" data-act="ir" data-rota="clientes">Ir para Clientes</button></div>`;
    const c = clientes.find((x) => x.id === ref) || clientes[0];
    const chips = clientes.map((x) => `<button class="cbtn ${x.id === c.id ? 'on' : ''} no-print" data-act="ir" data-rota="relatorio" data-ref="${esc(x.id)}"><i></i>${esc(x.nome)}</button>`).join('');
    // Descobre quem já está conectado (uma vez) e redesenha a tela.
    if (igApi.disponivel() && !igApi.carregado()) igApi.status().then(recarregarTela);
    const abas = `<div class="tabs no-print" role="tablist" aria-label="Seções de Métricas">
      <button class="tab ${aba === 'metricas' ? 'on' : ''}" role="tab" aria-selected="${aba === 'metricas'}" data-act="mt-aba" data-aba="metricas">${ic('trend')}Métricas</button>
      <button class="tab ${aba === 'relatorio' ? 'on' : ''}" role="tab" aria-selected="${aba === 'relatorio'}" data-act="mt-aba" data-aba="relatorio">${ic('doc')}Relatório mensal</button>
      <button class="tab ${aba === 'contas' ? 'on' : ''}" role="tab" aria-selected="${aba === 'contas'}" data-act="mt-aba" data-aba="contas">${ic('plug')}Contas</button></div>`;
    return `<div class="cbtns no-print" style="margin-bottom:16px">${chips}</div>${abas}${aba === 'contas' ? '' : `<div class="no-print">${seletorMes(ym)}</div>`}<div id="rel-corpo" data-cliente="${esc(c.id)}">${blocoCliente(c, ym)}</div>`;
  },

  montar() { ligarIndice(); },

  acoes: {
    'mt-aba': (el) => { aba = ['relatorio', 'contas'].includes(el.dataset.aba) ? el.dataset.aba : 'metricas'; recarregarTela(); },
    'rel-enviar': (el) => enviarRelatorio(el.dataset.cliente, el.dataset.mes),
    'rel-mes': (el) => {
      const passo = Number(el.dataset.passo);
      mes = passo ? ymMais(mes || mesPadrao(), passo) : null;
      recarregarTela();
    },
    'rel-importar': (el) => importar(el.dataset.cliente),
    // Abre a autorização do Instagram (a janela é aberta no clique, antes de esperar a resposta, para o navegador não bloquear).
    'rel-conectar': async (el) => {
      const janela = window.open('', '_blank');
      try {
        const url = await igApi.linkConectar(el.dataset.cliente);
        if (janela) janela.location.href = url; else location.href = url;
      } catch (err) { janela?.close(); toast(err.message, true); }
    },
    'rel-link-cliente': async (el) => {
      try {
        const url = await igApi.linkConectar(el.dataset.cliente);
        await navigator.clipboard.writeText(url);
        toast('Link copiado. Mande para o dono do Instagram abrir e tocar em Permitir (vale por 7 dias).');
      } catch (err) { toast(err.message, true); }
    },
    'rel-sync': async (el) => {
      el.disabled = true;
      toast('Buscando os números no Instagram...');
      try {
        const r = await igApi.sincronizar(el.dataset.cliente, el.dataset.mes);
        toast(`Pronto: ${r.publicacoes} ${r.publicacoes === 1 ? 'publicação' : 'publicações'} de ${nomeMes(r.mes)}.`);
      } catch (err) { toast(err.message, true); }
      recarregarTela();
    },
    'rel-stories': async (el) => {
      el.disabled = true;
      toast('Lendo os stories ativos...');
      try {
        const r = await igApi.lerStories(el.dataset.cliente);
        await igApi.stories(el.dataset.cliente, true);
        toast(r.stories ? `${r.stories} ${r.stories === 1 ? 'story guardado' : 'stories guardados'}.` : 'Nenhum story ativo agora (o Instagram só entrega os das últimas 24 horas).');
      } catch (err) { toast(err.message, true); }
      recarregarTela();
    },
    'rel-link-relatorio': async (el) => {
      try {
        const url = await igApi.linkRelatorio(el.dataset.cliente);
        try { await navigator.clipboard.writeText(url); toast('Link copiado. O cliente abre e vê só este relatório.'); } catch { window.prompt('Copie o link do relatório:', url); }
      } catch (err) { toast(err.message, true); }
    },
    'rel-link-novo': async (el) => {
      if (!(await confirmar('Criar um link novo? O link antigo deixa de funcionar para quem já recebeu.', 'Criar link novo'))) return;
      try {
        const url = await igApi.linkRelatorio(el.dataset.cliente, true);
        try { await navigator.clipboard.writeText(url); toast('Link novo copiado. O anterior foi desativado.'); } catch { window.prompt('Copie o link novo:', url); }
      } catch (err) { toast(err.message, true); }
    },
    // A leitura do mês é o texto da Bôdhi no relatório. Já vem um rascunho feito pelos números, para a Érika ou a Milena ajustar.
    'rel-leitura': (el) => {
      const c = store.obter('cliente', el.dataset.cliente);
      const ym = el.dataset.mes;
      const atual = store.obter('insights', idInsight(c.id, ym));
      if (!atual) return;
      const serie = Object.fromEntries(store.todos('insights').filter((i) => i.clienteId === c.id).map((i) => [i.mes, i]));
      const stories = igApi.storiesGuardadas(c.id).filter((s) => String(s.dados?.data || '').slice(0, 7) === ym);
      const rascunho = frasesResumo({ ym, atual, anterior: store.obter('insights', idInsight(c.id, ymAnterior(ym))), serie, stories }).join('\n');
      formulario({
        titulo: `Leitura de ${nomeMes(ym)}`,
        subtitulo: 'Este texto aparece no relatório do cliente. O rascunho abaixo foi montado pelos números; escreva o que você acha importante: o que funcionou, o que mudamos e o que vem a seguir.',
        largo: true,
        salvarTexto: 'Salvar leitura',
        valores: { observacao: atual.observacao || rascunho },
        campos: [{ nome: 'observacao', rotulo: 'Leitura do mês', tipo: 'area', cheio: true, linhas: 10 }],
        aoSalvar: async (v) => {
          try { await store.salvar('insights', { ...atual, observacao: String(v.observacao || '').trim() }); } catch (err) { toast(err.message, true); return false; }
          toast('Leitura salva.');
          recarregarTela();
        },
      });
    },
    'rel-metas': (el) => {
      const c = store.obter('cliente', el.dataset.cliente);
      formulario({
        titulo: `Metas de ${c.nome}`,
        subtitulo: 'Metas por mês. Elas aparecem no relatório com a barra do quanto já foi atingido. Deixe vazio o que não tiver meta.',
        salvarTexto: 'Salvar metas',
        valores: { metas: c.metas || {} },
        campos: [
          { nome: 'metas.alcance', rotulo: 'Alcance do mês (contas alcançadas)', tipo: 'numero' },
          { nome: 'metas.seguidoresNovos', rotulo: 'Seguidores novos no mês', tipo: 'numero' },
          { nome: 'metas.interacoes', rotulo: 'Interações no mês', tipo: 'numero' },
          { nome: 'metas.publicacoes', rotulo: 'Publicações no feed no mês', tipo: 'numero' },
          { nome: 'metas.stories', rotulo: 'Stories no mês', tipo: 'numero' },
        ],
        aoSalvar: async (v) => {
          const m = Object.fromEntries(Object.entries(v.metas || {}).filter(([, x]) => x !== '' && x !== null && x !== undefined && Number(x) > 0).map(([k, x]) => [k, Number(x)]));
          try { await store.salvar('cliente', { ...c, metas: m }); } catch (err) { toast(err.message, true); return false; }
          toast('Metas salvas.');
          recarregarTela();
        },
      });
    },
    'rel-imprimir': () => {
      document.body.classList.add('imprimindo');
      window.addEventListener('afterprint', () => document.body.classList.remove('imprimindo'), { once: true });
      window.print();
    },
  },
};
