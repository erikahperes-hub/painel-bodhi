import { store } from './store.js';
import { logo } from './logo.js';
import { ic, flor } from './icons.js';
import { esc, toast, debounce } from './util.js';
import { alertas } from './calc.js';
import { buscar, htmlResultados } from './search.js';
import { temModal, fecharTopo, formulario } from './ui.js';

import inicio from './views/inicio.js';
import comercial from './views/comercial.js';
import clientes from './views/clientes.js';
import propostas from './views/propostas.js';
import contratos from './views/contratos.js';
import financeiro from './views/financeiro.js';
import prospeccao from './views/prospeccao.js';
import configuracoes from './views/configuracoes.js';

const VIEWS = { inicio, comercial, clientes, propostas, contratos, financeiro, prospeccao, configuracoes };
const NAV = [
  ['inicio', 'Início', 'home'], ['comercial', 'Comercial', 'bars'], ['clientes', 'Clientes', 'users'],
  ['propostas', 'Propostas', 'send'], ['contratos', 'Contratos', 'doc'], ['financeiro', 'Financeiro', 'wallet'], ['prospeccao', 'Prospecção', 'target'],
];
const ACOES = Object.assign({}, ...Object.values(VIEWS).map((v) => v.acoes || {}));
ACOES.ir = (el) => { fecharPopovers(); location.hash = `#/${el.dataset.rota}${el.dataset.ref ? '/' + el.dataset.ref : ''}`; };

const app = document.getElementById('app');
let rotaAtual = { rota: 'inicio', ref: '' };

function lerRota() {
  const [rota, ref] = location.hash.replace(/^#\/?/, '').split('/');
  return { rota: VIEWS[rota] ? rota : 'inicio', ref: ref || '' };
}

/* ---------- Telas de entrada ---------- */
function telaLogin() {
  app.innerHTML = `<div class="login"><div class="login-art" role="img" aria-label="Padrão xadrez ondulado da Bôdhi"></div>
    <form class="login-box" novalidate>${logo('verde', '#FFFCF6')}
      <h1>Oi, Bôdhi</h1><p>Entre para ver clientes, propostas, contratos e o financeiro em um só lugar.</p>
      <div class="field"><label for="le">E-mail</label><input id="le" type="email" autocomplete="username" required></div>
      <div class="field"><label for="ls">Senha</label><input id="ls" type="password" autocomplete="current-password" required></div>
      <div class="err-msg" role="alert" hidden></div>
      <button class="btn pri" type="submit" style="width:100%;padding:15px">Entrar</button>
      <button class="btn ghost" type="button" data-esqueci style="margin-top:10px;align-self:flex-start">Esqueci minha senha</button>
    </form></div>`;
  const form = app.querySelector('form');
  const erro = app.querySelector('.err-msg');
  const mostrar = (t) => { erro.textContent = t; erro.hidden = !t; };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mostrar('');
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Entrando…';
    try { await store.entrar(form.le.value.trim(), form.ls.value); abrirApp(); }
    catch (err) { mostrar(err.message); btn.disabled = false; btn.textContent = 'Entrar'; }
  });
  form.querySelector('[data-esqueci]').addEventListener('click', async () => {
    const email = form.le.value.trim();
    if (!email) return mostrar('Digite seu e-mail acima e clique de novo.');
    try { await store.recuperarSenha(email); mostrar(''); toast('Enviamos um e-mail para você redefinir a senha'); } catch (err) { mostrar(err.message); }
  });
  form.le.focus();
}

function telaConfigurar() {
  app.innerHTML = `<div class="setup"><div class="card">${logo('verde', '#FFFFFF').replace('class="logo-svg"', 'class="logo-svg" style="width:130px;margin-bottom:22px"')}
    <h1 style="font:700 28px var(--display);margin-bottom:8px">Quase lá</h1>
    <p style="color:var(--ink-2)">O painel ainda não está conectado a um banco de dados, e por segurança os dados de clientes não ficam dentro do site. Siga o passo a passo do arquivo <b>LEIA-ME.md</b> (passo 2) para conectar o Supabase e criar o login das sócias.</p></div></div>`;
}

