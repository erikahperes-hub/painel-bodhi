import { abrirModal } from '../ui.js?v=13';
import { esc } from '../util.js?v=13';
import { ic } from '../icons.js?v=13';

export const CSS_BASE = `
@font-face{font-family:'Roca Two';src:url(assets/fonts/RocaTwo-Bold.ttf) format('truetype');font-weight:700}
@font-face{font-family:'Arial Nova';src:url(assets/fonts/ArialNova-Regular.ttf) format('truetype');font-weight:400}
@font-face{font-family:'Arial Nova';src:url(assets/fonts/ArialNova-Bold.ttf) format('truetype');font-weight:700}
@font-face{font-family:'Argent CF';src:url(assets/fonts/ArgentCF-Regular.otf) format('opentype');font-weight:400}
@font-face{font-family:'Argent CF';src:url(assets/fonts/ArgentCF-DemiBold.otf) format('opentype');font-weight:600}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;background:#E4DED1}
body{font-family:'Argent CF',Georgia,serif;color:#292B2D;-webkit-font-smoothing:antialiased}
.logo-svg{display:block}
`;

export function documento({ titulo, css, corpo }) {
  const base = new URL('./', location.href).href;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><base href="${esc(base)}"><title>${esc(titulo)}</title><style>${CSS_BASE}${css}</style></head><body>${corpo}</body></html>`;
}

export function abrirDocumento({ titulo, subtitulo, html, nomeArquivo, avisos = [] }) {
  const corpo = `${avisos.length ? `<div class="hintbox" style="margin:0 0 14px;background:var(--coral-s);color:var(--coral-ink)"><b>Antes de enviar:</b> ${esc(avisos.join(' · '))}</div>` : ''}
    <iframe class="docframe" title="${esc(titulo)}"></iframe>
    <div class="modal-f"><span class="lbl" style="max-width:420px">No diálogo de impressão, escolha “Salvar como PDF”.</span>
      <div class="actions"><button class="btn sec" data-fechar-doc>Fechar</button><button class="btn pri" data-imprimir>${ic('download')}Baixar PDF</button></div></div>`;
  const m = abrirModal({ titulo, subtitulo, corpo, largo: true });
  const frame = m.el.querySelector('iframe');
  frame.srcdoc = html;
  m.el.querySelector('[data-fechar-doc]').onclick = () => m.fechar();
  m.el.querySelector('[data-imprimir]').onclick = async () => {
    try { await frame.contentDocument.fonts.ready; } catch { /* segue */ }
    const antes = document.title;
    document.title = nomeArquivo;
    const volta = () => { document.title = antes; window.removeEventListener('afterprint', volta); };
    window.addEventListener('afterprint', volta);
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };
  return m;
}
