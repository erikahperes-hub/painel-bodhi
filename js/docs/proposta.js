import { store } from '../store.js';
import { logo } from '../logo.js';
import { esc, brl, semTravessao } from '../util.js';
import { faixaProposta } from '../calc.js';
import { documento, abrirDocumento } from './base.js';

const CSS = `
@page{size:A4;margin:0}
.page{width:210mm;height:297mm;margin:10mm auto;background:#FFFCF6;position:relative;overflow:hidden;padding:24mm 22mm;font-size:11.5pt;line-height:1.62;box-shadow:0 2px 18px rgba(0,0,0,.12)}
@media print{html,body{background:none}.page{margin:0;box-shadow:none;break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}}
.eyebrow{font:700 8.5pt 'Arial Nova',sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#23BB84}
h1{font:700 44pt/1.08 'Roca Two',serif;margin:0;letter-spacing:-.01em}
h2{font:700 21pt/1.2 'Arial Nova',sans-serif;margin:8px 0 0;letter-spacing:-.005em}
h3{font:700 10.5pt 'Arial Nova',sans-serif;margin:0 0 8px}
p{margin:0 0 10px}
.muted{color:rgba(41,43,45,.72)}
.rule{border:0;border-top:1px solid rgba(41,43,45,.14);margin:22px 0}
.rule.v{border-top:2px solid #23BB84}
.capa{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.capa .logo-svg{width:52mm;margin-bottom:28mm}
.capa h1{margin:14px 0 26px}
.badge{display:inline-flex;align-items:center;gap:9px;background:#EDE9E1;border:1px solid #D5CFC4;border-radius:99px;padding:8px 20px;font:700 10.5pt 'Arial Nova',sans-serif}
.badge i{width:8px;height:8px;border-radius:50%;background:#23BB84}
ul.b{list-style:none;margin:0;padding:0}
ul.b li{position:relative;padding:0 0 9px 18px}
ul.b li::before{content:'';position:absolute;left:0;top:.62em;width:6px;height:6px;border-radius:50%;background:#23BB84}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16mm;margin-top:14px}
.linha{display:flex;justify-content:space-between;gap:14px;padding:12px 0;border-top:1px solid rgba(41,43,45,.14)}
.linha:first-of-type{border-top:0}
.linha b{font:700 10.5pt 'Arial Nova',sans-serif}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:16px}
.tile{aspect-ratio:4/3;background:#EDE9E1;border:1px solid #D5CFC4;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;position:relative}
.tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.tile span{font:700 20pt 'Roca Two',serif;position:relative}
.tile small{font:400 9pt 'Arial Nova',sans-serif;color:rgba(41,43,45,.6);position:relative;margin-top:4px}
.tile.img span,.tile.img small{background:rgba(255,252,246,.88);padding:2px 12px;border-radius:99px}
.preco{font:700 22pt 'Arial Nova',sans-serif;color:#292B2D}
.preco small{font:400 10pt 'Arial Nova',sans-serif;color:rgba(41,43,45,.6)}
.big{font:700 60pt 'Roca Two',serif;color:rgba(35,187,132,.28);line-height:1}
.passo{display:flex;gap:16px;align-items:flex-start;padding:14px 0;border-top:1px solid rgba(41,43,45,.14)}
.passo:first-of-type{border-top:0}
.passo .n{font:700 20pt 'Roca Two',serif;color:rgba(35,187,132,.7);min-width:34px}
.rodape{position:absolute;left:0;right:0;bottom:16mm;display:flex;justify-content:center}
.rodape .logo-svg{width:34mm}
`;

const par = (t) => String(t || '').split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).map((x) => `<p>${esc(semTravessao(x))}</p>`).join('');
const lis = (arr) => `<ul class="b">${(arr || []).map((x) => `<li>${esc(semTravessao(x))}</li>`).join('')}</ul>`;

function tituloCapa(t) {
  const palavras = semTravessao(t).trim().split(/\s+/);
  if (palavras.length < 3) return esc(palavras.join(' '));
  const meio = Math.ceil(palavras.length / 2);
  return `${esc(palavras.slice(0, meio).join(' '))}<br>${esc(palavras.slice(meio).join(' '))}`;
}

export function avisosProposta(p) {
  const falta = [];
  if (!p.contexto) falta.push('contexto');
  if (!p.entregas?.length) falta.push('o que está incluído');
  if (!p.operacao?.length) falta.push('como funciona na prática');
  if (!p.prazo) falta.push('prazo de entrega');
  if (!p.pacotes?.length) falta.push('investimento');
  return falta.length ? [`faltam ${falta.join(', ')}. Use “Editar” para completar.`] : [];
}

