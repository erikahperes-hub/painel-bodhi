import { store } from './store.js';
import { alertas } from './calc.js';
import { esc, norm, brl, dataBR } from './util.js';
import { ic } from './icons.js';
import { listaProcessos } from './views/processo.js';

export const SECOES = [
  { rota: 'inicio', nome: 'Início', ic: 'home', extra: 'resumo visão geral' },
  { rota: 'comercial', nome: 'Comercial', ic: 'bars', extra: 'prospecção canais saídas clientes saem' },
  { rota: 'clientes', nome: 'Clientes', ic: 'users', extra: 'fichas' },
  { rota: 'propostas', nome: 'Propostas', ic: 'send', extra: 'orçamentos pdf' },
  { rota: 'contratos', nome: 'Contratos', ic: 'doc', extra: 'vigência renovação foro' },
  { rota: 'financeiro', nome: 'Financeiro', ic: 'wallet', extra: 'receita asaas cobranças pagamentos' },
  { rota: 'processo', nome: 'Processo', ic: 'flow', extra: 'fluxo etapas onboarding passo a passo estratégia briefing contrato fatura' },
  { rota: 'prospeccao', nome: 'Prospecção', ic: 'target', extra: 'funil leads' },
  { rota: 'configuracoes', nome: 'Configurações', ic: 'sliders', extra: 'backup modelo de contrato conta' },
];

function indice() {
  const it = [];
  SECOES.forEach((s) => it.push({ grupo: 'Seções', icone: s.ic, titulo: s.nome, sub: 'Abrir seção', rota: s.rota, ref: '', texto: `${s.nome} ${s.extra}` }));

  store.todos('cliente').forEach((c) => it.push({
    grupo: 'Clientes', icone: 'users', titulo: c.nome, sub: [c.mensalidade ? brl(c.mensalidade) + '/mês' : '', c.contato, c.empresa?.razao].filter(Boolean).join(' · '),
    rota: 'clientes', ref: c.id,
    texto: [c.nome, c.status, c.origem, c.resumo, c.contato, c.pagamento, c.formato, c.obs, c.empresa?.razao, c.empresa?.cnpj, c.empresa?.endereco, c.empresa?.representante, ...(c.escopo || [])].join(' '),
  }));
  store.todos('proposta').forEach((p) => it.push({
    grupo: 'Propostas', icone: 'send', titulo: `${p.clienteNome}: ${p.titulo}`, sub: p.resumo || p.escopo || '', rota: 'propostas', ref: p.id,
    texto: [p.clienteNome, p.titulo, p.resumo, p.escopo, p.obs, p.status, ...(p.pacotes || []).flatMap((x) => [x.nome, x.desc, x.preco])].join(' '),
  }));
  store.todos('contrato').forEach((c) => {
    const nome = store.obter('cliente', c.clienteId)?.nome || c.contratanteRazao || 'Contrato';
    it.push({
      grupo: 'Contratos', icone: 'doc', titulo: `Contrato ${nome}`, sub: [c.objeto, c.fim ? 'até ' + dataBR(c.fim) : ''].filter(Boolean).join(' · '), rota: 'contratos', ref: c.id,
      texto: [nome, c.objeto, c.contratanteRazao, c.contratanteCnpj, c.contratanteEndereco, c.contratanteRepresentante, c.foro, c.propriedade, c.formaPagamento, ...(c.escopo || [])].join(' '),
    });
  });
  store.todos('pendencia').forEach((p) => it.push({ grupo: 'Pendências', icone: 'file', titulo: p.titulo, sub: p.texto || (p.feito ? 'Concluída' : 'Em aberto'), rota: 'comercial', ref: p.id, texto: `${p.titulo} ${p.texto || ''}` }));

  store.todos('lancamento').forEach((l) => it.push({
    grupo: 'Financeiro', icone: 'wallet', titulo: `${l.tipo === 'despesa' ? 'Despesa' : 'Receita'}: ${l.descricao}`, sub: [brl(l.valor), l.categoria, l.data ? dataBR(l.data) : ''].filter(Boolean).join(' · '),
    rota: 'financeiro', ref: '', texto: [l.descricao, l.categoria, l.obs, l.tipo, l.valor].join(' '),
  }));

  listaProcessos().forEach((pr) => (pr.etapas || []).forEach((e, i) => it.push({
    grupo: 'Processo', icone: 'flow', titulo: `${pr.titulo}: ${e.titulo}`, sub: (e.passos || []).map((x) => x.titulo).join(' · '), rota: 'processo', ref: pr.id,
    texto: [pr.titulo, e.titulo, e.descricao, ...(e.avisos || []), ...(e.passos || []).flatMap((x) => [x.titulo, ...(x.detalhes || [])])].join(' '),
  })));

  const com = store.cfg('comercial', {});
  (com.canais || []).forEach((x) => it.push({ grupo: 'Comercial', icone: 'bars', titulo: x, sub: 'Canal de chegada de clientes', rota: 'comercial', ref: '', texto: x }));
  (com.perfilAlvo || []).forEach((x) => it.push({ grupo: 'Comercial', icone: 'target', titulo: x, sub: 'Perfil-alvo', rota: 'comercial', ref: '', texto: x }));
  (com.saidas || []).forEach((s) => it.push({ grupo: 'Comercial', icone: 'alert', titulo: s.titulo, sub: s.texto, rota: 'comercial', ref: '', texto: `${s.titulo} ${s.texto} ${s.nivel}` }));
  if (com.historico) com.historico.split(/,\s*(?![^()]*\))/).forEach((x) => it.push({ grupo: 'Comercial', icone: 'users', titulo: x.trim(), sub: 'Histórico de clientes anteriores', rota: 'comercial', ref: '', texto: x }));
  alertas().forEach((a) => it.push({ grupo: 'Atenção', icone: a.icone, titulo: a.titulo, sub: a.texto, rota: a.rota, ref: a.ref || '', texto: `${a.titulo} ${a.texto} ${a.tag}` }));

  return it.map((x) => ({ ...x, n: norm(x.texto), nt: norm(x.titulo) }));
}

