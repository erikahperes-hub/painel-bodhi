import { config } from './config.js?v=189';
import { logo } from './logo.js?v=189';
import { esc } from './util.js?v=189';
import { flor } from './icons.js?v=189';
import { pagina, conversa, indicacoes } from './links-dados.js?v=189';

// Link na bio público (sem login). Só GRAVA no banco, por duas funções (supabase/linkbio.sql):
// linkbio_clique (conta cliques) e linkbio_lead (contato vira lead no painel). Nunca lê nada.
const local = ['localhost', '127.0.0.1'].includes(location.hostname);

const I = {
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>',
  tiktok: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2.2 4.3 5 4.6"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V16M8 7.5v.01M12 16v-5.5M12 13c0-1.7 1-2.6 2.3-2.6S16.5 11.2 16.5 13v3"/>',
  site: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  fora: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  chat: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/><path d="M8.5 9.5h7M8.5 12.5h4"/>',
  zap: '<path d="M4 20l1.3-3.9A8.5 8.5 0 1 1 8 18.8z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 1c-1.3-.5-2.4-1.6-2.9-2.9l1-1-1-2z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  send: '<path d="M3.5 11 20 4l-4.5 16-4.5-6.5z"/><path d="M11 13.5 20 4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
};
const ic = (n, extra = '') => `<svg class="ic ${extra}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;
const COR = { verde: '#23BB84', coral: '#E96A6A', petroleo: '#073F56', grafite: '#292B2D' };
const OPOSTA = { verde: ['#FFFCF6', '#073F56'], coral: ['#FFFCF6', '#292B2D'], petroleo: ['#23BB84', '#E96A6A'], grafite: ['#E96A6A', '#23BB84'] };

// ---------- Banco (gravação silenciosa: se falhar, a página segue funcionando) ----------
async function rpc(nome, corpo) {
  if (local && !location.search.includes('gravar')) { console.info('[link na bio, teste local]', nome, corpo); return true; }
  const r = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${nome}`, {
    method: 'POST', keepalive: true,
    headers: { apikey: config.supabaseKey, Authorization: `Bearer ${config.supabaseKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`rpc ${nome}: ${r.status}`);
  return r.status === 204 ? true : r.json();
}
const clique = (botao) => rpc('linkbio_clique', { p_pagina: pagina.id, p_botao: botao }).catch(() => {});

const zapLink = (texto) => `https://wa.me/${pagina.whatsapp}?text=${encodeURIComponent(texto)}`;

// ---------- Página ----------
function render() {
  const avatar = logo('claro', '#073F56');
  const zap = pagina.whatsapp ? `<a class="lk zap" href="${zapLink('Oi! Vim pelo link na bio da Bôdhi Marketing.')}" target="_blank" rel="noopener" data-clique="WhatsApp">
      <span class="ico">${ic('zap')}</span><span><b>Falar no WhatsApp</b><small>Resposta em horário comercial</small></span>${ic('seta', 'fim')}</a>` : '';

  document.getElementById('app').innerHTML = `
  <div class="fundo" aria-hidden="true"><span class="f1"></span><span class="f2"></span><span class="f3"></span></div>
  <main class="pg">
    <header class="topo">
      <div class="avatar">${avatar}</div>
      <h1>${esc(pagina.nome)}</h1>
      <p class="frase">${esc(pagina.frase)}</p>
      <p class="sub">${esc(pagina.sub)}</p>
      <nav class="redes" aria-label="Redes sociais">${pagina.redes.map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener" aria-label="${esc(r.rotulo)}" title="${esc(r.rotulo)}" data-clique="${esc(r.rotulo)}">${ic(r.tipo)}</a>`).join('')}</nav>
    </header>

    <button class="chamada" id="abrir-chat" type="button">
      <span class="bolha">${ic('chat')}</span>
      <span><b>${esc(pagina.chamada.titulo)}</b><small>${esc(pagina.chamada.texto)}</small></span>
      <span class="seta">${ic('seta')}</span>
    </button>

    <section class="secao" aria-labelledby="t-serv">
      <h2 id="t-serv">Serviços</h2>
      <div class="carrossel">${pagina.servicos.map((s) => {
        const [a, b] = OPOSTA[s.cor] || OPOSTA.verde;
        return `<a class="serv c-${s.cor}" href="${esc(s.url)}" target="_blank" rel="noopener" data-clique="Serviço: ${esc(s.titulo)}">
          <span class="forma">${flor(a, b)}</span>
          <b>${esc(s.titulo)}</b>
          <div style="position:relative;z-index:1"><span>${esc(s.texto)}</span><em>Ver mais ${ic('seta')}</em></div>
        </a>`;
      }).join('')}</div>
    </section>

    <section class="secao" aria-labelledby="t-met">
      <h2 id="t-met">Como trabalhamos</h2>
      <div class="metodo">
        <h3>${esc(pagina.metodo.titulo)}</h3>
        <p>${esc(pagina.metodo.texto)}</p>
        <div class="fases">${pagina.metodo.fases.map((f) => `<div class="fase"><i style="background:${COR[f.cor]}"></i><div><b>${esc(f.nome)}</b><span>${esc(f.texto)}</span></div></div>`).join('')}</div>
      </div>
    </section>

    <section class="secao" aria-labelledby="t-links">
      <h2 id="t-links">Links</h2>
      <div class="links">
        ${zap}
        ${pagina.links.map((l) => `<a class="lk" href="${esc(l.url)}" target="_blank" rel="noopener" data-clique="${esc(l.rotulo)}">
          <span class="ico">${ic('site')}</span><span><b>${esc(l.rotulo)}</b><small>${esc(l.texto)}</small></span>${ic('fora', 'fim')}</a>`).join('')}
      </div>
    </section>

    <footer class="rodape">${logo('verde', '#FFFCF6')}<span>Bôdhi Marketing · São Paulo</span></footer>
  </main>

  <div class="chat" id="chat" role="dialog" aria-modal="true" aria-labelledby="chat-nome" aria-hidden="true">
    <div class="janela">
      <div class="chat-h">
        <div class="mini">${logo('claro', '#073F56')}</div>
        <div><b id="chat-nome">${esc(pagina.nome)}</b><small>Online</small></div>
        <button class="fechar" type="button" aria-label="Fechar conversa" id="fechar-chat">${ic('x')}</button>
      </div>
      <div class="progresso" aria-hidden="true"><i id="barra"></i></div>
      <div class="msgs" id="msgs" aria-live="polite"></div>
      <form class="entrada" id="entrada" hidden>
        <input id="texto" autocomplete="given-name" maxlength="60" aria-label="Sua resposta">
        <button class="enviar" type="submit" aria-label="Enviar" disabled>${ic('send')}</button>
      </form>
    </div>
  </div>`;

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-clique]');
    if (a) clique(a.dataset.clique);
  });
  document.getElementById('abrir-chat').addEventListener('click', () => { clique('Conversa: abriu'); abrir(); });
  document.getElementById('fechar-chat').addEventListener('click', () => history.state?.chat ? history.back() : fechar());
  document.getElementById('chat').addEventListener('click', (e) => { if (e.target.id === 'chat') document.getElementById('fechar-chat').click(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && aberto()) document.getElementById('fechar-chat').click(); });
  window.addEventListener('popstate', () => { if (aberto()) fechar(); });
}

// ---------- Conversa ----------
let estado = null;
const $ = (id) => document.getElementById(id);
const aberto = () => $('chat').classList.contains('on');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const rolar = () => { const m = $('msgs'); m.scrollTop = m.scrollHeight; };
const total = conversa.perguntas.length + 1;
const progresso = (n) => { $('barra').style.width = `${Math.round((n / total) * 100)}%`; };

function abrir() {
  $('chat').classList.add('on');
  $('chat').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  history.pushState({ chat: 1 }, '');
  if (!estado || estado.fim) iniciar();
}
function fechar() {
  $('chat').classList.remove('on');
  $('chat').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  $('abrir-chat').focus();
}

function bolha(texto, quem = 'dela') {
  const d = document.createElement('div');
  d.className = `msg ${quem}`;
  d.textContent = texto;
  $('msgs').appendChild(d);
  rolar();
}
async function digita(texto, ms = 650) {
  const d = document.createElement('div');
  d.className = 'msg dela digitando';
  d.innerHTML = '<i></i><i></i><i></i>';
  d.setAttribute('aria-label', 'Digitando');
  $('msgs').appendChild(d); rolar();
  await espera(ms);
  d.remove();
  bolha(texto);
}
const preencher = (t) => t.replace('{nome}', estado.respostas.nome || '');

async function iniciar() {
  estado = { passo: 0, respostas: {}, pontos: {}, fim: false };
  $('msgs').innerHTML = '';
  progresso(0);
  await digita(conversa.boasVindas, 500);
  perguntar();
}

async function perguntar() {
  const p = conversa.perguntas[estado.passo];
  if (!p) return pedirContato();
  await digita(preencher(p.texto));
  if (p.tipo === 'texto') return pedirTexto(p);
  const box = document.createElement('div');
  box.className = 'opcoes';
  box.innerHTML = `<small>Escolha uma opção</small>${p.opcoes.map((o, i) => `<button class="op" type="button" data-i="${i}">${esc(o.rotulo)}${ic('seta')}</button>`).join('')}`;
  $('msgs').appendChild(box); rolar();
  box.querySelector('.op').focus({ preventScroll: true });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.op'); if (!b) return;
    const o = p.opcoes[Number(b.dataset.i)];
    box.remove();
    responder(p.id, o.rotulo, o.pontos);
  });
}

function pedirTexto(p) {
  const f = $('entrada'), inp = $('texto'), btn = f.querySelector('.enviar');
  f.hidden = false; inp.value = ''; inp.placeholder = p.placeholder || 'Digite aqui'; btn.disabled = true;
  inp.focus();
  inp.oninput = () => { btn.disabled = !inp.value.trim(); };
  f.onsubmit = (e) => {
    e.preventDefault();
    const v = inp.value.trim().replace(/\s+/g, ' ').split(' ')
      .map((w) => (/^(da|de|do|das|dos|e)$/i.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
    if (!v) return;
    f.hidden = true; f.onsubmit = null;
    responder(p.id, v.split(' ')[0], null, v);
  };
}

function responder(id, rotulo, pontos, valorCompleto) {
  bolha(rotulo, 'eu');
  estado.respostas[id] = rotulo;
  if (id === 'nome') estado.nomeCompleto = valorCompleto || rotulo;
  for (const [k, v] of Object.entries(pontos || {})) estado.pontos[k] = (estado.pontos[k] || 0) + v;
  estado.passo++;
  progresso(estado.passo);
  perguntar();
}

function indicacao() {
  const ordem = Object.keys(indicacoes);
  let melhor = ordem[0], max = -1;
  for (const k of ordem) if ((estado.pontos[k] || 0) > max) { max = estado.pontos[k] || 0; melhor = k; }
  return { id: melhor, ...indicacoes[melhor] };
}

const mascara = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
};

async function pedirContato() {
  await digita(`Pronto, ${estado.respostas.nome}! Já tenho a sua indicação.`, 700);
  const c = document.createElement('form');
  c.className = 'cartao';
  c.noValidate = true;
  c.innerHTML = `<h3>${esc(conversa.contato.titulo)}</h3><p>${esc(conversa.contato.texto)}</p>
    <label class="campo"><span>Nome</span><input name="nome" autocomplete="name" maxlength="80" value="${esc(estado.nomeCompleto || '')}"></label>
    <label class="campo"><span>WhatsApp</span><input name="whatsapp" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="(11) 99999-9999"></label>
    <label class="campo"><span>Instagram (opcional)</span><input name="instagram" autocomplete="off" autocapitalize="none" maxlength="60" placeholder="@seuperfil"></label>
    <p class="erro" role="alert"></p>
    <button class="btn" type="submit">Ver minha indicação ${ic('seta')}</button>
    <p class="privacidade">Seus dados ficam só com a Bôdhi Marketing, para entrar em contato sobre a sua indicação. Para pedir a exclusão, é só falar com a gente.</p>`;
  $('msgs').appendChild(c); rolar();
  const zap = c.elements.whatsapp;
  zap.addEventListener('input', () => { zap.value = mascara(zap.value); zap.removeAttribute('aria-invalid'); });
  setTimeout(() => (c.elements.nome.value ? zap : c.elements.nome).focus({ preventScroll: true }), 50);

  c.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = c.elements.nome.value.trim();
    const numero = zap.value.replace(/\D/g, '');
    let ig = c.elements.instagram.value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '');
    if (ig && !ig.startsWith('@')) ig = '@' + ig;
    const erro = c.querySelector('.erro');
    if (!nome) { erro.textContent = 'Conta pra gente o seu nome.'; c.elements.nome.focus(); return; }
    if (numero.length < 10) { erro.textContent = 'Confira o WhatsApp com DDD.'; zap.setAttribute('aria-invalid', 'true'); zap.focus(); return; }
    erro.textContent = '';
    const btn = c.querySelector('.btn'); btn.disabled = true; btn.textContent = 'Enviando...';
    const ind = indicacao();
    const { nome: _n, ...respostas } = estado.respostas;
    try {
      await rpc('linkbio_lead', { p_pagina: pagina.id, p_dados: { nome, whatsapp: '55' + numero, instagram: ig, respostas, indicacao: ind.titulo } });
    } catch (err) { console.warn('Contato não gravado', err); }
    clique('Conversa: concluiu');
    c.remove();
    bolha(`${nome.split(' ')[0]} · ${zap.value}${ig ? ' · ' + ig : ''}`, 'eu');
    progresso(total);
    mostrarResultado(ind, nome);
  });
}

async function mostrarResultado(ind, nome) {
  estado.fim = true;
  await digita('Analisei as suas respostas. Esta é a nossa indicação para você:', 900);
  const serv = pagina.servicos.find((s) => s.id === ind.servico);
  const r = estado.respostas;
  const msg = `Oi! Sou ${nome}, vim pelo link na bio. Meu momento: ${r.momento}. Maior desafio: ${r.desafio}. Segmento: ${r.segmento}. A indicação foi "${ind.titulo}" e quero saber mais.`;
  const d = document.createElement('div');
  d.className = 'resultado';
  d.innerHTML = `<div class="capa"><small>Indicação para você</small><h3>${esc(ind.titulo)}</h3>${flor('#23BB84', '#E96A6A')}</div>
    <div class="corpo"><p>${esc(ind.texto)}</p>
      ${pagina.whatsapp ? `<a class="btn verde" href="${zapLink(msg)}" target="_blank" rel="noopener" data-clique="Conversa: WhatsApp">${ic('zap')} Conversar com a Bôdhi Marketing</a>` : `<p class="privacidade" style="text-align:left;margin-top:12px">Recebemos o seu contato. A Bôdhi Marketing vai te chamar no WhatsApp em breve.</p>`}
      ${serv ? `<a class="btn sec" href="${esc(serv.url)}" target="_blank" rel="noopener" data-clique="Conversa: ver serviço">Conhecer o serviço ${ic('fora')}</a>` : ''}
    </div>`;
  $('msgs').appendChild(d);
  await espera(30);
  d.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

render();
