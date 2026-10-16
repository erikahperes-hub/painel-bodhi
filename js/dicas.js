// Balão de explicação com a identidade da Bôdhi (substitui o balão padrão do navegador).
// Uso: escreva data-dica="texto" em qualquer elemento (no lugar de title). Aparece ao passar o mouse, ao focar com o teclado
// e, no celular, ao tocar. O balão fica fora do elemento (position: fixed), então nunca é cortado por tabelas ou cartões.
let balao = null;
let alvoAtual = null;

function criar() {
  balao = document.createElement('div');
  balao.className = 'dica-bodhi';
  balao.setAttribute('role', 'tooltip');
  balao.innerHTML = '<span class="dica-t"></span><i class="dica-seta"></i>';
  document.body.appendChild(balao);
}

function mostrar(el) {
  const texto = el.getAttribute('data-dica');
  if (!texto) return;
  if (!balao) criar();
  alvoAtual = el;
  balao.querySelector('.dica-t').textContent = texto;
  balao.classList.remove('baixo');
  balao.style.left = '0px';
  balao.style.top = '0px';
  balao.classList.add('on');
  const r = el.getBoundingClientRect();
  const b = balao.getBoundingClientRect();
  const margem = 10;
  let topo = r.top - b.height - 10;
  let baixo = false;
  if (topo < margem) { topo = r.bottom + 10; baixo = true; }
  let esq = r.left + r.width / 2 - b.width / 2;
  const limite = window.innerWidth - b.width - margem;
  esq = Math.max(margem, Math.min(esq, limite));
  balao.style.left = `${Math.round(esq)}px`;
  balao.style.top = `${Math.round(topo)}px`;
  balao.classList.toggle('baixo', baixo);
  balao.style.setProperty('--seta', `${Math.round(Math.max(14, Math.min(b.width - 14, r.left + r.width / 2 - esq)))}px`);
}

function esconder() {
  alvoAtual = null;
  balao?.classList.remove('on');
}

export function ligarDicas() {
  if (window.__dicasBodhi) return;
  window.__dicasBodhi = true;
  const achar = (e) => e.target.closest?.('[data-dica]');
  document.addEventListener('mouseover', (e) => { const el = achar(e); if (el && el !== alvoAtual) mostrar(el); });
  document.addEventListener('mouseout', (e) => { const el = achar(e); if (el && !el.contains(e.relatedTarget)) esconder(); });
  document.addEventListener('focusin', (e) => { const el = achar(e); if (el) mostrar(el); });
  document.addEventListener('focusout', esconder);
  // No celular não existe "passar o mouse": um toque abre o balão e outro toque (em qualquer lugar) fecha.
  document.addEventListener('click', (e) => {
    if (!window.matchMedia('(hover: none)').matches) return;
    const el = achar(e);
    if (el && el !== alvoAtual) mostrar(el); else esconder();
  });
  window.addEventListener('scroll', esconder, { passive: true, capture: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') esconder(); });
}