function telaErro(msg) {
  app.innerHTML = `<div class="setup"><div class="card">${flor()}<h1 style="font:700 24px var(--display);margin:10px 0 6px">Não consegui abrir o painel</h1><p style="color:var(--ink-2);margin-bottom:16px">${esc(msg)}</p><button class="btn pri" onclick="location.reload()">Tentar de novo</button></div></div>`;
}

/* ---------- Estrutura do painel ---------- */
const inicialUsuario = () => (store.nomeUsuario() || store.emailUsuario() || 'B')[0].toUpperCase();

function perguntarNome() {
  formulario({
    titulo: 'Como devemos te chamar?',
    subtitulo: 'Seu nome aparece na saudação do painel. Você pode mudar depois em Configurações.',
    campos: [{ nome: 'nome', rotulo: 'Seu nome', obrigatorio: true, cheio: true, placeholder: 'Milena' }],
    valores: {},
    salvarTexto: 'Salvar',
    async aoSalvar(v) { await store.definirNome(v.nome); toast(`Prazer, ${v.nome}!`); },
  });
}

function abrirApp() {
  const inicial = inicialUsuario();
  app.innerHTML = `<div class="shell">
    <div class="logo-cell"><a href="#/inicio" aria-label="Início">${logo('verde', '#F3EEE2')}</a></div>
    <header class="head">
      <div class="head-t"><h1 id="t"></h1><p id="s"></p></div>
      <div class="head-r">
        ${store.modo === 'local' ? '<span class="chip mute" title="Os dados ficam só neste navegador">Modo local</span>' : ''}
        <div class="search" role="search"><div class="search-box"><input id="q" type="search" placeholder="Buscar clientes, propostas, contratos…" autocomplete="off" aria-label="Buscar" aria-controls="res" aria-expanded="false"><span class="kbd" aria-hidden="true">/</span><button class="search-go" aria-label="Buscar" tabindex="-1">${ic('search')}</button></div><div class="results" id="res" role="listbox" hidden></div></div>
        <div class="rel"><button class="iconbtn" id="sino" aria-label="Alertas" aria-haspopup="true">${ic('bell')}<span class="dot" hidden></span></button><div class="pop" id="pop" hidden></div></div>
      </div>
    </header>
    <aside class="side"><nav class="pill" aria-label="Seções">
      ${NAV.map(([r, nome, i]) => `<button class="nb" data-act="ir" data-rota="${r}" data-tip="${nome}" aria-label="${nome}">${ic(i)}</button>`).join('')}
      <span class="grow"></span>
      <button class="nb" data-act="ir" data-rota="configuracoes" data-tip="Configurações" aria-label="Configurações">${ic('sliders')}</button>
      ${store.modo === 'supabase' ? `<button class="nb desk" data-act="sair" data-tip="Sair" aria-label="Sair">${ic('logout')}</button>` : ''}
      <div class="avatar desk" title="${esc(store.emailUsuario() || 'Modo local')}">${esc(inicial)}</div>
    </nav></aside>
    <main id="view" tabindex="-1"></main></div>`;

  ligarBusca();
  ligarSino();
  atualizarSino();
  renderRota(true);
  store.ouvir(() => {
    renderRota(false);
    atualizarSino();
    const av = document.querySelector('.avatar');
    if (av) av.textContent = inicialUsuario();
  });
  if (store.modo === 'supabase' && !store.nomeUsuario()) perguntarNome();
}

function renderRota(rolar) {
  rotaAtual = lerRota();
  const v = VIEWS[rotaAtual.rota];
  const view = document.getElementById('view');
  document.getElementById('t').textContent = v.titulo();
  document.getElementById('s').textContent = v.sub();
  document.title = `${rotaAtual.rota === 'inicio' ? 'Início' : v.titulo()} · Painel Bôdhi`;
  const y = window.scrollY;
  view.innerHTML = v.render({ ref: rotaAtual.ref });
  v.montar?.(view);
  document.querySelectorAll('.nb[data-rota]').forEach((b) => b.classList.toggle('on', b.dataset.rota === rotaAtual.rota));
  window.scrollTo(0, rolar ? 0 : y);
}