export function buscar(consulta) {
  const termos = norm(consulta).split(/\s+/).filter(Boolean);
  if (!termos.length) return [];
  const pontuados = indice().map((x) => {
    if (!termos.every((t) => x.n.includes(t))) return null;
    let pts = 0;
    termos.forEach((t) => { if (x.nt.startsWith(t)) pts += 4; else if (x.nt.includes(t)) pts += 2; else pts += 1; });
    if (x.grupo === 'Seções') pts += 1;
    return { ...x, pts };
  }).filter(Boolean).sort((a, b) => b.pts - a.pts);
  return pontuados.slice(0, 24);
}

export function destacar(texto, consulta) {
  const original = String(texto ?? '');
  const n = norm(original);
  const marcas = [];
  norm(consulta).split(/\s+/).filter(Boolean).forEach((t) => {
    let i = n.indexOf(t);
    while (i !== -1) { marcas.push([i, i + t.length]); i = n.indexOf(t, i + t.length); }
  });
  if (!marcas.length || n.length !== original.length) return esc(original);
  marcas.sort((a, b) => a[0] - b[0]);
  const fund = [];
  marcas.forEach((m) => { const u = fund[fund.length - 1]; if (u && m[0] <= u[1]) u[1] = Math.max(u[1], m[1]); else fund.push([...m]); });
  let out = '', pos = 0;
  fund.forEach(([a, b]) => { out += esc(original.slice(pos, a)) + '<mark>' + esc(original.slice(a, b)) + '</mark>'; pos = b; });
  return out + esc(original.slice(pos));
}

export function htmlResultados(lista, consulta, sel) {
  if (!lista.length) return `<div class="res-empty">Nada encontrado para “${esc(consulta)}”. Tente outra palavra.</div>`;
  let grupo = '', html = '';
  lista.forEach((r, i) => {
    if (r.grupo !== grupo) { grupo = r.grupo; html += `<div class="res-g">${esc(grupo)}</div>`; }
    html += `<div class="res ${i === sel ? 'sel' : ''}" role="option" data-i="${i}" aria-selected="${i === sel}"><span class="ri">${ic(r.icone)}</span><div style="min-width:0"><b>${destacar(r.titulo, consulta)}</b><small>${destacar(r.sub, consulta)}</small></div></div>`;
  });
  return html;
}
