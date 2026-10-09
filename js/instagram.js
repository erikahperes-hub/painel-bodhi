import { esc, dataBR, mesNome, hojeISO, iniciais } from './util.js?v=54';
import { ic } from './icons.js?v=54';
import { urlImagem, urlPlayer } from './drive.js?v=54';
import { config } from './config.js?v=54';

// Visual de Instagram usado na prévia do painel e na página de aprovação do cliente.
// Recebe os dados prontos, então funciona com ou sem login.

// Etapas que o cliente enxerga: só o que já foi enviado para aprovação.
export const ETAPAS_CLIENTE = ['aprovacao', 'ajustes', 'aprovado', 'publicado'];

const FORMATO = {
  feed: { nome: 'Feed', icone: null, vertical: false },
  carrossel: { nome: 'Carrossel', icone: 'layers', vertical: false },
  reels: { nome: 'Reels', icone: 'play', vertical: true },
  story: { nome: 'Story', icone: 'circle', vertical: true },
};
const STATUS = {
  aprovacao: ['creme', 'Aguardando sua aprovação'],
  ajustes: ['warn', 'Alteração pedida'],
  aprovado: ['ok', 'Aprovado'],
  publicado: ['mute', 'Publicado'],
};
const PLANO_ST = {
  aprovacao: ['creme', 'Aguardando sua aprovação'],
  ajustes: ['warn', 'Alteração pedida'],
  aprovado: ['ok', 'Aprovado'],
};
const FUNIL_CLIENTE = { topo: ['cor-mute', 'Topo de funil'], meio: ['cor-mute', 'Meio de funil'], fundo: ['cor-mute', 'Fundo de funil'] };
const fmId = (p) => (FORMATO[p.formato] ? p.formato : 'feed');
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const isoDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ehVideo = (m) => m.tipo === 'video';
const ehStory = (p) => p.formato === 'story';
const doMes = (p, ym) => !!p.publicar && p.publicar.slice(0, 7) === ym;

const capaId = (p) => p.capa || (p.midias || []).find((m) => !ehVideo(m))?.id || (p.midias || []).find(ehVideo)?.id || '';

// Imagem do Drive com tentativas automáticas: guarda o código e a largura para refazer o pedido se falhar.
const imgDrive = (id, largura, extra = '') => `<img src="${esc(urlImagem(id, largura))}" data-id="${esc(id)}" data-w="${largura}" alt=""${extra}>`;

// O Drive às vezes recusa imagens pedidas em rajada. Se uma falhar, tenta de novo algumas vezes antes de desistir.
function retentar(e) {
  const img = e.target;
  if (img.tagName !== 'IMG' || !img.dataset.id) return;
  const n = Number(img.dataset.tent || 0);
  if (n >= 8) return;
  img.dataset.tent = n + 1;
  setTimeout(() => { img.src = urlImagem(img.dataset.id, Number(img.dataset.w), n + 1); }, 700 * (n + 1));
}

const fmt = (p) => FORMATO[p.formato] || FORMATO.feed;
const texto = (s) => esc(s).replace(/\n/g, '<br>');
const rotuloMes = (ym) => { const [a, m] = ym.split('-').map(Number); const n = mesNome(m - 1); return `${n[0].toUpperCase()}${n.slice(1)} ${a}`; };
const porDataAsc = (l) => [...l].sort((a, b) => String(a.publicar || '9').localeCompare(String(b.publicar || '9')));

