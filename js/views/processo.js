import { store } from '../store.js';
import { esc, toast } from '../util.js';
import { ic, flor } from '../icons.js';
import { formulario, confirmar } from '../ui.js';

const p = (titulo, detalhes = []) => ({ titulo, detalhes });

// Processo padrão da Bôdhi Marketing. Aparece até ser editado ou substituído pelas sócias em Processo > Editar.
const PADRAO = {
  id: 'fechei-estrategia',
  titulo: 'Fechei uma estratégia, e agora?',
  subtitulo: 'Do aceite da proposta ao início da execução: o passo a passo que a Bôdhi Marketing segue em todo projeto de estratégia.',
  etapas: [
    {
      titulo: 'Proposta aprovada',
      descricao: 'O cliente aprovou a proposta de estratégia.',
      passos: [
        p('Solicitar os dados cadastrais do cliente', ['Dados necessários para elaboração do contrato e emissão da fatura.']),
        p('Enviar contrato e fatura', ['Enviar o contrato para assinatura.', 'Enviar a fatura referente ao pagamento da estratégia.']),
        p('Aguardar contrato assinado e pagamento confirmado'),
      ],
      avisos: [],
    },
    {
      titulo: 'Cliente apto para início da estratégia',
      descricao: 'Com o contrato assinado e a fatura paga, podemos iniciar oficialmente o projeto.',
      passos: [
        p('Criar grupo de WhatsApp com o cliente', ['Centralizar a comunicação e os próximos alinhamentos.']),
        p('Enviar briefing de conteúdo', ['Enviar o briefing que deverá ser preenchido pelo cliente.']),
        p('Receber briefing preenchido', ['Conferir se todas as informações necessárias foram enviadas.']),
        p('Agendar reunião de briefing', ['Marcar uma reunião para aprofundar as informações e alinhar expectativas.']),
        p('Realizar reunião de briefing'),
      ],
      avisos: [],
    },
    {
      titulo: 'Desenvolvimento da estratégia',
      descricao: '',
      passos: [
        p('Desenvolver a estratégia', ['A partir do briefing e das informações levantadas na reunião.']),
        p('Confirmar pagamento de 100% da estratégia'),
      ],
      avisos: ['A estratégia deve estar 100% paga antes da apresentação e da entrega.'],
    },
    {
      titulo: 'Apresentação da estratégia',
      descricao: '',
      passos: [
        p('Agendar reunião de apresentação', ['Combinar com o cliente a data e o horário para apresentação da estratégia.']),
        p('Realizar apresentação da estratégia'),
        p('Enviar a estratégia para o cliente', ['Enviar o material apresentado para que o cliente possa revisar e conferir.']),
        p('Aguardar revisão do cliente'),
      ],
      avisos: [],
    },
    {
      titulo: 'Estratégia revisada e início da execução',
      descricao: 'O cliente revisou e confirmou a estratégia. Com a estratégia revisada e aprovada, o projeto entra na etapa de execução.',
      passos: [
        p('Iniciar a execução'),
        p('Enviar a gravação da reunião de apresentação', ['Compartilhar com o cliente a gravação da reunião de apresentação da estratégia.']),
      ],
      avisos: [],
    },
  ],
};

export function listaProcessos() {
  const regs = store.todos('processo').sort((a, b) => (a.criadoEm || '').localeCompare(b.criadoEm || ''));
  if (regs.length) return regs;
  return store.cfg('processos', {}).iniciado ? [] : [PADRAO];
}

function paraTexto(etapas) {
  return (etapas || []).map((e) => [
    `## ${e.titulo}`,
    e.descricao,
    ...(e.passos || []).flatMap((x) => [`- ${x.titulo}`, ...(x.detalhes || []).map((d) => `  ${d}`)]),
    ...(e.avisos || []).map((a) => `! ${a}`),
  ].filter(Boolean).join('\n')).join('\n\n');
}

function deTexto(texto) {
  const etapas = [];
  let e = null, passo = null;
  for (const bruto of String(texto).split('\n')) {
    const linha = bruto.trimEnd();
    if (!linha.trim()) continue;
    if (linha.startsWith('## ')) { e = { titulo: linha.slice(3).trim(), descricao: '', passos: [], avisos: [] }; etapas.push(e); passo = null; }
    else if (!e) continue;
    else if (linha.startsWith('- ')) { passo = { titulo: linha.slice(2).trim(), detalhes: [] }; e.passos.push(passo); }
    else if (linha.startsWith('! ')) e.avisos.push(linha.slice(2).trim());
    else if (/^\s/.test(linha) && passo) passo.detalhes.push(linha.trim().replace(/^-\s+/, ''));
    else e.descricao += (e.descricao ? ' ' : '') + linha.trim();
  }
  return etapas.filter((x) => x.titulo);
}

async function marcarIniciado() { await store.salvarCfg('processos', { iniciado: true }); }

