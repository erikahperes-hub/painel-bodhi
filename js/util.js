export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const uid = (prefix = '') => prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtBRL2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const brl = (n) => {
  const v = Number(n) || 0;
  return (Number.isInteger(v) ? fmtBRL : fmtBRL2).format(v).replace(/ /g, ' ');
};

export const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const mesNome = (i) => MESES[i];

export function parseData(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const dataBR = (iso) => {
  const d = parseData(iso);
  return d ? d.toLocaleDateString('pt-BR') : '';
};
export const dataExtenso = (d = new Date()) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function diasAte(iso) {
  const d = parseData(iso);
  if (!d) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((d - hoje) / 86400000);
}
export const diasTxt = (n) => (n === null ? '' : n < 0 ? `venceu há ${-n} ${-n === 1 ? 'dia' : 'dias'}` : n === 0 ? 'vence hoje' : `em ${n} ${n === 1 ? 'dia' : 'dias'}`);

export const iniciais = (nome) => String(nome || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

// Regra de copy da Bôdhi: sem travessão.
export const semTravessao = (s) => String(s ?? '').replace(/\s*[—–]\s*/g, ', ');

export function extenso(valor) {
  const n = Math.round((Number(valor) || 0) * 100);
  const reais = Math.floor(n / 100);
  const cent = n % 100;
  const U = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const ate999 = (x) => {
    if (x === 100) return 'cem';
    const out = [];
    if (x >= 100) out.push(C[Math.floor(x / 100)]);
    const r = x % 100;
    if (r) out.push(r < 20 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' e ' + U[r % 10] : ''));
    return out.join(' e ');
  };
  const inteiro = (x) => {
    if (x === 0) return 'zero';
    const mil = Math.floor(x / 1000);
    const resto = x % 1000;
    const partes = [];
    if (mil) partes.push(mil === 1 ? 'mil' : ate999(mil) + ' mil');
    if (resto) partes.push(ate999(resto));
    return partes.length === 2 && (resto < 100 || resto % 100 === 0) ? partes.join(' e ') : partes.join(' ');
  };
  let t = inteiro(reais) + (reais === 1 ? ' real' : ' reais');
  if (cent) t += ' e ' + inteiro(cent) + (cent === 1 ? ' centavo' : ' centavos');
  return t;
}

export function debounce(fn, ms = 120) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function toast(msg, erro = false) {
  document.querySelectorAll('.toast').forEach((e) => e.remove());
  const el = document.createElement('div');
  el.className = 'toast' + (erro ? ' err' : '');
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

export function baixar(nome, conteudo, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function reduzirImagem(file, lado = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, lado / Math.min(img.width, img.height));
      const w = Math.round(img.width * k), h = Math.round(img.height * k);
      const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('Imagem inválida'));
    img.src = url;
  });
}
