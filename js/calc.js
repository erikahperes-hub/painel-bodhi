import { store } from './store.js';
import { sum, diasAte, diasTxt, dataBR } from './util.js';

export function faixaProposta(p) {
  const valores = (p.pacotes || []).map((x) => Number(x.preco) || 0).filter((v) => v > 0);
  if (!valores.length) return { min: 0, max: 0 };
  if (p.pacotesModo === 'alternativas') return { min: Math.min(...valores), max: Math.max(...valores) };
  const total = sum(valores);
  return { min: total, max: total };
}

export function nomeCliente(c) {
  return c ? c.nome : '';
}

const mesDe = (iso) => String(iso || '').slice(0, 7);

// Lançamentos (receitas e despesas) que valem para o mês "ym" (AAAA-MM).
// Os que se repetem todo mês valem a partir do mês da data, até a data final (se houver).
export function lancamentosDoMes(ym) {
  return store.todos('lancamento').filter((l) => {
    if (!l.data) return false;
    if (l.recorrente) return mesDe(l.data) <= ym && (!l.ate || mesDe(l.ate) >= ym);
    return mesDe(l.data) === ym;
  });
}

export function resumoMes(ym) {
  const hoje = mesDe(new Date().toISOString());
  const clientes = store.todos('cliente');
  // Meses futuros contam só clientes ativos; o mês atual e os passados incluem quem está encerrando.
  const fixos = clientes.filter((c) => c.mensalidade && (c.status === 'ativo' || (c.status === 'encerrando' && ym <= hoje)));
  const lancs = lancamentosDoMes(ym);
  const receitasExtras = lancs.filter((l) => l.tipo === 'receita');
  const despesas = lancs.filter((l) => l.tipo === 'despesa');
  const receitaFixa = sum(fixos.map((c) => c.mensalidade));
  const receita = receitaFixa + sum(receitasExtras.map((l) => l.valor));
  const custos = sum(despesas.map((l) => l.valor));
  const resultado = receita - custos;

  const porCliente = fixos.map((c) => {
    const rec = c.mensalidade + sum(receitasExtras.filter((l) => l.clienteId === c.id).map((l) => l.valor));
    const custo = sum(despesas.filter((l) => l.clienteId === c.id).map((l) => l.valor));
    return { cliente: c, receita: rec, custo, resultado: rec - custo, margem: rec ? Math.round(((rec - custo) / rec) * 100) : 0 };
  }).sort((a, b) => b.receita - a.receita);

  return {
    ym, fixos, receitasExtras, despesas, receitaFixa, receita, custos, resultado,
    margem: receita ? Math.round((resultado / receita) * 100) : 0,
    fixas: sum(despesas.filter((l) => l.recorrente).map((l) => l.valor)),
    variaveis: sum(despesas.filter((l) => !l.recorrente).map((l) => l.valor)),
    porCliente,
  };
}

export function metricas() {
  const clientes = store.todos('cliente');
  const ativos = clientes.filter((c) => c.status === 'ativo').sort((a, b) => b.mensalidade - a.mensalidade);
  const encerrando = clientes.filter((c) => c.status === 'encerrando');
  const mrr = sum(ativos.map((c) => c.mensalidade));
  const mrrAgora = mrr + sum(encerrando.map((c) => c.mensalidade));
  const maior = ativos[0] || null;

  const abertas = store.todos('proposta').filter((p) => p.status === 'aguardando');
  const rec = abertas.filter((p) => p.tipo === 'recorrente');
  const avu = abertas.filter((p) => p.tipo !== 'recorrente');
  const potRec = sum(rec.map((p) => faixaProposta(p).max));
  const potAvuMin = sum(avu.map((p) => faixaProposta(p).min));
  const potAvuMax = sum(avu.map((p) => faixaProposta(p).max));

  const contratos = store.todos('contrato');
  const vigentes = contratos
    .filter((c) => c.fim && diasAte(c.fim) !== null && diasAte(c.fim) >= -30)
    .sort((a, b) => a.fim.localeCompare(b.fim));
  const renovacao = vigentes[0] ? { contrato: vigentes[0], dias: diasAte(vigentes[0].fim) } : null;

  const maiorParte = mrr && maior ? Math.round((maior.mensalidade / mrr) * 100) : 0;

  return {
    clientes, ativos, encerrando, mrr, mrrAgora,
    ticket: ativos.length ? mrr / ativos.length : 0,
    maior, maiorParte,
    abertas, potRec, potAvuMin, potAvuMax,
    contratos, renovacao,
  };
}

export function alertas() {
  const m = metricas();
  const lista = [];
  const cli = (id) => store.obter('cliente', id);

  m.contratos.forEach((c) => {
    const d = diasAte(c.fim);
    if (d !== null && d <= 60 && d >= -30) {
      const nome = cli(c.clienteId)?.nome || c.contratanteNome || 'Contrato';
      lista.push({ nivel: 0, tipo: 'warn', tag: 'Renovação próxima', icone: 'calendar', rota: 'contratos', ref: c.id,
        titulo: `Contrato da ${nome}`, texto: `vence em ${dataBR(c.fim)} (${diasTxt(d)}). Vale já conversar sobre renovação.` });
    }
  });
  m.encerrando.forEach((c) => {
    lista.push({ nivel: 1, tipo: 'warn', tag: 'Encerrando', icone: 'alert', rota: 'clientes', ref: c.id,
      titulo: c.nome, texto: c.encerramentoNota || `está em encerramento. Restam ${m.ativos.length} clientes fixos depois disso.` });
  });
  m.abertas.forEach((p) => {
    lista.push({ nivel: 2, tipo: 'info', tag: 'Aguardando retorno', icone: 'send', rota: 'propostas', ref: p.id,
      titulo: p.clienteNome, texto: `${p.titulo}: proposta enviada, aguardando resposta.` });
  });
  store.todos('pendencia').filter((x) => !x.feito && x.destaque).forEach((x) => {
    lista.push({ nivel: 3, tipo: 'mute', tag: 'Pendente', icone: 'file', rota: 'comercial', ref: x.id, titulo: x.titulo, texto: x.texto || '' });
  });
  return lista.sort((a, b) => a.nivel - b.nivel);
}
