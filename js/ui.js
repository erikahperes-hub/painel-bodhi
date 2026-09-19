import { esc, toast, reduzirImagem, urlSegura } from './util.js?v=13';
import { ic } from './icons.js?v=13';

let pilha = [];

export function abrirModal({ titulo, subtitulo = '', corpo = '', largo = false, aoAbrir, aoFechar }) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal ${largo ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
    <div class="modal-h"><div><h2>${esc(titulo)}</h2>${subtitulo ? `<p>${esc(subtitulo)}</p>` : ''}</div>
    <button class="iconbtn" data-fechar aria-label="Fechar" style="width:40px;height:40px;font-size:18px">${ic('x')}</button></div>
    <div class="modal-corpo">${corpo}</div></div>`;
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
  const anterior = document.activeElement;
  const api = {
    el: ov.querySelector('.modal'),
    corpo: ov.querySelector('.modal-corpo'),
    fechar() {
      ov.remove();
      pilha = pilha.filter((x) => x !== api);
      if (!pilha.length) document.body.style.overflow = '';
      anterior?.focus?.();
      aoFechar?.();
    },
  };
  ov.addEventListener('mousedown', (e) => { if (e.target === ov && !api.travado) api.fechar(); });
  ov.querySelector('[data-fechar]').addEventListener('click', () => api.fechar());
  pilha.push(api);
  aoAbrir?.(api);
  const primeiro = ov.querySelector('input:not([type=hidden]):not([type=file]),textarea,select');
  primeiro?.focus();
  return api;
}

export function fecharTopo() { pilha[pilha.length - 1]?.fechar(); }
export const temModal = () => pilha.length > 0;

export function confirmar(mensagem, textoOk = 'Confirmar', perigo = false) {
  return new Promise((resolve) => {
    let resolvido = false;
    const fim = (v) => { if (!resolvido) { resolvido = true; resolve(v); } };
    const m = abrirModal({
      titulo: 'Tem certeza?', subtitulo: mensagem,
      corpo: `<div class="modal-f" style="justify-content:flex-end;margin-top:6px"><button class="btn sec" data-nao>Cancelar</button><button class="btn pri" data-sim>${esc(textoOk)}</button></div>`,
      aoFechar: () => fim(false),
    });
    m.el.querySelector('[data-nao]').onclick = () => m.fechar();
    m.el.querySelector('[data-sim]').onclick = () => { fim(true); m.fechar(); };
  });
}

const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const set = (o, path, v) => {
  const ks = path.split('.');
  ks.slice(0, -1).reduce((a, k) => (a[k] ??= {}), o)[ks.at(-1)] = v;
};

function pacoteLinha(p = {}) {
  return `<div class="rowfm" data-pacote>
    <input data-p="nome" placeholder="Nome do pacote" value="${esc(p.nome ?? '')}" aria-label="Nome do pacote">
    <input data-p="preco" type="number" min="0" step="0.01" placeholder="Valor" value="${esc(p.preco ?? '')}" aria-label="Valor">
    <input data-p="desc" class="desc" placeholder="O que inclui" value="${esc(p.desc ?? '')}" aria-label="Descrição">
    <button type="button" class="iconbtn" data-rm style="width:40px;height:40px;font-size:16px;box-shadow:none;border:1px solid var(--line)" aria-label="Remover pacote">${ic('trash')}</button>
  </div>`;
}

export const TIPOS_DOC = ['Proposta', 'Contrato', 'Rescisão', 'Notas fiscais', 'Pasta no Drive', 'Briefing', 'Outro'];

function docLinha(d = {}) {
  return `<div class="rowdoc" data-doc>
    <select data-d="tipo" aria-label="Tipo">${TIPOS_DOC.map((t) => `<option${t === (d.tipo || 'Proposta') ? ' selected' : ''}>${t}</option>`).join('')}</select>
    <input data-d="titulo" placeholder="Nome (ex.: Proposta enviada)" value="${esc(d.titulo ?? '')}" aria-label="Nome do documento">
    <input data-d="url" type="url" placeholder="Link (Canva, Drive, WhatsApp…)" value="${esc(d.url ?? '')}" aria-label="Link">
    <button type="button" class="iconbtn" data-rm-doc style="width:40px;height:40px;font-size:16px;box-shadow:none;border:1px solid var(--line)" aria-label="Remover documento">${ic('trash')}</button>
  </div>`;
}

function campoHTML(c, valor) {
  const id = 'f_' + c.nome.replace(/\W/g, '_');
  const cls = 'field' + (c.cheio ? ' full' : '');
  const rot = `<label for="${id}">${esc(c.rotulo)}${c.obrigatorio ? ' *' : ''}</label>`;
  const ajuda = c.ajuda ? `<span class="help">${esc(c.ajuda)}</span>` : '';
  const ph = c.placeholder ? ` placeholder="${esc(c.placeholder)}"` : '';
  const v = valor ?? '';
  switch (c.tipo) {
    case 'area':
      return `<div class="${cls}">${rot}<textarea id="${id}" name="${c.nome}"${ph} rows="${c.linhas || 4}">${esc(v)}</textarea>${ajuda}</div>`;
    case 'lista':
      return `<div class="${cls}">${rot}<textarea id="${id}" name="${c.nome}" data-lista${ph} rows="${c.linhas || 5}">${esc(Array.isArray(valor) ? valor.join('\n') : v)}</textarea><span class="help">${esc(c.ajuda || 'Um item por linha.')}</span></div>`;
    case 'select':
      return `<div class="${cls}">${rot}<select id="${id}" name="${c.nome}">${c.opcoes.map((o) => `<option value="${esc(o.v)}"${String(o.v) === String(v) ? ' selected' : ''}>${esc(o.t)}</option>`).join('')}</select>${ajuda}</div>`;
    case 'numero':
    case 'dinheiro':
      return `<div class="${cls}">${rot}<input id="${id}" name="${c.nome}" type="number" inputmode="decimal" min="0" step="${c.tipo === 'dinheiro' ? '0.01' : '1'}" value="${esc(v)}"${ph}>${ajuda}</div>`;
    case 'data':
      return `<div class="${cls}">${rot}<input id="${id}" name="${c.nome}" type="date" value="${esc(v)}">${ajuda}</div>`;
    case 'secao':
      return `<div class="field full" style="margin-top:8px;padding-top:14px;border-top:1px solid var(--line)"><h3 style="font:700 15px var(--ui)">${esc(c.rotulo)}</h3></div>`;
    case 'checkbox':
      return `<div class="${cls}"><label style="display:flex;gap:10px;align-items:center;font-size:14.5px;color:var(--ink)"><input type="checkbox" name="${c.nome}" ${valor ? 'checked' : ''} style="width:20px;height:20px;min-height:0;accent-color:var(--verde)">${esc(c.rotulo)}</label>${ajuda}</div>`;
    case 'pacotes': {
      const linhas = (Array.isArray(valor) && valor.length ? valor : [{}]).map(pacoteLinha).join('');
      return `<div class="${cls}" data-pacotes="${c.nome}"><label>${esc(c.rotulo)}</label><div class="rows">${linhas}</div>
        <button type="button" class="btn sec sm" data-add-pacote style="align-self:flex-start;margin-top:4px">${ic('plus')}Adicionar pacote</button>${ajuda}</div>`;
    }
    case 'docs': {
      const linhas = (Array.isArray(valor) && valor.length ? valor : [{}]).map(docLinha).join('');
      return `<div class="${cls}" data-docs="${c.nome}"><label>${esc(c.rotulo)}</label><div class="rows">${linhas}</div>
        <button type="button" class="btn sec sm" data-add-doc style="align-self:flex-start;margin-top:4px">${ic('plus')}Adicionar documento</button>${ajuda}</div>`;
    }
    case 'imagem':
      return `<div class="${cls}"><label>${esc(c.rotulo)}</label><div class="imgpick" data-imagem="${c.nome}">
        <div class="prev">${valor ? `<img src="${esc(valor)}" alt="">` : ic('image')}</div>
        <input type="hidden" name="${c.nome}" value="${esc(valor || '')}">
        <input type="file" accept="image/*" hidden>
        <button type="button" class="btn sec sm" data-escolher>Escolher imagem</button>
        <button type="button" class="btn ghost sm" data-tirar ${valor ? '' : 'hidden'}>Remover</button></div>${ajuda}</div>`;
    default:
      return `<div class="${cls}">${rot}<input id="${id}" name="${c.nome}" type="${c.tipo === 'email' ? 'email' : 'text'}" value="${esc(v)}"${ph}${c.obrigatorio ? ' required' : ''}>${ajuda}</div>`;
  }
}

function coletar(form, campos) {
  const out = {};
  for (const c of campos) {
    if (c.tipo === 'pacotes') {
      const linhas = [...form.querySelectorAll(`[data-pacotes="${c.nome}"] [data-pacote]`)];
      set(out, c.nome, linhas.map((l) => ({
        nome: l.querySelector('[data-p=nome]').value.trim(),
        preco: Number(l.querySelector('[data-p=preco]').value) || 0,
        desc: l.querySelector('[data-p=desc]').value.trim(),
      })).filter((p) => p.nome));
      continue;
    }
    if (c.tipo === 'docs') {
      const linhas = [...form.querySelectorAll(`[data-docs="${c.nome}"] [data-doc]`)];
      set(out, c.nome, linhas.map((l) => ({
        tipo: l.querySelector('[data-d=tipo]').value,
        titulo: l.querySelector('[data-d=titulo]').value.trim(),
        url: urlSegura(l.querySelector('[data-d=url]').value),
      })).filter((d) => d.url));
      continue;
    }
    const el = form.elements[c.nome];
    if (!el) continue;
    let v;
    if (c.tipo === 'checkbox') v = el.checked;
    else if (c.tipo === 'lista') v = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
    else if (c.tipo === 'numero' || c.tipo === 'dinheiro') v = el.value === '' ? null : Number(el.value);
    else v = typeof el.value === 'string' ? el.value.trim() : el.value;
    set(out, c.nome, v);
  }
  return out;
}

export function formulario({ titulo, subtitulo, campos, valores = {}, salvarTexto = 'Salvar', aoSalvar, aoExcluir, largo = false, extras = '' }) {
  const corpo = `<form class="form" novalidate>${campos.map((c) => campoHTML(c, get(valores, c.nome))).join('')}
    <div class="modal-f full" style="grid-column:1/-1">
      <div>${aoExcluir ? `<button type="button" class="btn ghost danger" data-excluir>${ic('trash')}Excluir</button>` : ''}${extras}</div>
      <div class="actions"><button type="button" class="btn sec" data-cancelar>Cancelar</button><button type="submit" class="btn pri">${esc(salvarTexto)}</button></div>
    </div></form>`;
  const m = abrirModal({ titulo, subtitulo, corpo, largo });
  const form = m.el.querySelector('form');

  form.addEventListener('click', async (e) => {
    if (e.target.closest('[data-cancelar]')) return m.fechar();
    if (e.target.closest('[data-excluir]')) return aoExcluir(m);
    if (e.target.closest('[data-add-pacote]')) {
      const rows = e.target.closest('[data-pacotes]').querySelector('.rows');
      rows.insertAdjacentHTML('beforeend', pacoteLinha());
      rows.lastElementChild.querySelector('input').focus();
    }
    const rm = e.target.closest('[data-rm]');
    if (rm) rm.closest('[data-pacote]').remove();
    if (e.target.closest('[data-add-doc]')) {
      const rows = e.target.closest('[data-docs]').querySelector('.rows');
      rows.insertAdjacentHTML('beforeend', docLinha());
      rows.lastElementChild.querySelector('[data-d=titulo]').focus();
    }
    const rmd = e.target.closest('[data-rm-doc]');
    if (rmd) rmd.closest('[data-doc]').remove();
    const bloco = e.target.closest('[data-imagem]');
    if (bloco && e.target.closest('[data-escolher]')) bloco.querySelector('input[type=file]').click();
    if (bloco && e.target.closest('[data-tirar]')) {
      bloco.querySelector('input[type=hidden]').value = '';
      bloco.querySelector('.prev').innerHTML = ic('image');
      bloco.querySelector('[data-tirar]').hidden = true;
    }
  });
  form.addEventListener('change', async (e) => {
    const bloco = e.target.closest('[data-imagem]');
    if (bloco && e.target.type === 'file' && e.target.files[0]) {
      try {
        const url = await reduzirImagem(e.target.files[0]);
        bloco.querySelector('input[type=hidden]').value = url;
        bloco.querySelector('.prev').innerHTML = `<img src="${url}" alt="">`;
        bloco.querySelector('[data-tirar]').hidden = false;
      } catch { toast('Não consegui abrir essa imagem.', true); }
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const faltando = campos.find((c) => c.obrigatorio && !String(form.elements[c.nome]?.value || '').trim());
    if (faltando) { toast(`Preencha: ${faltando.rotulo}`, true); form.elements[faltando.nome].focus(); return; }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const r = await aoSalvar(coletar(form, campos), m);
      if (r !== false) m.fechar();
    } catch (err) {
      toast(err.message || 'Algo deu errado ao salvar.', true);
    } finally { btn.disabled = false; }
  });
  return m;
}