export function montarFeed(raiz, { cliente, pecas, aoResponder = null, previa = false }) {
  const todas = pecas.map((p) => ({ ...p }));
  // Feed, stories e calendário mostram só o que já foi enviado para aprovação do conteúdo.
  // A aba Planejamento mostra as ideias que a Bôdhi enviou para aprovar antes da produção.
  const lista = todas.filter((p) => ETAPAS_CLIENTE.includes(p.etapa));
  const plano = todas.filter((p) => PLANO_ST[p.planejamento]);
  const handle = String(cliente.instagram || '').replace(/^@/, '').trim() || String(cliente.nome || '').trim();
  const avatar = (grande = false) => `<span class="ig-av${grande ? ' lg' : ''}">${cliente.imagem ? `<img src="${esc(cliente.imagem)}" alt="">` : esc(iniciais(cliente.nome))}</span>`;
  let overlay = null;

  // Abre no mês da primeira peça que ainda espera aprovação; se não houver, no mês mais recente com peças.
  function mesInicial() {
    const pend = porDataAsc(lista.filter((p) => p.etapa === 'aprovacao' && p.publicar))[0] || porDataAsc(plano.filter((p) => p.planejamento === 'aprovacao' && p.publicar))[0];
    const ultimo = porDataAsc([...lista, ...plano].filter((p) => p.publicar)).pop();
    return (pend || ultimo)?.publicar.slice(0, 7) || hojeISO().slice(0, 7);
  }
  const planoPendente = plano.some((p) => p.planejamento === 'aprovacao');
  const estado = { aba: planoPendente && !lista.some((p) => p.etapa === 'aprovacao') ? 'plano' : (plano.length && !lista.length ? 'plano' : 'feed'), mes: mesInicial(), aberta: null };

  function tile(p, { pequeno = false, num = '', passivo = false } = {}) {
    const tag = passivo ? 'span' : 'button';
    const attrs = passivo ? '' : ` data-ig-abrir="${esc(p.id)}" aria-label="${esc(p.titulo || 'Peça')}"`;
    const f = fmt(p);
    const capa = capaId(p);
    const st = STATUS[p.etapa] || STATUS.aprovacao;
    return `<${tag} class="ig-tile${pequeno ? ' mini' : ''}${ehStory(p) ? ' story' : ''}"${attrs}>
      ${capa ? imgDrive(capa, 480, ' loading="lazy"') : `<span class="ig-vazio">${ic(f.icone || 'image')}</span>`}
      ${num && !pequeno ? `<span class="ig-num">${num}</span>` : ''}
      ${f.icone && !pequeno ? `<span class="ig-fmt">${ic(f.icone)}</span>` : ''}
      <i class="ig-st st-${st[0]}" title="${esc(st[1])}"></i></${tag}>`;
  }

  function cabecalho() {
    const doMesLista = lista.filter((p) => doMes(p, estado.mes));
    const aguardando = doMesLista.filter((p) => p.etapa === 'aprovacao').length;
    const ideiasPend = plano.filter((p) => doMes(p, estado.mes) && p.planejamento === 'aprovacao').length;
    return `<div class="ig-perfil">${avatar(true)}<div>
        <h2>${esc(cliente.nome)}</h2>${cliente.instagram ? `<p class="ig-h">@${esc(handle)}</p>` : ''}
        <p class="lbl">${doMesLista.length} ${doMesLista.length === 1 ? 'publicação' : 'publicações'} em ${esc(rotuloMes(estado.mes).split(' ')[0].toLowerCase())}${aguardando ? ` · <b>${aguardando} aguardando sua aprovação</b>` : ''}${ideiasPend ? ` · <b>${ideiasPend} ${ideiasPend === 1 ? 'ideia aguardando' : 'ideias aguardando'} sua aprovação</b>` : ''}</p></div></div>
      <div class="ig-mes"><button class="iconbtn" data-ig-mes="-1" aria-label="Mês anterior"><span style="display:grid;transform:scaleX(-1)">${ic('chev')}</span></button>
        <h3>${esc(rotuloMes(estado.mes))}</h3>
        <button class="iconbtn" data-ig-mes="1" aria-label="Próximo mês">${ic('chev')}</button></div>
      <p class="ig-dica">${estado.aba === 'plano' ? 'Veja no calendário o dia de cada ideia e, na lista, o que já foi aprovado e o que ainda não. Toque em uma ideia para ler o roteiro e aprovar ou pedir alteração.' : 'Toque em qualquer post para ver o conteúdo completo. Carrosséis deslizam e reels tocam o vídeo. Tudo como vai ao ar.'}</p>`;
  }

  function grade(itens, stories = false) {
    if (!itens.length) return `<div class="ig-nada"><p>${stories ? 'Nenhum story neste mês.' : 'Nenhuma publicação neste mês.'} Use as setas para ver outros meses.</p></div>`;
    return `<div class="ig-grade${stories ? ' story' : ''}">${porDataAsc(itens).map((p, i) => tile(p, { num: String(i + 1).padStart(2, '0') })).join('')}</div>`;
  }

  function calendario(itensMes) {
    const hoje = hojeISO();
    const [a, m] = estado.mes.split('-').map(Number);
    const primeiro = new Date(a, m - 1, 1).getDay();
    const semanas = Math.ceil((primeiro + new Date(a, m, 0).getDate()) / 7);
    const dias = {};
    itensMes.forEach((p) => (dias[p.publicar.slice(0, 10)] ||= []).push(p));
    const celulas = Array.from({ length: semanas * 7 }, (_, i) => {
      const d = new Date(a, m - 1, 1 - primeiro + i);
      const iso = isoDia(d);
      return `<div class="ig-dia${d.getMonth() !== m - 1 ? ' fora' : ''}${iso === hoje ? ' hoje' : ''}"><span>${d.getDate()}</span><div>${(dias[iso] || []).map((p) => tile(p, { pequeno: true })).join('')}</div></div>`;
    }).join('');
    const linhas = porDataAsc(itensMes).map((p) => {
      const st = STATUS[p.etapa] || STATUS.aprovacao;
      const f = fmt(p);
      return `<button class="ig-li" data-ig-abrir="${esc(p.id)}">${tile(p, { pequeno: true, passivo: true })}
        <span class="ig-li-t"><b>${esc(p.titulo || 'Peça')}</b><small>${esc(dataBR(p.publicar))} · ${esc(f.nome)}</small></span>
        <span class="chip cor-${st[0]}">${esc(st[1])}</span></button>`;
    }).join('');
    return `<div class="calbox"><div class="ig-cal">${DIAS.map((d) => `<div class="dow">${d}</div>`).join('')}${celulas}</div></div>
      ${linhas ? `<h4 class="ig-sub">Calendário do mês</h4><div class="ig-lista">${linhas}</div>` : '<div class="ig-nada"><p>Nenhuma publicação neste mês.</p></div>'}`;
  }

  /* ---------- Planejamento (ideias antes da produção) ---------- */
  function cardPlano(p) {
    const st = PLANO_ST[p.planejamento];
    const f = fmt(p);
    const id = esc(p.id);
    let quando = '<span class="ig-pl-d"><b>?</b><small>sem data</small></span>';
    if (p.publicar) {
      const [a, m, d] = p.publicar.slice(0, 10).split('-').map(Number);
      quando = `<span class="ig-pl-d"><b>${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}</b><small>${DIAS[new Date(a, m - 1, d).getDay()]}</small></span>`;
    }
    const r = String(p.roteiro || '').trim();
    return `<article class="ig-pl" data-ig-pl="${id}">
      <div class="ig-pl-h">${quando}<span class="chip info">${esc(f.nome)}</span>${FUNIL_CLIENTE[p.funil] ? `<span class="chip ${FUNIL_CLIENTE[p.funil][0]}">${FUNIL_CLIENTE[p.funil][1]}</span>` : ''}<span class="chip cor-${st[0]}">${esc(st[1])}</span></div>
      <h4>${esc(p.titulo || 'Peça')}</h4>
      ${r ? `<details class="ig-det"${r.length <= 420 ? ' open' : ''}><summary>Ideia e roteiro</summary><div class="ig-pl-r">${texto(r)}</div></details>` : '<p class="lbl">Ainda sem roteiro escrito.</p>'}
      ${p.planejamento === 'ajustes' && p.ajustePlano ? `<p class="ig-msg warn">Você pediu: “${esc(p.ajustePlano)}”</p>` : ''}
      <div class="ig-pl-a">
        ${p.planejamento === 'aprovado' ? '<span class="ig-msg ok" style="margin:0">Você aprovou esta ideia.</span>' : `<button class="btn verde sm" data-ig-pl-aprovar="${id}">${ic('check')}Aprovar</button>`}
        <button class="btn sec sm" data-ig-pl-ajustar="${id}">${ic('edit')}Pedir alteração</button>
      </div>
      <form class="ig-aj" data-ig-pl-form="${id}" hidden><label>O que você gostaria de mudar nesta ideia?</label><textarea rows="3" maxlength="1500" placeholder="Ex.: trocar o tema ou mudar a data"></textarea>
        <div class="actions"><button class="btn pri sm" type="submit">Enviar pedido</button><button class="btn ghost sm" type="button" data-ig-pl-cancelar>Cancelar</button></div></form>
      <p class="ig-erro" hidden></p>
    </article>`;
  }

  // Aba Planejamento: calendário do mês à direita e, à esquerda, a lista que mostra o que já foi aprovado e o que não.
  let planoOv = null;
  const PLANO_CURTO = { aprovacao: 'Aguardando', ajustes: 'Alteração', aprovado: 'Aprovada' };
  const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const diaSemana = (iso) => { const [a, m, d] = iso.slice(0, 10).split('-').map(Number); return DIAS[new Date(a, m - 1, d).getDay()]; };
  const funilTxt = (p) => (FUNIL_CLIENTE[p.funil] ? FUNIL_CLIENTE[p.funil][1] : '');

  function itemPlano(p) {
    const st = PLANO_ST[p.planejamento];
    const f = fmt(p);
    const quando = p.publicar ? `<span class="ig-pl-d"><b>${esc(ddmm(p.publicar))}</b><small>${esc(diaSemana(p.publicar))}</small></span>` : '<span class="ig-pl-d"><b>?</b><small>sem data</small></span>';
    return `<button class="ig-pl-item" data-ig-pl-abrir="${esc(p.id)}">${quando}<span class="ig-pl-it"><b>${esc(p.titulo || 'Peça')}</b><small><i class="fm-dot fm-${fmId(p)}"></i>${esc([f.nome, funilTxt(p)].filter(Boolean).join(' · '))}</small></span><span class="chip cor-${st[0]}">${esc(PLANO_CURTO[p.planejamento])}</span></button>`;
  }

  function calendarioPlano(itens) {
    const hoje = hojeISO();
    const [a, m] = estado.mes.split('-').map(Number);
    const primeiro = new Date(a, m - 1, 1).getDay();
    const semanas = Math.ceil((primeiro + new Date(a, m, 0).getDate()) / 7);
    const dias = {};
    itens.forEach((p) => (dias[p.publicar.slice(0, 10)] ||= []).push(p));
    const celulas = Array.from({ length: semanas * 7 }, (_, i) => {
      const d = new Date(a, m - 1, 1 - primeiro + i);
      const iso = isoDia(d);
      const chips = (dias[iso] || []).map((p) => {
        const st = PLANO_ST[p.planejamento];
        return `<button class="ig-pl-chip fm-${fmId(p)}" data-ig-pl-abrir="${esc(p.id)}" title="${esc(`${p.titulo || 'Peça'} · ${fmt(p).nome} · ${st[1]}`)}"><i class="st-${st[0]}"></i><span>${esc(p.titulo || 'Peça')}</span></button>`;
      }).join('');
      return `<div class="ig-dia${d.getMonth() !== m - 1 ? ' fora' : ''}${iso === hoje ? ' hoje' : ''}"><span>${d.getDate()}</span><div>${chips}</div></div>`;
    }).join('');
    return `<div class="calbox"><div class="ig-cal">${DIAS.map((d) => `<div class="dow">${d}</div>`).join('')}${celulas}</div></div>`;
  }

  function planoHTML() {
    const doMesP = porDataAsc(plano.filter((p) => doMes(p, estado.mes)));
    const semDataP = plano.filter((p) => !p.publicar);
    const cont = (s) => doMesP.filter((p) => p.planejamento === s).length;
    const pend = cont('aprovacao');
    const resumo = `<div class="ig-pl-res"><span class="chip cor-ok">Aprovadas ${cont('aprovado')}</span><span class="chip cor-creme">Aguardando ${pend}</span><span class="chip cor-warn">Com alteração ${cont('ajustes')}</span></div>`;
    const tudo = pend ? `<button class="btn verde sm" data-ig-pl-todas>${ic('check')}Aprovar tudo deste mês</button>` : '';
    const itens = [...doMesP, ...semDataP].map(itemPlano).join('') || '<div class="ig-nada"><p>Nenhuma ideia neste mês. Use as setas para ver outros meses.</p></div>';
    return `<div class="ig-plgrid">
      <aside class="ig-pl-lado"><h4 class="ig-sub" style="margin:0">Ideias do mês</h4>${resumo}${tudo}<p class="ig-erro" data-ig-pl-erro hidden></p><div class="ig-pl-itens">${itens}</div></aside>
      <div class="ig-pl-calwrap">${calendarioPlano(doMesP)}<div class="ig-pl-fmts" title="A cor de cada ideia no calendário é o tipo de conteúdo; a bolinha mostra se foi aprovada">${Object.entries(FORMATO).map(([id, x]) => `<span class="chip fm-${id}">${esc(x.nome)}</span>`).join('')}</div></div></div>`;
  }

  function abrirPlano(id) {
    const p = plano.find((x) => x.id === id);
    if (!p) return;
    fecharPlano();
    planoOv = document.createElement('div');
    planoOv.className = 'overlay ig-ov';
    planoOv.innerHTML = `<div class="ig-post ig-pl-modal" role="dialog" aria-modal="true" aria-label="${esc(p.titulo || 'Ideia')}"><header class="ig-ph"><b style="font:700 15px var(--ui)">Ideia do dia</b><button class="iconbtn" data-ig-pl-fechar aria-label="Fechar" style="width:40px;height:40px;font-size:18px;box-shadow:none;margin-left:auto">${ic('x')}</button></header><div style="padding:0 14px 14px">${cardPlano(p)}</div></div>`;
    document.body.appendChild(planoOv);
    document.body.style.overflow = 'hidden';
    planoOv.addEventListener('mousedown', (e) => { if (e.target === planoOv) fecharPlano(); });
    planoOv.addEventListener('click', clicarPlano);
    planoOv.addEventListener('submit', enviarPlano);
  }

  function fecharPlano() {
    planoOv?.remove();
    planoOv = null;
    if (!overlay) document.body.style.overflow = '';
  }

  // Cliques da aba Planejamento (valem na tela e dentro da janela da ideia). Devolve true se tratou o clique.
  function clicarPlano(e) {
    const alvo = e.target;
    const aprovar = alvo.closest('[data-ig-pl-aprovar]');
    if (aprovar) { responderPlano(aprovar.dataset.igPlAprovar, 'plano_aprovar'); return true; }
    const ajustar = alvo.closest('[data-ig-pl-ajustar]');
    if (ajustar) {
      const f = (planoOv || raiz).querySelector(`[data-ig-pl-form="${CSS.escape(ajustar.dataset.igPlAjustar)}"]`);
      if (f) { f.hidden = false; f.querySelector('textarea').focus(); }
      return true;
    }
    const cancelar = alvo.closest('[data-ig-pl-cancelar]');
    if (cancelar) { cancelar.closest('[data-ig-pl-form]').hidden = true; return true; }
    if (alvo.closest('[data-ig-pl-fechar]')) { fecharPlano(); return true; }
    if (alvo.closest('[data-ig-pl-todas]')) { aprovarTudoDoMes(); return true; }
    return false;
  }

  function enviarPlano(e) {
    const f = e.target.closest('[data-ig-pl-form]');
    if (!f) return;
    e.preventDefault();
    const t = f.querySelector('textarea').value.trim();
    const erroEl = f.closest('[data-ig-pl]')?.querySelector('.ig-erro');
    if (!t) { if (erroEl) { erroEl.textContent = 'Escreva o que você gostaria de mudar.'; erroEl.hidden = false; } return; }
    responderPlano(f.dataset.igPlForm, 'plano_ajustar', t);
  }

  async function responderPlano(id, acao, comentario = '', agrupado = false) {
    const p = plano.find((x) => x.id === id);
    if (!p) return false;
    const card = (planoOv || raiz).querySelector(`[data-ig-pl="${CSS.escape(id)}"]`);
    const erroEl = card?.querySelector('.ig-erro');
    const erroTexto = (t) => { if (erroEl) { erroEl.textContent = t; erroEl.hidden = !t; } };
    if (!aoResponder) { erroTexto('Na prévia os botões não enviam nada. O cliente os usa na página de aprovação.'); return false; }
    card?.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      await aoResponder(p, acao, comentario);
      p.planejamento = acao === 'plano_aprovar' ? 'aprovado' : 'ajustes';
      if (acao === 'plano_ajustar') p.ajustePlano = comentario;
      if (!agrupado) { fecharPlano(); desenhar(); }
      return true;
    } catch (err) {
      card?.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      erroTexto(err?.message || 'Não foi possível enviar agora. Tente de novo.');
      return false;
    }
  }

  async function aprovarTudoDoMes() {
    const pend = plano.filter((p) => doMes(p, estado.mes) && p.planejamento === 'aprovacao');
    if (!pend.length) return;
    const geral = raiz.querySelector('[data-ig-pl-erro]');
    if (!aoResponder) { geral.textContent = 'Na prévia os botões não enviam nada. O cliente os usa na página de aprovação.'; geral.hidden = false; return; }
    if (!window.confirm(`Aprovar as ${pend.length} ${pend.length === 1 ? 'ideia' : 'ideias'} de ${rotuloMes(estado.mes)}?`)) return;
    const btn = raiz.querySelector('[data-ig-pl-todas]');
    btn.disabled = true;
    btn.textContent = 'Aprovando...';
    let falhas = 0;
    for (const p of pend) { if (!(await responderPlano(p.id, 'plano_aprovar', '', true))) falhas += 1; }
    desenhar();
    if (falhas) { const e = raiz.querySelector('[data-ig-pl-erro]'); if (e) { e.textContent = `${falhas} ${falhas === 1 ? 'ideia não foi aprovada' : 'ideias não foram aprovadas'}. Atualize a página e tente de novo.`; e.hidden = false; } }
  }

  function desenhar() {
    const itensMes = lista.filter((p) => doMes(p, estado.mes));
    const feed = itensMes.filter((p) => !ehStory(p));
    const stories = itensMes.filter(ehStory);
    const semData = lista.filter((p) => !p.publicar);
    const aba = (id, icone, nome, n) => `<button class="tab ${estado.aba === id ? 'on' : ''}" role="tab" aria-selected="${estado.aba === id}" data-ig-aba="${id}">${ic(icone)}${nome}${n === undefined ? '' : ` <small>${n}</small>`}</button>`;
    if (estado.aba === 'plano' && !plano.length) estado.aba = 'feed';
    const corpo = estado.aba === 'plano' ? planoHTML() : estado.aba === 'feed' ? grade(feed) : estado.aba === 'stories' ? grade(stories, true) : calendario(itensMes);
    const ideiasPendTotal = plano.filter((p) => p.planejamento === 'aprovacao').length;
    raiz.innerHTML = `<div class="ig">${cabecalho()}
      <div class="tabs" role="tablist" style="margin:16px 0 14px">${plano.length ? aba('plano', 'doc', 'Planejamento', ideiasPendTotal || undefined) : ''}${aba('feed', 'grid', 'Feed', feed.length)}${aba('stories', 'circle', 'Stories', stories.length)}${aba('calendario', 'calendar', 'Calendário')}</div>
      ${corpo}
      ${semData.length && (estado.aba === 'feed' || estado.aba === 'stories') ? `<h4 class="ig-sub">Sem data definida</h4><div class="ig-grade">${semData.map((p) => tile(p)).join('')}</div>` : ''}</div>`;
  }

  /* ---------- Post aberto ---------- */
  function slide(m, p) {
    if (!ehVideo(m)) return `<div class="ig-slide">${imgDrive(m.id, 1080)}</div>`;
    const poster = p.capa || m.id;
    return `<div class="ig-slide ig-video"><button class="ig-play" data-ig-tocar="${esc(m.id)}" aria-label="Tocar vídeo">${imgDrive(poster, 720)}<span>${ic('play')}</span></button></div>`;
  }

  function midia(p) {
    const ms = p.midias || [];
    const vert = fmt(p).vertical;
    if (!ms.length) return `<div class="ig-media ${vert ? 'v' : 'h'}"><div class="ig-slide ig-sem">${ic('image')}<span>A arte ainda não foi anexada</span></div></div>`;
    return `<div class="ig-media ${vert ? 'v' : 'h'}"><div class="ig-car" data-ig-car>${ms.map((m) => slide(m, p)).join('')}</div>
      ${ms.length > 1 ? `<button class="ig-seta e" data-ig-seta="-1" aria-label="Anterior"><span style="display:grid;transform:scaleX(-1)">${ic('chev')}</span></button><button class="ig-seta d" data-ig-seta="1" aria-label="Próximo">${ic('chev')}</button>
        <span class="ig-cont" data-ig-cont>1/${ms.length}</span><div class="ig-dots" data-ig-dots>${ms.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}</div>`;
  }

  function legenda(p) {
    const t = String(p.legenda || '').trim();
    if (!t) return '';
    const corta = t.length > 140;
    return `<div class="ig-leg"><b>${esc(handle)}</b> <span data-ig-curta>${texto(corta ? t.slice(0, 125).trimEnd() + '…' : t)}</span>${corta ? ` <button class="ig-mais" data-ig-mais>mais</button><span data-ig-longa hidden>${texto(t)}</span>` : ''}</div>`;
  }

  function aprovacao(p) {
    if (p.etapa === 'publicado') return '<div class="ig-ap"><p class="ig-msg ok">Este conteúdo já foi publicado.</p></div>';
    const msg = p.etapa === 'aprovado' ? '<p class="ig-msg ok">Você aprovou este conteúdo.</p>'
      : p.etapa === 'ajustes' ? `<p class="ig-msg warn">Você pediu uma alteração${p.ajuste ? `: “${esc(p.ajuste)}”` : '.'}</p>` : '';
    return `<div class="ig-ap">${msg}
      ${previa ? '<p class="lbl" style="margin-bottom:8px">Prévia: o cliente vê estes botões para aprovar ou pedir alteração.</p>' : ''}
      <div class="ig-ap-b"><button class="btn verde" data-ig-aprovar ${p.etapa === 'aprovado' ? 'disabled' : ''}>${ic('check')}Aprovar</button><button class="btn sec" data-ig-ajustar>${ic('edit')}Pedir alteração</button></div>
      <form class="ig-aj" hidden><label for="ig-com">O que você gostaria de mudar?</label><textarea id="ig-com" rows="3" maxlength="1500" placeholder="Ex.: trocar a foto da capa e incluir o horário de funcionamento"></textarea>
        <div class="actions"><button class="btn pri" type="submit">Enviar pedido</button><button class="btn ghost" type="button" data-ig-cancelar>Cancelar</button></div></form>
      <p class="ig-erro" role="alert" hidden></p></div>`;
  }

  function post(p) {
    const f = fmt(p);
    return `<article class="ig-post" role="dialog" aria-modal="true" aria-label="${esc(p.titulo || 'Publicação')}">
      <header class="ig-ph">${avatar()}<div><b>${esc(handle)}</b><small>${esc(f.nome)}${p.publicar ? ' · ' + esc(dataBR(p.publicar)) : ''}</small></div>
        <button class="iconbtn" data-ig-fechar aria-label="Fechar" style="width:40px;height:40px;font-size:18px;box-shadow:none;margin-left:auto">${ic('x')}</button></header>
      ${midia(p)}
      <div class="ig-acts"><button data-ig-curtir aria-label="Curtir">${ic('heart')}</button><span>${ic('comment')}</span><span>${ic('send')}</span><span class="ig-sv">${ic('bookmark')}</span></div>
      ${legenda(p)}
      ${p.publicar ? `<p class="ig-data">${esc(dataBR(p.publicar))}</p>` : ''}
      ${aprovacao(p)}
    </article>`;
  }

  function abrir(id) {
    const p = lista.find((x) => x.id === id);
    if (!p) return;
    estado.aberta = id;
    fechar(false);
    overlay = document.createElement('div');
    overlay.className = 'overlay ig-ov';
    overlay.innerHTML = post(p);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    ligarCarrossel();
    overlay.addEventListener('error', retentar, true);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) fechar(); });
    overlay.addEventListener('click', clicarPost);
    overlay.querySelector('.ig-aj')?.addEventListener('submit', enviarAjuste);
    overlay.querySelector('[data-ig-fechar]')?.focus();
  }

  function fechar(liberar = true) {
    overlay?.remove();
    overlay = null;
    if (liberar) { estado.aberta = null; document.body.style.overflow = ''; }
  }

  function ligarCarrossel() {
    const car = overlay?.querySelector('[data-ig-car]');
    if (!car) return;
    car.addEventListener('scroll', () => {
      const i = Math.round(car.scrollLeft / car.clientWidth);
      overlay.querySelectorAll('[data-ig-dots] i').forEach((d, n) => d.classList.toggle('on', n === i));
      const c = overlay.querySelector('[data-ig-cont]');
      if (c) c.textContent = `${i + 1}/${car.children.length}`;
    }, { passive: true });
  }

  const atual = () => lista.find((x) => x.id === estado.aberta);
  function erro(t) { const e = overlay?.querySelector('.ig-erro'); if (e) { e.textContent = t; e.hidden = !t; } }

  async function responder(acao, comentario = '') {
    const p = atual();
    if (!p) return;
    if (!aoResponder) { erro('Na prévia os botões não enviam nada. O cliente os usa na página de aprovação.'); return; }
    overlay.querySelectorAll('.ig-ap button').forEach((b) => { b.disabled = true; });
    try {
      await aoResponder(p, acao, comentario);
      p.etapa = acao === 'aprovar' ? 'aprovado' : 'ajustes';
      if (acao === 'ajustar') p.ajuste = comentario;
      const id = p.id;
      desenhar();
      abrir(id);
      const ap = overlay?.querySelector('.ig-ap');
      if (ap) ap.insertAdjacentHTML('afterbegin', `<p class="ig-msg ok">${acao === 'aprovar' ? 'Aprovação enviada. Obrigado!' : 'Pedido enviado. A Bôdhi Marketing já foi avisada.'}</p>`);
    } catch (err) {
      overlay.querySelectorAll('.ig-ap button').forEach((b) => { b.disabled = false; });
      erro(err?.message || 'Não foi possível enviar agora. Tente de novo.');
    }
  }

  function enviarAjuste(e) {
    e.preventDefault();
    const t = overlay.querySelector('#ig-com').value.trim();
    if (!t) return erro('Escreva o que você gostaria de mudar.');
    responder('ajustar', t);
  }

  function clicarPost(e) {
    const q = (s) => e.target.closest(s);
    if (q('[data-ig-fechar]')) return fechar();
    if (q('[data-ig-curtir]')) return q('[data-ig-curtir]').classList.toggle('on');
    const seta = q('[data-ig-seta]');
    if (seta) {
      const car = overlay.querySelector('[data-ig-car]');
      const alvo = Math.min(car.children.length - 1, Math.max(0, Math.round(car.scrollLeft / car.clientWidth) + Number(seta.dataset.igSeta)));
      car.scrollTo({ left: alvo * car.clientWidth, behavior: 'smooth' });
      return;
    }
    if (q('[data-ig-mais]')) {
      overlay.querySelector('[data-ig-curta]').hidden = true;
      overlay.querySelector('[data-ig-longa]').hidden = false;
      return q('[data-ig-mais]').remove();
    }
    const tocar = q('[data-ig-tocar]');
    if (tocar) {
      const alvo = tocar.closest('.ig-slide');
      const id = tocar.dataset.igTocar;
      const doDrive = () => { alvo.innerHTML = `<iframe src="${esc(urlPlayer(id))}" allow="autoplay; fullscreen" allowfullscreen title="Vídeo"></iframe>`; };
      if (!config.midiaProxy) return doDrive();
      // Player próprio (Worker do Cloudflare). Se o vídeo não carregar por lá, cai no player do Drive.
      const fonte = `${config.midiaProxy.replace(/\/+$/, '')}/?id=${encodeURIComponent(id)}`;
      alvo.innerHTML = `<video controls autoplay playsinline preload="auto" poster="${esc(tocar.querySelector('img')?.src || '')}" src="${esc(fonte)}"></video>`;
      alvo.querySelector('video').addEventListener('error', doDrive, { once: true });
      return;
    }
    if (q('[data-ig-aprovar]')) return responder('aprovar');
    if (q('[data-ig-ajustar]')) { const f = overlay.querySelector('.ig-aj'); f.hidden = false; f.querySelector('textarea').focus(); return; }
    if (q('[data-ig-cancelar]')) overlay.querySelector('.ig-aj').hidden = true;
  }

  raiz.addEventListener('error', retentar, true);
  raiz.addEventListener('submit', enviarPlano);
  raiz.addEventListener('click', (e) => {
    if (clicarPlano(e)) return;
    const plAbrir = e.target.closest('[data-ig-pl-abrir]');
    if (plAbrir) return abrirPlano(plAbrir.dataset.igPlAbrir);
    const abrirBtn = e.target.closest('[data-ig-abrir]');
    if (abrirBtn) return abrir(abrirBtn.dataset.igAbrir);
    const aba = e.target.closest('[data-ig-aba]');
    if (aba) { estado.aba = aba.dataset.igAba; return desenhar(); }
    const mes = e.target.closest('[data-ig-mes]');
    if (mes) {
      const [a, m] = estado.mes.split('-').map(Number);
      const d = new Date(a, m - 1 + Number(mes.dataset.igMes), 1);
      estado.mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      desenhar();
    }
  });

  fecharAberto?.();
  fecharAberto = () => { fechar(); fecharPlano(); };
  desenhar();
}

// Um único ouvinte de Esc para qualquer feed montado (o painel remonta a tela a cada alteração).
let fecharAberto = null;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharAberto?.(); });