function abrirEditor(proc = null) {
  const base = proc || { titulo: '', subtitulo: '', etapas: [{ titulo: 'Primeira etapa', descricao: '', passos: [p('Primeiro passo')], avisos: [] }] };
  formulario({
    titulo: proc ? 'Editar processo' : 'Novo processo',
    subtitulo: 'Escreva do jeito simples abaixo. O painel monta as etapas.',
    largo: true,
    campos: [
      { nome: 'titulo', rotulo: 'Nome do processo', obrigatorio: true, cheio: true },
      { nome: 'subtitulo', rotulo: 'Explicação curta', tipo: 'area', cheio: true, linhas: 2 },
      { nome: 'etapas', rotulo: 'Etapas e passos', tipo: 'area', cheio: true, linhas: 18,
        ajuda: 'Uma etapa por bloco, começando com ## e o nome. Depois, um passo por linha começando com “- ”. Detalhes de um passo vão na linha de baixo, com dois espaços no começo. Uma linha começando com “! ” vira um aviso em destaque. Texto solto logo abaixo do nome da etapa vira a descrição dela.' },
    ],
    valores: { titulo: base.titulo, subtitulo: base.subtitulo, etapas: paraTexto(base.etapas) },
    async aoSalvar(v) {
      const etapas = deTexto(v.etapas);
      if (!etapas.length) throw new Error('Inclua pelo menos uma etapa, começando a linha com ## e o nome dela.');
      const salvo = await store.salvar('processo', { ...(proc || {}), criadoEm: proc?.criadoEm || new Date().toISOString(), titulo: v.titulo, subtitulo: v.subtitulo, etapas });
      await marcarIniciado();
      toast('Processo salvo');
      location.hash = `#/processo/${salvo.id}`;
    },
    aoExcluir: proc ? async (m) => {
      if (!(await confirmar('Excluir este processo do painel?', 'Excluir', true))) return;
      if (store.obter('processo', proc.id)) await store.remover('processo', proc.id);
      await marcarIniciado();
      m.fechar();
      toast('Processo excluído');
      location.hash = '#/processo';
    } : null,
  });
}

export default {
  titulo: () => 'Processo',
  sub: () => 'Como a Bôdhi Marketing conduz cada projeto, passo a passo.',

  render(estado) {
    const lista = listaProcessos();
    if (!lista.length) {
      return `<div class="card empty">${flor()}<h2>Nenhum processo registrado</h2><p>Registre aqui o passo a passo de como a Bôdhi Marketing trabalha, para as duas sócias terem sempre a mesma referência.</p><button class="btn pri" data-act="novo-processo">${ic('plus')}Novo processo</button></div>`;
    }
    const pr = lista.find((x) => x.id === estado.ref) || lista[0];
    const etapas = pr.etapas || [];

    const tabs = lista.length > 1
      ? `<div class="tabs" role="tablist">${lista.map((x) => `<button class="tab ${x.id === pr.id ? 'on' : ''}" role="tab" aria-selected="${x.id === pr.id}" data-act="ir" data-rota="processo" data-ref="${x.id}">${esc(x.titulo)}</button>`).join('')}</div>` : '';

    const blocos = etapas.map((e, i) => `<section class="et ${i === etapas.length - 1 ? 'fim' : ''}" id="et-${i}">
      <div class="et-n" aria-hidden="true">${i + 1}</div>
      <div>
        <h3>${esc(e.titulo)}</h3>
        ${e.descricao ? `<p class="et-d">${esc(e.descricao)}</p>` : ''}
        ${(e.passos || []).map((x, j) => `<div class="pa"><i>${j + 1}</i><div><b>${esc(x.titulo)}</b>${x.detalhes?.length ? `<ul>${x.detalhes.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}</div></div>`).join('')}
        ${(e.avisos || []).map((a) => `<div class="aviso">${ic('alert')}<span>${esc(a)}</span></div>`).join('')}
      </div></section>`).join('');

    return `${tabs}<div class="grid">
      <div class="card c4">
        <div class="card-h"><div><h2 style="font:700 24px/1.2 var(--display)">${esc(pr.titulo)}</h2>${pr.subtitulo ? `<p class="sub">${esc(pr.subtitulo)}</p>` : ''}</div>
          <div class="actions"><button class="btn sec sm" data-act="editar-processo" data-id="${pr.id}">${ic('edit')}Editar</button><button class="btn pri sm" data-act="novo-processo">${ic('plus')}Novo processo</button></div></div>
        <div class="indice" aria-label="Etapas">${etapas.map((e, i) => `<button data-act="rolar-etapa" data-i="${i}"><i>${i + 1}</i>${esc(e.titulo)}</button>`).join('')}</div>
      </div>
      <div class="card c4"><div style="max-width:880px">${blocos}</div></div>
    </div>`;
  },

  acoes: {
    'novo-processo': () => abrirEditor(),
    'editar-processo': (el) => abrirEditor(store.obter('processo', el.dataset.id) || listaProcessos().find((x) => x.id === el.dataset.id) || null),
    'rolar-etapa': (el) => document.getElementById(`et-${el.dataset.i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
  },
};
