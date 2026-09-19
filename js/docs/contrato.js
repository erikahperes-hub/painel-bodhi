import { store } from '../store.js?v=13';
import { logo } from '../logo.js?v=13';
import { esc, brl, extenso, dataBR, dataExtenso, parseData } from '../util.js?v=13';
import { documento, abrirDocumento } from './base.js?v=13';
import { CLAUSULAS_PADRAO, PREAMBULO_PADRAO } from './modeloContrato.js?v=13';

const CSS = `
@page{size:A4;margin:20mm 20mm 22mm}
.doc{width:210mm;margin:10mm auto;background:#fff;padding:20mm;font-size:10.8pt;line-height:1.6;box-shadow:0 2px 18px rgba(0,0,0,.12)}
@media print{html,body{background:none}.doc{width:auto;margin:0;padding:0;box-shadow:none}}
.top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(41,43,45,.16);padding-bottom:10px;margin-bottom:22px}
.top .logo-svg{width:34mm}
.top span{font:700 8pt 'Arial Nova',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#23BB84}
h1{font:700 19pt/1.2 'Roca Two',serif;text-align:center;margin:0 0 20px}
p{margin:0 0 10px;text-align:justify}
.cl{break-inside:avoid;page-break-inside:avoid;margin-top:14px}
.cl h2{font:700 10.5pt 'Arial Nova',sans-serif;margin:0 0 4px}
.cl ul{margin:4px 0 8px 0;padding-left:20px}
.cl li{margin-bottom:3px}
.ass{break-inside:avoid;page-break-inside:avoid;margin-top:34px}
.ass .data{margin-bottom:38px}
.ass .duas{display:grid;grid-template-columns:1fr 1fr;gap:18mm}
.ass .lin{border-top:1px solid #292B2D;padding-top:6px;font-size:10pt}
.ass .lin b{font:700 10pt 'Arial Nova',sans-serif;display:block}
`;

export function variaveis(c, empresa) {
  const cli = store.obter('cliente', c.clienteId);
  const ini = c.inicio ? dataBR(c.inicio) : '';
  const fim = c.fim ? dataBR(c.fim) : '';
  const meses = c.prazoMeses || (c.inicio && c.fim ? Math.max(1, Math.round((parseData(c.fim) - parseData(c.inicio)) / 2629800000)) : '');
  const dias = c.diasCarencia ? `${c.diasCarencia} dias úteis` : '';
  return {
    contratante: c.contratanteRazao || cli?.empresa?.razao || cli?.nome || '',
    contratante_cnpj: c.contratanteCnpj || cli?.empresa?.cnpj || '',
    contratante_endereco: c.contratanteEndereco || cli?.empresa?.endereco || '',
    contratante_representante: c.contratanteRepresentante || cli?.empresa?.representante || '',
    contratada: empresa.razao || '', contratada_cnpj: empresa.cnpj || '', contratada_endereco: empresa.endereco || '', contratada_representante: empresa.representante || '',
    objeto: c.objeto || '', escopo: (c.escopo || []).join('; '),
    inicio: ini, fim, prazo_meses: meses || '',
    valor: c.valor ? brl(c.valor) : '', valor_extenso: c.valor ? extenso(c.valor) : '',
    dia_pagamento: c.diaPagamento || '', forma_pagamento: c.formaPagamento || '',
    carencia: dias, multa_atraso: c.multaAtrasoPct ?? '', juros_atraso: c.jurosAtrasoPct ?? '',
    aviso_previo: c.avisoPrevioDias || '', propriedade: c.propriedade || '',
    permanencia: c.permanenciaMinimaMeses || '', multa_rescisoria: c.multaRescisoria || '', reajuste: c.reajuste || '',
    foro: c.foro || '',
  };
}

const preencher = (txt, v) => String(txt).replace(/\{\{(\w+)\}\}/g, (_, k) => (k in v && v[k] !== '' && v[k] !== null ? String(v[k]) : `[${k}]`));

function textoHTML(txt, v, escopo) {
  const partes = String(txt).split('\n').map((l) => l.trim()).filter(Boolean);
  return partes.map((l) => {
    if (l === '{{escopo}}') return escopo.length ? `<ul>${escopo.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : '<p>[escopo]</p>';
    return `<p>${esc(preencher(l, v))}</p>`;
  }).join('');
}

export function modeloAtual() {
  const cfg = store.cfg('modeloContrato', {});
  return { preambulo: cfg.preambulo || PREAMBULO_PADRAO, clausulas: cfg.clausulas?.length ? cfg.clausulas : CLAUSULAS_PADRAO };
}

export function avisosContrato(c, empresa) {
  const v = variaveis(c, empresa);
  const falta = [];
  if (!v.contratante || !v.contratante_cnpj) falta.push('dados da contratante');
  if (!empresa.razao || !empresa.cnpj) falta.push('dados da Bôdhi (Configurações)');
  if (!c.valor) falta.push('valor');
  if (!c.inicio || !c.fim) falta.push('vigência');
  if (!c.escopo?.length) falta.push('escopo');
  return falta.length ? [`faltam ${falta.join(', ')}.`] : [];
}

export function contratoHTML(c) {
  const empresa = store.cfg('empresa', {});
  const v = variaveis(c, empresa);
  const modelo = modeloAtual();
  const escopo = c.escopo || [];
  let n = 0;
  const clausulas = modelo.clausulas.filter((cl) => !cl.quando || (v[cl.quando] !== '' && v[cl.quando] != null)).map((cl) => {
    n += 1;
    return `<section class="cl"><h2>Cláusula ${n}ª. ${esc(cl.titulo)}</h2>${textoHTML(cl.texto, v, escopo)}</section>`;
  }).join('');
  const cidade = c.cidadeAssinatura || 'São Paulo';
  const data = c.dataAssinatura ? dataExtenso(parseData(c.dataAssinatura)) : dataExtenso();
  const corpo = `<div class="doc">
    <div class="top">${logo('verde', '#ffffff')}<span>Contrato</span></div>
    <h1>Contrato de Prestação de Serviços</h1>
    <p>${esc(preencher(modelo.preambulo, v))}</p>
    ${clausulas}
    <div class="ass"><p class="data">${esc(cidade)}, ${esc(data)}.</p>
      <div class="duas">
        <div class="lin"><b>${esc(v.contratante || 'CONTRATANTE')}</b>CNPJ ${esc(v.contratante_cnpj)}<br>${esc(v.contratante_representante)}<br>CONTRATANTE</div>
        <div class="lin"><b>${esc(v.contratada || 'CONTRATADA')}</b>CNPJ ${esc(v.contratada_cnpj)}<br>${esc(v.contratada_representante)}<br>CONTRATADA</div>
      </div></div>
  </div>`;
  return documento({ titulo: `Contrato Bôdhi Marketing ${v.contratante}`, css: CSS, corpo });
}

export function gerarContrato(c) {
  const empresa = store.cfg('empresa', {});
  const cli = store.obter('cliente', c.clienteId);
  abrirDocumento({
    titulo: 'Contrato de prestação de serviços',
    subtitulo: `${cli?.nome || c.contratanteRazao || ''} · minuta gerada pelo modelo padrão (em revisão)`,
    html: contratoHTML(c),
    nomeArquivo: `Contrato Bodhi Marketing - ${cli?.nome || c.contratanteRazao || 'cliente'}`,
    avisos: avisosContrato(c, empresa),
  });
}