export function propostaHTML(p) {
  const ano = new Date().getFullYear();
  const fundo = '#FFFCF6';
  const ativos = store.todos('cliente').filter((c) => c.status === 'ativo' && c.nome !== p.clienteNome).slice(0, 4);
  const rodape = `<div class="rodape">${logo('verde', fundo)}</div>`;
  const f = faixaProposta(p);
  const mensal = p.tipo === 'recorrente';
  const sufixo = mensal ? '<small> /mês</small>' : '';

  const invest = (p.pacotes || []).map((x) => `<div class="linha"><div><b>${esc(semTravessao(x.nome))}</b>${x.desc ? `<div class="muted" style="font-size:10.5pt">${esc(semTravessao(x.desc))}</div>` : ''}</div><div class="preco">${brl(x.preco)}${sufixo}</div></div>`).join('');
  const totalSoma = p.pacotesModo !== 'alternativas' && (p.pacotes || []).length > 1 && !/total/i.test(p.obs || '')
    ? `<hr class="rule v"><div class="linha" style="border:0"><b>Investimento total</b><div class="preco">${brl(f.max)}${sufixo}</div></div>` : '';

  const passos = (p.proximosPassos?.length ? p.proximosPassos : ['Aprovação da proposta', 'Alinhamento inicial com a equipe da Bôdhi Marketing', 'Início da execução']);

  const corpo = `
  <section class="page capa">
    ${logo('verde', fundo)}
    <div class="eyebrow">Proposta comercial · ${ano}</div>
    <h1>${tituloCapa(p.tituloCapa || p.titulo)}</h1>
    <div class="badge"><i></i>${esc(p.clienteNome)}</div>
  </section>

  <section class="page">
    <div class="eyebrow">Contexto</div><h2>Entendendo o seu momento</h2><hr class="rule">
    ${par(p.contexto) || `<p class="muted">${esc(semTravessao(p.resumo || ''))}</p>`}
    ${p.escopo ? `<hr class="rule"><h3>Nossa proposta</h3>${par(p.escopo)}` : ''}
  </section>

  <section class="page">
    <div class="eyebrow">Escopo</div><h2>${esc(semTravessao(p.titulo))}</h2><hr class="rule">
    <div class="${p.comoEntregamos?.length ? 'cols' : ''}">
      <div><h3>O que está incluído</h3>${lis(p.entregas)}</div>
      ${p.comoEntregamos?.length ? `<div><h3>Como entregamos</h3>${lis(p.comoEntregamos)}</div>` : ''}
    </div>
  </section>

  <section class="page">
    <div class="eyebrow">Operação</div><h2>Como funciona na prática</h2><hr class="rule">
    ${lis(p.operacao)}
    <hr class="rule">
    <div class="linha"><b>Prazo de entrega</b><span>${esc(semTravessao(p.prazo || ''))}</span></div>
    <div class="linha"><b>Forma de pagamento</b><span>${esc(semTravessao(p.pagamento || 'Pix'))}</span></div>
  </section>

  ${ativos.length ? `<section class="page">
    <div class="eyebrow">Clientes</div><h2>Quem já está com a Bôdhi Marketing</h2><hr class="rule">
    <div class="tiles">${ativos.map((c) => `<div class="tile ${c.imagem ? 'img' : ''}">${c.imagem ? `<img src="${esc(c.imagem)}" alt="">` : ''}<span>${esc(c.nome)}</span></div>`).join('')}</div>
  </section>` : ''}

  <section class="page">
    <div class="eyebrow">Investimento</div><h2>${mensal ? 'Investimento mensal' : 'Investimento'}</h2><hr class="rule v">
    ${p.pacotesModo === 'alternativas' && (p.pacotes || []).length > 1 ? '<p class="muted">Escolha o pacote que mais faz sentido para você.</p>' : ''}
    ${invest || '<p class="muted">Valores a definir.</p>'}${totalSoma}
    ${p.obs ? `<hr class="rule"><p class="muted">${esc(semTravessao(p.obs))}</p>` : ''}
  </section>

  <section class="page">
    <div class="eyebrow">Depois do sim</div><h2>Próximos passos</h2><hr class="rule">
    ${passos.map((x, i) => `<div class="passo"><span class="n">${i + 1}</span><div>${esc(semTravessao(x))}</div></div>`).join('')}
    ${rodape}
  </section>`;

  return documento({ titulo: `Proposta Bôdhi Marketing ${p.clienteNome}`, css: CSS, corpo });
}

export function gerarProposta(p) {
  abrirDocumento({
    titulo: 'Proposta comercial',
    subtitulo: `${p.clienteNome} · ${p.titulo}`,
    html: propostaHTML(p),
    nomeArquivo: `Proposta Bodhi Marketing - ${p.clienteNome}`,
    avisos: avisosProposta(p),
  });
}
