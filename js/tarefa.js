import { store } from './store.js?v=122';
import { esc, toast, dataBR, urlSegura, diasAte } from './util.js?v=122';
import { ic } from './icons.js?v=122';
import { confirmar, abrirGaveta } from './ui.js?v=122';
import { ETAPAS, FORMATOS, REDES, atrasada } from './conteudo.js?v=122';
import { idDrive, urlAbrir, urlImagem } from './drive.js?v=122';

// Ficha da tarefa de conteúdo. Pensada para o dia a dia de quem cria posts:
//  - em cima, o caminho da tarefa (planejamento até publicado) com o próximo passo em destaque;
//  - à esquerda, o conteúdo (ideia e roteiro, legenda, arquivos);
//  - à direita, a prévia do post, o essencial (responsável, data, cliente) e a conversa da equipe.
// A classificação (formato, funil e rede) fica recolhida numa linha só, para não poluir.
// Tudo se salva sozinho quando a pessoa muda algo; uma tarefa nova só é criada ao clicar em "Criar tarefa".
// Comentários e atividade ficam na própria tarefa (campos `comentarios` e `atividade`).

const RESPONSAVEIS = ['Érika', 'Milena'];
const FUNIL = { topo: 'Topo de funil', meio: 'Meio de funil', fundo: 'Fundo de funil' };
const PLANO = { '': 'Não enviado ao cliente', aprovacao: 'Aguardando aprovação do cliente', ajustes: 'Alteração pedida pelo cliente', aprovado: 'Aprovado pelo cliente' };
const LIMITE_LEGENDA = 2200; // limite de caracteres da legenda no Instagram
// Próximo passo em cada etapa: [etapa de destino, texto do botão, estilo].
const PROXIMOS = {
  briefing: [['criacao', 'Iniciar criação']],
  criacao: [['aprovacao', 'Enviar para aprovação']],
  aprovacao: [['aprovado', 'Cliente aprovou', 'verde'], ['ajustes', 'Pediu ajuste', 'sec']],
  ajustes: [['aprovacao', 'Reenviar para aprovação']],
  aprovado: [['publicado', 'Marcar como publicado']],
  publicado: [],
};
const APELIDOS = { erika: 'Érika', 'erika hollengschwandtner': 'Érika', 'milena oliveira': 'Milena', milena: 'Milena' };

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const primeiroNome = (n) => APELIDOS[norm(n)] || String(n || '').trim().split(/\s+/)[0] || 'Equipe';
const inicial = (n) => (primeiroNome(n)[0] || '?').toUpperCase();
const quem = () => {
  const nome = store.nomeUsuario();
  if (nome) return primeiroNome(nome);
  const mail = (store.emailUsuario() || '').split('@')[0];
  return mail ? primeiroNome(mail.charAt(0).toUpperCase() + mail.slice(1)) : 'Equipe';
};
const quando = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const links = (t) => esc(t).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u.length > 60 ? `${u.slice(0, 57)}…` : u}</a>`);
const crescer = (el) => { el.style.height = 'auto'; el.style.height = `${Math.max(el.scrollHeight, 44)}px`; };
const contar = (txt) => `${String(txt || '').length.toLocaleString('pt-BR')} de ${LIMITE_LEGENDA.toLocaleString('pt-BR')}`;

export function abrirTarefa(p = null, padrao = {}) {
  let id = p?.id || '';
  let rascunho = p ? null : { etapa: 'briefing', formato: 'feed', midias: [], ...padrao };
  let classeAberta = false;
  let ativAberta = false;
  let fila = Promise.resolve();
  const pendentes = new Map(); // campos de texto esperando para salvar
  const timers = {};
  let g;

  const atual = () => (id ? store.obter('conteudo', id) : null) || rascunho || {};
  const clientes = () => {
    const lista = store.todos('cliente').filter((c) => c.status !== 'inativo').sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
    const dele = store.obter('cliente', atual().clienteId);
    if (dele && !lista.includes(dele)) lista.push(dele);
    return lista;
  };
  const nomeEtapa = (e) => ETAPAS.find((x) => x.id === e)?.nome || e;
  // As tarefas do mesmo cliente na ordem da data: serve para o "anterior" e "próxima".
  const vizinhas = () => {
    const t = atual();
    if (!id || !t.clienteId) return [];
    return store.todos('conteudo').filter((x) => x.clienteId === t.clienteId)
      .sort((a, b) => String(a.publicar || '9999').localeCompare(String(b.publicar || '9999')) || String(a.titulo || '').localeCompare(String(b.titulo || '')));
  };

  // ---------- partes da tela ----------
  const topo = (t) => {
    const lista = vizinhas();
    const pos = lista.findIndex((x) => x.id === id);
    const nav = lista.length > 1 ? `<span class="ft-nav"><button type="button" class="iconbtn ft-ib" data-t="viz" data-v="-1" aria-label="Tarefa anterior" title="Tarefa anterior (Alt + ←)" ${pos <= 0 ? 'disabled' : ''}><span class="ft-seta e">${ic('chev')}</span></button><button type="button" class="iconbtn ft-ib" data-t="viz" data-v="1" aria-label="Próxima tarefa" title="Próxima tarefa (Alt + →)" ${pos >= lista.length - 1 ? 'disabled' : ''}><span class="ft-seta d">${ic('chev')}</span></button></span>` : '';
    return `<header class="ft-top">
      <div class="ft-id">
        ${eyebrow(t)}
        <input class="ft-titulo" data-campo="titulo" value="${esc(t.titulo || '')}" placeholder="Título da tarefa" aria-label="Título da tarefa" maxlength="200">
      </div>
      <div class="ft-topo-d"><span class="ft-salvo" data-salvo aria-live="polite"></span>${nav}${id ? `<button type="button" class="iconbtn ft-ib" data-t="excluir" aria-label="Excluir tarefa" title="Excluir tarefa">${ic('trash')}</button>` : ''}<button type="button" class="iconbtn ft-ib" data-t="fechar" aria-label="Fechar" title="Fechar (Esc)">${ic('x')}</button></div>
    </header>`;
  };

  // O caminho da tarefa: cada etapa é um passo; o atual fica em destaque e o próximo passo vira botão.
  const jornada = (t) => {
    const at = ETAPAS.findIndex((e) => e.id === t.etapa);
    const on = !!t.concluida;
    const proximos = (PROXIMOS[t.etapa] || []).map(([para, texto, estilo]) => `<button type="button" class="btn ${estilo || 'pri'} sm" data-t="etapa" data-v="${para}">${esc(texto)}</button>`).join('');
    return `<div class="ft-jor">
      <ol class="ft-passos" aria-label="Caminho da tarefa">${ETAPAS.map((e, i) => `<li class="${i < at ? 'feito' : i === at ? 'atual' : ''}"><button type="button" data-t="etapa" data-v="${e.id}" aria-current="${i === at ? 'step' : 'false'}" title="Mover para ${esc(e.nome)}"><i>${i < at ? ic('check') : i + 1}</i><span>${esc(e.nome)}</span></button></li>`).join('')}</ol>
      <div class="ft-acoes">${proximos}<button type="button" class="ft-ok${on ? ' on' : ''}" data-t="concluir" aria-pressed="${on}" ${id ? '' : 'disabled title="Crie a tarefa primeiro"'}>${ic('check')}<span>${on ? 'Concluída' : 'Concluir'}</span></button></div>
    </div>`;
  };

  const miniatura = (m, i) => `<div class="ft-th" data-i="${i}"><img src="${esc(urlImagem(m.id, 320))}" data-id="${esc(m.id)}" alt="" loading="lazy"><span class="ft-th-t">${m.tipo === 'video' ? ic('play') : ''}${i + 1}</span><button type="button" class="ft-th-x" data-t="rm-midia" data-i="${i}" aria-label="Remover arquivo ${i + 1}">${ic('x')}</button><a class="ft-th-a" href="${esc(urlAbrir(m.id))}" target="_blank" rel="noopener noreferrer" aria-label="Abrir arquivo ${i + 1} no Drive"></a></div>`;

  const arquivos = (t) => {
    const ms = t.midias || [];
    return `${ms.length ? `<div class="ft-ths">${ms.map(miniatura).join('')}</div>` : ''}
      <div class="ft-add"><select data-nova="tipo" aria-label="Tipo de arquivo"><option value="imagem">Imagem</option><option value="video">Vídeo</option></select><input data-nova="url" placeholder="Cole o link do arquivo no Drive e aperte Enter" aria-label="Link do arquivo no Drive"><button type="button" class="btn sec sm" data-t="add-midia">${ic('plus')}Adicionar</button></div>
      <p class="ft-ajuda">Carrossel: um arquivo por slide, na ordem. Reels e story em vídeo: escolha “Vídeo”.</p>`;
  };

  const previa = (t) => {
    const ms = t.midias || [];
    const capa = t.capa || ms.find((m) => m.tipo !== 'video')?.id || ms[0]?.id || '';
    const f = FORMATOS[t.formato] || FORMATOS.feed;
    const vertical = t.formato === 'reels' || t.formato === 'story';
    const cli = store.obter('cliente', t.clienteId);
    return `<div class="ft-prev${vertical ? ' vert' : ''}">
      <div class="ft-prev-arte">${capa ? `<img src="${esc(urlImagem(capa, 640))}" data-id="${esc(capa)}" alt="Prévia da arte">` : `<div class="ft-prev-vazio">${ic(f.icone)}<b>Sem arte ainda</b><span>Cole o link em “Arquivos”.</span></div>`}${ms.length > 1 ? `<span class="ft-prev-n">1/${ms.length}</span>` : ''}${t.formato === 'reels' && capa ? `<span class="ft-prev-p">${ic('play')}</span>` : ''}</div>
      <div class="ft-prev-leg"><b>${esc(cli?.nome || 'cliente')}</b> ${esc((t.legenda || '').slice(0, 140)) || '<em>Sem legenda ainda</em>'}${(t.legenda || '').length > 140 ? '…' : ''}</div>
    </div>`;
  };

  // Em cima do título: primeiro o cliente, depois a classificação (formato, funil e rede) em chips que abrem o editor.
  const eyebrow = (t) => {
    const f = FORMATOS[t.formato] || FORMATOS.feed;
    const cli = store.obter('cliente', t.clienteId);
    const chip = (cls, txt) => `<button type="button" class="chip ${cls} ft-chipb" data-t="classe" title="Alterar a classificação" aria-expanded="${classeAberta}">${txt}</button>`;
    const semExtras = !FUNIL[t.funil] && !REDES[t.rede];
    return `<div class="ft-eyebrow"><span class="ft-cli">${esc(cli?.nome || 'Escolha o cliente')}</span><span class="ft-pontos">${chip(`fm-${FORMATOS[t.formato] ? t.formato : 'feed'}`, `${ic(f.icone)}${esc(f.nome)}`)}${FUNIL[t.funil] ? chip('mute', esc(FUNIL[t.funil])) : ''}${REDES[t.rede] ? chip('mute', esc(REDES[t.rede].nome)) : ''}${semExtras ? '<button type="button" class="chip ft-add-c" data-t="classe">+ Funil e rede</button>' : ''}<button type="button" class="ft-lapis" data-t="classe" aria-label="Alterar a classificação" title="Alterar a classificação">${ic('edit')}</button></span></div>`;
  };

  // Seletores de formato, funil e rede: ficam escondidos e só abrem quando a pessoa clica nos chips.
  const editor = (t) => {
    if (!classeAberta) return '';
    const pill = (nome, v, texto) => `<button type="button" class="ft-pill${String(v) === String(t[nome] || '') ? ' on' : ''}" data-t="set" data-n="${nome}" data-v="${esc(v)}" aria-pressed="${String(v) === String(t[nome] || '')}">${esc(texto)}</button>`;
    return `<div class="ft-ed">
      <div><span class="ft-rot">Formato</span><div class="ft-pills">${Object.entries(FORMATOS).map(([v, f]) => `<button type="button" class="ft-pill${(t.formato || 'feed') === v ? ' on' : ''}" data-t="set" data-n="formato" data-v="${v}" aria-pressed="${(t.formato || 'feed') === v}">${ic(f.icone)}${esc(f.nome)}</button>`).join('')}</div></div>
      <div><span class="ft-rot">Etapa do funil</span><div class="ft-pills">${Object.entries(FUNIL).map(([v, n]) => pill('funil', v, n.replace(' de funil', ''))).join('')}</div></div>
      <div><span class="ft-rot">Rede</span><div class="ft-pills">${Object.entries(REDES).map(([v, r]) => pill('rede', v, r.nome)).join('')}</div></div>
    </div>`;
  };

  const detalhes = (t) => {
    const atras = atrasada(t);
    const d = t.publicar ? diasAte(t.publicar) : null;
    const dica = !t.publicar ? '' : atras ? '<span class="chip warn">Atrasada</span>' : d === 0 ? '<span class="chip info">Hoje</span>' : '';
    return `<dl class="ft-det">
      <div><dt>Responsável</dt><dd class="ft-pills">${RESPONSAVEIS.map((r) => `<button type="button" class="ft-pill${t.responsavel === r ? ' on' : ''}" data-t="set" data-n="responsavel" data-v="${r}" aria-pressed="${t.responsavel === r}"><i class="ft-av">${inicial(r)}</i>${esc(r)}</button>`).join('')}</dd></div>
      <div><dt>Publicar em</dt><dd><input type="date" data-campo="publicar" value="${esc(t.publicar || '')}" aria-label="Data de publicação">${dica}</dd></div>
      <div><dt>Cliente</dt><dd><select data-campo="clienteId" aria-label="Cliente"><option value="">Escolha o cliente</option>${clientes().map((c) => `<option value="${esc(c.id)}"${c.id === t.clienteId ? ' selected' : ''}>${esc(c.nome || '(sem nome)')}</option>`).join('')}</select></dd></div>
    </dl>`;
  };

  // Arte e arquivos num lugar só (lado direito): prévia do post, miniaturas, campo para adicionar e opções extras.
  const arte = (t) => `<section class="ft-arte"><h3>Arte e arquivos</h3><div data-previa>${previa(t)}</div><div data-arquivos>${arquivos(t)}</div>
    <details class="ft-mais"><summary>Mais opções</summary>
      <label class="ft-lbl" for="ft_capa">Capa (imagem)</label><input id="ft_capa" data-campo="capa" value="${esc(t.capa ? urlAbrir(t.capa) : '')}" placeholder="Link da imagem de capa no Drive">
      <label class="ft-lbl" for="ft_link">Arquivo editável (só a equipe vê)</label><input id="ft_link" data-campo="link" value="${esc(t.link || '')}" placeholder="Canva, Drive ou onde estiver">
      <label class="ft-lbl" for="ft_plano">Planejamento no link do cliente</label><select id="ft_plano" data-campo="planejamento">${Object.entries(PLANO).map(([v, n]) => `<option value="${v}"${v === (t.planejamento || '') ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>
    </details></section>`;

  const esquerda = (t) => {
    const ajustes = t.etapa === 'ajustes' || t.ajuste;
    const ajustesPlano = t.planejamento === 'ajustes' || t.ajustePlano;
    return `
      ${ajustes ? `<section class="ft-s ft-alerta"><h3>${ic('alert')}O cliente pediu ajuste</h3><textarea data-campo="ajuste" rows="2" placeholder="O que o cliente pediu para mudar">${esc(t.ajuste || '')}</textarea></section>` : ''}
      ${ajustesPlano ? `<section class="ft-s ft-alerta"><h3>${ic('alert')}Alteração pedida no planejamento</h3><textarea data-campo="ajustePlano" rows="2" placeholder="O que o cliente pediu para mudar na ideia ou no roteiro">${esc(t.ajustePlano || '')}</textarea></section>` : ''}
      <section class="ft-s"><h3>Ideia e roteiro</h3><textarea data-campo="roteiro" rows="4" placeholder="Qual é a ideia? Como é o vídeo, cena a cena? Quando o planejamento é enviado para aprovação, o cliente lê este texto: escreva sem comentário interno.">${esc(t.roteiro || '')}</textarea></section>
      <section class="ft-s"><div class="ft-h"><h3>Legenda</h3><span class="ft-h-d"><small class="ft-cont" data-cont>${contar(t.legenda)}</small><button type="button" class="btn ghost sm" data-t="copiar">${ic('link')}Copiar</button></span></div><textarea data-campo="legenda" rows="4" placeholder="Texto que o cliente vê junto com a arte na hora de aprovar.">${esc(t.legenda || '')}</textarea></section>`;
  };

  // Comentários em destaque; os fixados ficam no alto (é para onde vão os combinados que não podem se perder).
  // O que mudou na tarefa (etapa, responsável, data...) fica recolhido, para não poluir.
  const conversa = (t) => {
    const coms = [...(t.comentarios || [])].sort((x, y) => String(x.d).localeCompare(String(y.d)));
    const fixados = coms.filter((c) => c.fixado);
    const resto = coms.filter((c) => !c.fixado);
    const ativ = [...(t.atividade || [])];
    if (t.criadoEm && !ativ.some((a) => a.t === 'criou esta tarefa')) ativ.push({ d: t.criadoEm, a: '', t: 'Tarefa criada' });
    ativ.sort((x, y) => String(x.d).localeCompare(String(y.d)));
    const com = (c) => `<li class="ft-m${c.fixado ? ' fixado' : ''}"><i class="ft-av g">${esc(inicial(c.a))}</i><div class="ft-balao"><div class="ft-m-h"><b>${esc(primeiroNome(c.a))}</b><small>${c.fixado ? 'Fixado · ' : ''}${esc(quando(c.d))}</small>${c.id ? `<span class="ft-m-b"><button type="button" class="ft-m-p${c.fixado ? ' on' : ''}" data-t="fixar" data-id="${esc(c.id)}" aria-label="${c.fixado ? 'Desafixar comentário' : 'Fixar comentário no alto'}" title="${c.fixado ? 'Desafixar' : 'Fixar no alto'}">${ic('bookmark')}</button><button type="button" class="ft-m-x" data-t="rm-com" data-id="${esc(c.id)}" aria-label="Excluir comentário" title="Excluir comentário">${ic('x')}</button></span>` : ''}</div><p>${links(c.t)}</p></div></li>`;
    const ev = (a) => `<li class="ft-ev">${a.a ? `<b>${esc(primeiroNome(a.a))}</b> ` : ''}${esc(a.t)} <small>${esc(quando(a.d))}</small></li>`;
    return `<h3>Comentários${coms.length ? ` <span class="ft-n">${coms.length}</span>` : ''}</h3>
      ${fixados.length ? `<ul class="ft-conv ft-fix">${fixados.map(com).join('')}</ul>` : ''}
      <ul class="ft-conv">${resto.map(com).join('') || (fixados.length ? '' : '<li class="ft-vazio">Nenhum comentário ainda. Use este espaço para combinados, legendas alternativas e avisos da equipe. Para não perder um aviso, clique no marcador do comentário para fixá-lo no alto.</li>')}</ul>
      ${ativ.length ? `<details class="ft-ativ" data-ativ${ativAberta ? ' open' : ''}><summary>Histórico de mudanças <span class="ft-n">${ativ.length}</span></summary><ul class="ft-conv">${ativ.map(ev).join('')}</ul></details>` : ''}`;
  };

  const rodapeConversa = () => `<form class="ft-novo" data-novo><i class="ft-av g">${esc(inicial(quem()))}</i><textarea rows="1" data-comentar placeholder="Escreva um comentário (Enter envia)" aria-label="Comentário"></textarea><button type="submit" class="btn pri sm" aria-label="Enviar comentário">${ic('send')}</button></form>`;

  const montar = () => {
    const t = atual();
    return `${topo(t)}<div class="ft-ed-w" data-ed>${editor(t)}</div>${jornada(t)}
      <div class="ft-cols">
        <div class="ft-esq" data-esq>${esquerda(t)}</div>
        <aside class="ft-dir">
          <div class="ft-dir-c">
            <div data-detalhes>${detalhes(t)}</div>
            ${arte(t)}
            <section class="ft-conv-w" data-conversa>${id ? conversa(t) : ''}</section>
          </div>
          ${id ? rodapeConversa() : '<div class="ft-novo cria"><button type="button" class="btn sec" data-t="fechar">Cancelar</button><button type="button" class="btn pri" data-t="criar">Criar tarefa</button></div>'}
        </aside>
      </div>`;
  };

  // ---------- salvar ----------
  const indicar = (m, ok = true) => {
    const el = g?.el.querySelector('[data-salvo]');
    if (!el) return;
    el.textContent = m;
    el.className = `ft-salvo${ok ? '' : ' erro'}`;
    if (ok && m === 'Salvo') setTimeout(() => { if (el.textContent === 'Salvo') el.textContent = ''; }, 1800);
  };
  const registrar = (t, texto) => ({ ...t, atividade: [...(t.atividade || []), { d: new Date().toISOString(), a: quem(), t: texto }].slice(-200) });

  // Aplica uma mudança. Em tarefa já criada salva na hora; na nova só guarda no rascunho.
  const mudar = (patch, atividade = '') => {
    if (!id) { rascunho = { ...rascunho, ...patch }; return Promise.resolve(); }
    fila = fila.then(async () => {
      const antes = store.obter('conteudo', id);
      if (!antes) return;
      let novo = { ...antes, ...patch };
      if (atividade) novo = registrar(novo, atividade);
      indicar('Salvando…');
      try { await store.salvar('conteudo', novo); indicar('Salvo'); } catch (e) { indicar('Não salvou', false); toast(e.message || 'Não consegui salvar agora.', true); }
    });
    return fila;
  };
  const descarregar = () => { for (const [, fn] of pendentes) fn(); pendentes.clear(); };

  const q = (s) => g.el.querySelector(s);
  const pintarTopo = () => {
    const t = atual();
    q('.ft-eyebrow').outerHTML = eyebrow(t);
    q('[data-ed]').innerHTML = editor(t);
    q('.ft-jor').outerHTML = jornada(t);
  };
  const pintarLado = () => { q('[data-previa]').innerHTML = previa(atual()); q('[data-detalhes]').innerHTML = detalhes(atual()); pintarTopo(); };
  const pintarConversa = () => { const el = q('[data-conversa]'); if (el) el.innerHTML = id ? conversa(atual()) : ''; };
  const pintarArquivos = () => { q('[data-arquivos]').innerHTML = arquivos(atual()); q('[data-previa]').innerHTML = previa(atual()); };
  const recarregarEsquerda = async () => { descarregar(); await fila; q('[data-esq]').innerHTML = esquerda(atual()); q('[data-esq]').querySelectorAll('textarea').forEach(crescer); };

  const trocarEtapa = async (para) => {
    const t = atual();
    if (!para || para === t.etapa) return;
    const patch = { etapa: para };
    if (para === 'publicado' && !t.concluida) { patch.concluida = true; patch.concluidaEm = new Date().toISOString(); }
    await mudar(patch, `mudou a etapa para ${nomeEtapa(para)}`);
    pintarTopo(); pintarConversa();
    // O quadro "O cliente pediu ajuste" só aparece nas etapas de ajuste ou quando já há pedido.
    const t2 = atual();
    const precisa = !!(t2.etapa === 'ajustes' || t2.ajuste);
    if (precisa !== !!q('[data-campo="ajuste"]')) await recarregarEsquerda();
  };

  const salvarCampo = (el) => {
    const nome = el.dataset.campo;
    let v = el.value;
    if (nome === 'titulo') v = v.trim();
    if (nome === 'link') { v = v.trim(); if (v && !urlSegura(v)) { indicar('O link precisa começar com http:// ou https://', false); return; } v = urlSegura(v); }
    if (nome === 'capa') { v = v.trim(); if (v && !idDrive(v)) { indicar('A capa precisa ser um link do Google Drive', false); return; } v = idDrive(v); }
    if (nome === 'titulo' && id && !v) { indicar('Dê um título à tarefa', false); return; }
    return mudar({ [nome]: v }).then(() => { if (nome === 'capa' || nome === 'legenda') q('[data-previa]').innerHTML = previa(atual()); });
  };

  const criar = async () => {
    const t = rascunho;
    const titulo = (q('.ft-titulo').value || '').trim();
    if (!t.clienteId) { toast('Escolha o cliente da tarefa (campo Cliente, à direita).', true); q('[data-campo="clienteId"]')?.focus(); return; }
    if (!titulo) { toast('Dê um título à tarefa.', true); q('.ft-titulo').focus(); return; }
    const campo = (n) => q(`[data-campo="${n}"]`)?.value ?? '';
    const link = campo('link').trim();
    const capa = campo('capa').trim();
    if (link && !urlSegura(link)) { toast('O link precisa começar com http:// ou https://', true); return; }
    if (capa && !idDrive(capa)) { toast('A capa precisa ser um link de arquivo do Google Drive.', true); return; }
    const novo = {
      ...t, titulo, link: urlSegura(link), capa: idDrive(capa),
      roteiro: campo('roteiro'), legenda: campo('legenda'), planejamento: campo('planejamento') || '',
      criadoEm: new Date().toISOString(), concluida: false,
    };
    try {
      const salvo = await store.salvar('conteudo', registrar(novo, 'criou esta tarefa'));
      id = salvo.id; rascunho = null;
      toast('Tarefa criada');
      g.el.innerHTML = montar();
      iniciar();
    } catch (e) { toast(e.message || 'Não consegui criar a tarefa agora.', true); }
  };

  const adicionarArquivo = async () => {
    const url = q('[data-nova=url]');
    const tipo = q('[data-nova=tipo]').value;
    const texto = url.value.trim();
    if (!texto) { url.focus(); return; }
    const fid = idDrive(texto);
    if (!fid) { toast('Esse não parece um link de arquivo do Google Drive. Use Compartilhar > Copiar link no Drive.', true); return; }
    await mudar({ midias: [...(atual().midias || []), { tipo, id: fid }] });
    pintarArquivos();
    q('[data-nova=url]')?.focus();
  };

  const enviarComentario = async () => {
    const campo = q('[data-comentar]');
    const texto = campo.value.trim();
    if (!texto) return;
    campo.value = '';
    crescer(campo);
    const novo = { id: `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, a: quem(), d: new Date().toISOString(), t: texto };
    await mudar({ comentarios: [...(atual().comentarios || []), novo] });
    pintarConversa();
    const w = q('.ft-dir-c'); if (w) w.scrollTop = w.scrollHeight;
  };

  const salvarDepois = (el) => {
    const chave = el.dataset.campo;
    if (!chave) return;
    pendentes.set(chave, () => salvarCampo(el));
    clearTimeout(timers[chave]);
    timers[chave] = setTimeout(() => { if (pendentes.has(chave)) { pendentes.get(chave)(); pendentes.delete(chave); } }, 700);
    if (id) indicar('Digitando…');
  };

  const iniciar = () => {
    g.el.querySelectorAll('textarea').forEach(crescer);
    const w = q('.ft-dir-c'); if (w) w.scrollTop = w.scrollHeight;
  };

  const irParaVizinha = async (passo) => {
    const lista = vizinhas();
    const outra = lista[lista.findIndex((x) => x.id === id) + passo];
    if (!outra) return;
    descarregar();
    await fila;
    g.fechar();
    abrirTarefa(outra);
  };

  // ---------- eventos ----------
  const aoClicar = async (e) => {
    const b = e.target.closest('[data-t]');
    if (!b || b.disabled) return;
    const a = b.dataset.t;
    if (a === 'fechar') return g.fechar();
    if (a === 'criar') return criar();
    if (a === 'viz') return irParaVizinha(Number(b.dataset.v));
    if (a === 'classe') { classeAberta = !classeAberta; pintarTopo(); return; }
    if (a === 'concluir') {
      const feita = !atual().concluida;
      await mudar({ concluida: feita, concluidaEm: feita ? new Date().toISOString() : '' }, feita ? 'marcou como concluída' : 'voltou a tarefa para em aberto');
      pintarTopo(); pintarConversa();
      return;
    }
    if (a === 'etapa') return trocarEtapa(b.dataset.v);
    if (a === 'set') {
      const n = b.dataset.n; const v = b.dataset.v;
      const t = atual();
      const novo = t[n] === v && ['responsavel', 'funil', 'rede'].includes(n) ? '' : v;
      await mudar({ [n]: novo }, n === 'responsavel' ? (novo ? `atribuiu a tarefa a ${novo}` : 'tirou o responsável') : '');
      pintarLado(); if (n === 'responsavel') pintarConversa();
      return;
    }
    if (a === 'copiar') {
      const txt = q('[data-campo="legenda"]').value;
      if (!txt.trim()) { toast('Ainda não há legenda para copiar.', true); return; }
      try { await navigator.clipboard.writeText(txt); toast('Legenda copiada'); } catch { toast('Não consegui copiar. Selecione o texto e use Ctrl+C.', true); }
      return;
    }
    if (a === 'add-midia') return adicionarArquivo();
    if (a === 'rm-midia') {
      const i = Number(b.dataset.i);
      await mudar({ midias: (atual().midias || []).filter((_, k) => k !== i) });
      pintarArquivos();
      return;
    }
    if (a === 'fixar') {
      await mudar({ comentarios: (atual().comentarios || []).map((c) => (c.id === b.dataset.id ? { ...c, fixado: !c.fixado } : c)) });
      pintarConversa();
      return;
    }
    if (a === 'rm-com') {
      if (!(await confirmar('Excluir este comentário?', 'Excluir', true))) return;
      await mudar({ comentarios: (atual().comentarios || []).filter((c) => c.id !== b.dataset.id) });
      pintarConversa();
      return;
    }
    if (a === 'excluir') {
      const t = atual();
      if (await confirmar(`Excluir a tarefa “${t.titulo}”?`, 'Excluir', true)) { await store.remover('conteudo', id); g.fechar(); toast('Tarefa excluída'); }
    }
  };

  g = abrirGaveta({
    titulo: p ? 'Tarefa de conteúdo' : 'Nova tarefa de conteúdo',
    corpo: montar(),
    aoFechar: descarregar,
  });
  g.el.addEventListener('click', aoClicar);
  g.el.addEventListener('toggle', (e) => { if (e.target.matches('[data-ativ]')) ativAberta = e.target.open; }, true);
  g.el.addEventListener('input', (e) => {
    const el = e.target;
    if (el.matches('textarea')) crescer(el);
    if (el.matches('[data-comentar]')) return;
    const campo = el.dataset.campo;
    if (campo === 'legenda') { const c = q('[data-cont]'); if (c) { c.textContent = contar(el.value); c.classList.toggle('estourou', el.value.length > LIMITE_LEGENDA); } }
    if (!campo || ['clienteId', 'publicar', 'planejamento'].includes(campo)) return;
    if (!id) { rascunho = { ...rascunho, [campo]: el.value }; if (campo === 'legenda') q('[data-previa]').innerHTML = previa(atual()); return; }
    salvarDepois(el);
  });
  g.el.addEventListener('change', async (e) => {
    const el = e.target;
    const campo = el.dataset.campo;
    if (!campo) return;
    if (['clienteId', 'publicar', 'planejamento'].includes(campo)) {
      const antes = atual()[campo] || '';
      if (campo === 'clienteId' && !el.value && id) { el.value = antes; return; }
      await mudar({ [campo]: el.value }, campo === 'publicar' ? (el.value ? `mudou a data de publicação para ${dataBR(el.value)}` : 'tirou a data de publicação') : '');
      pintarLado(); if (campo === 'publicar') pintarConversa();
      return;
    }
    descarregar();
  });
  g.el.addEventListener('submit', (e) => { e.preventDefault(); enviarComentario(); });
  g.el.addEventListener('keydown', (e) => {
    if (e.target.matches('[data-comentar]') && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); enviarComentario(); }
    if (e.target.matches('[data-nova=url]') && e.key === 'Enter') { e.preventDefault(); adicionarArquivo(); }
    if (e.target.matches('.ft-titulo') && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); irParaVizinha(e.key === 'ArrowLeft' ? -1 : 1); }
  });
  // Arte do Drive às vezes demora a gerar a miniatura: tenta de novo uma vez com outro endereço.
  g.el.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || !img.dataset.id || img.dataset.tentou) return;
    img.dataset.tentou = '1';
    setTimeout(() => { img.src = urlImagem(img.dataset.id, 640, 1); }, 600);
  }, true);
  iniciar();

  // As antigas "observações internas" viram um comentário fixado (uma vez só, ao abrir a tarefa).
  const migrarNota = () => {
    const t = atual();
    const txt = String(t.briefing || '').trim();
    if (!id || !txt) return;
    const c = { id: `nota-${Date.now().toString(36)}`, a: 'Equipe', d: t.atualizadoEm || t.criadoEm || new Date().toISOString(), t: txt, fixado: true };
    mudar({ comentarios: [...(t.comentarios || []), c], briefing: '' }).then(pintarConversa);
  };
  migrarNota();

  // Veio do botão "Pediu ajuste" (ou outro atalho): já aplica a etapa e leva o cursor para onde anotar.
  if (p && padrao.etapa && padrao.etapa !== p.etapa) {
    trocarEtapa(padrao.etapa).then(() => { if (padrao.etapa === 'ajustes') q('[data-campo="ajuste"]')?.focus(); });
  } else if (!p) q('.ft-titulo').focus();
}