/* ---------- Busca ---------- */
function ligarBusca() {
  const q = document.getElementById('q');
  const box = document.getElementById('res');
  let lista = [], sel = 0;
  const abrir = (i) => {
    const r = lista[i];
    if (!r) return;
    fechar();
    q.value = '';
    location.hash = `#/${r.rota}${r.ref ? '/' + r.ref : ''}`;
  };
  const fechar = () => { box.hidden = true; q.setAttribute('aria-expanded', 'false'); };
  const pintar = () => { box.innerHTML = htmlResultados(lista, q.value, sel); box.hidden = false; q.setAttribute('aria-expanded', 'true'); box.querySelector('.res.sel')?.scrollIntoView({ block: 'nearest' }); };
  const rodar = debounce(() => {
    if (!q.value.trim()) return fechar();
    lista = buscar(q.value); sel = 0; pintar();
  }, 90);
  q.addEventListener('input', rodar);
  q.addEventListener('focus', () => { if (q.value.trim()) rodar(); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && lista.length) { e.preventDefault(); sel = (sel + 1) % lista.length; pintar(); }
    else if (e.key === 'ArrowUp' && lista.length) { e.preventDefault(); sel = (sel - 1 + lista.length) % lista.length; pintar(); }
    else if (e.key === 'Enter') { e.preventDefault(); abrir(sel); }
    else if (e.key === 'Escape') { fechar(); q.blur(); }
  });
  box.addEventListener('mousedown', (e) => { const r = e.target.closest('.res'); if (r) { e.preventDefault(); abrir(Number(r.dataset.i)); } });
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('.search')) fechar(); });
  document.addEventListener('keydown', (e) => {
    const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.key === '/' && !digitando && !temModal()) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); q.focus(); q.select(); }
    if (e.key === 'Escape' && temModal()) fecharTopo();
  });
}

/* ---------- Alertas (sino) ---------- */
function fecharPopovers() { const p = document.getElementById('pop'); if (p) p.hidden = true; }

function atualizarSino() {
  const n = alertas().filter((a) => a.tipo !== 'mute').length;
  const dot = document.querySelector('#sino .dot');
  if (dot) dot.hidden = n === 0;
}

function ligarSino() {
  const sino = document.getElementById('sino');
  const pop = document.getElementById('pop');
  sino.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!pop.hidden) return (pop.hidden = true);
    const al = alertas().slice(0, 8);
    pop.innerHTML = `<h3>${al.length ? 'Pede atenção' : 'Tudo em dia'}</h3><div class="list">${al.map((a) => `<div class="li click" data-act="ir" data-rota="${a.rota}" data-ref="${esc(a.ref || '')}"><span class="li-ic ${a.tipo === 'warn' ? 'ic-coral' : a.tipo === 'info' ? 'ic-pet' : 'ic-graf'}">${ic(a.icone)}</span><div class="li-t"><b>${esc(a.titulo)}</b><span>${esc(a.texto)}</span></div></div>`).join('') || '<p class="lbl" style="padding:6px">Nada pendente por aqui.</p>'}</div>`;
    pop.hidden = false;
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.rel')) pop.hidden = true; });
}

/* ---------- Ações globais ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACOES[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  if (el.classList.contains('nb')) {
    document.querySelectorAll('.nb.flash').forEach((b) => b.classList.remove('flash'));
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1600);
  }
  Promise.resolve().then(() => fn(el)).catch((err) => toast(err?.message || 'Algo deu errado. Tente de novo.', true));
});
document.addEventListener('acionar', (e) => {
  Promise.resolve().then(() => ACOES[e.detail.acao]?.({ dataset: e.detail.dados })).catch((err) => toast(err?.message || 'Algo deu errado.', true));
});
window.addEventListener('hashchange', () => { if (document.getElementById('view')) renderRota(true); });

/* ---------- Início ---------- */
(async () => {
  app.innerHTML = '<div class="setup"><p class="lbl" style="text-align:center;margin-top:30vh">Abrindo o painel…</p></div>';
  try {
    const estado = await store.iniciar();
    if (estado === 'login') return telaLogin();
    if (estado === 'configurar') return telaConfigurar();
    abrirApp();
  } catch (err) {
    console.error(err);
    telaErro('Verifique sua conexão com a internet e tente novamente.');
  }
})();
