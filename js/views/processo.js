import { store } from '../store.js?v=79';
import { esc, toast } from '../util.js?v=79';
import { ic, flor } from '../icons.js?v=79';
import { formulario, confirmar } from '../ui.js?v=79';

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

// Fluxo de conteúdo: como cada peça anda no painel, do planejamento do mês até a publicação.
const PADRAO_CONTEUDO = {
  id: 'fluxo-conteudo',
  titulo: 'Fluxo de conteúdo',
  subtitulo: 'Do planejamento do mês à publicação: o cliente aprova as ideias, produzimos, ele aprova as artes e agendamos. Cada etapa tem o botão certo no painel.',
  etapas: [
    {
      titulo: 'Planejamento do mês',
      descricao: 'Definir as ideias do mês antes de produzir qualquer arte.',
      passos: [
        p('Rever o briefing e a estratégia do cliente', ['Datas importantes, promoções, metas do mês e o que já foi combinado.']),
        p('Montar o planejamento do mês', ['Há três jeitos. Use o mais prático para o dia:', 'No Claude (chat), com a skill painel-conteudo: peça o planejamento do cliente e ele entrega a tabela num bloco com o botão Copiar.', 'No Claude Code: peça o mesmo. Quem tem a chave do painel já recebe as ideias lá dentro, sem copiar nada.', 'À mão: monte uma tabela ou planilha com as colunas Data, Formato, Funil, Título, Ideia e roteiro (e Legenda, se já tiver).', 'Em qualquer jeito, distribua as ideias entre topo, meio e fundo de funil.']),
        p('Adicionar as ideias no painel', ['Se o Claude Code já subiu direto, só confira: as ideias aparecem na coluna Planejamento depois de atualizar a página.', 'Se você tem a tabela: Conteúdo > Adicionar em lote > Colar planejamento. Cole a tabela inteira, com a linha “Cliente: …” em cima. O painel mostra o resumo do que vai criar antes de adicionar.', 'As ideias entram na coluna Planejamento.']),
        p('Conferir na Prévia do cliente', ['A aba Planejamento mostra as ideias como o cliente vai ver. As que ainda não foram enviadas aparecem como “Ainda não enviado”.']),
      ],
      avisos: ['O texto de “Ideia e roteiro” fica visível para o cliente depois de enviado. Notas só da equipe vão em “Observações internas”.'],
    },
    {
      titulo: 'Planejamento enviado ao cliente',
      descricao: 'O cliente aprova as ideias antes de gastarmos tempo de produção.',
      passos: [
        p('Enviar o planejamento', ['Conteúdo > escolha o cliente > Enviar planejamento.', 'Todas as ideias da coluna Planejamento que ainda não foram enviadas vão para o link dele.']),
        p('Mandar o link de aprovação ao cliente', ['Conteúdo > Link de aprovação: copie e envie no WhatsApp.', 'O link é fixo por cliente e abre sem senha.']),
        p('Aguardar a resposta do cliente', ['Ele aprova uma a uma, pede alteração ou usa “Aprovar tudo deste mês”.', 'No cartão da peça aparece a marca “Plano enviado”, depois “Plano aprovado” ou “Plano: ajuste”.', 'O pedido de alteração aparece no cartão e no sino do painel.']),
        p('Ajustar as ideias que tiveram pedido de alteração', ['Abra a peça, corrija o roteiro ou a data e, em “Planejamento no link do cliente”, volte para “Aguardando aprovação” para o cliente ver de novo.']),
      ],
      avisos: ['Passe para a produção só as ideias que o cliente aprovou: elas ficam com a marca “Plano aprovado” no cartão. Para começar a produzir, use o botão “Iniciar criação” da peça.'],
    },
    {
      titulo: 'Produção e edição',
      descricao: 'Com a ideia aprovada, criamos a arte ou editamos o vídeo.',
      passos: [
        p('Criar a arte ou editar o vídeo', ['Exporte já com o nome padrão: AAAA-MM-DD_formato_titulo. A skill painel-conteudo, no Claude, cuida do nome e da pasta.']),
        p('Salvar os arquivos no Drive', ['Pasta Aprovação / nome do cliente / AAAA-MM, compartilhada como “qualquer pessoa com o link”.']),
        p('Escrever a legenda', ['Pode ir direto na peça ou num arquivo .txt com o mesmo nome do arquivo, na pasta.']),
        p('Trazer os arquivos para o painel', ['Conteúdo > Adicionar em lote > Importar da pasta do Drive.', 'O painel liga os arquivos à peça do planejamento, sem apagar o roteiro.']),
        p('Acompanhar o andamento no calendário', ['Use o círculo de concluir em cada peça para marcar o que já está feito.']),
      ],
      avisos: ['Reels e story: o texto da capa fica na faixa central. Feed e carrossel: textos e rostos longe das bordas.'],
    },
    {
      titulo: 'Aprovação do conteúdo pelo cliente',
      descricao: 'O cliente vê as artes prontas e aprova ou pede ajuste.',
      passos: [
        p('Passar as peças prontas para “Aguardando aprovação”', ['No cartão da peça, botão Enviar para aprovação.']),
        p('Conferir na Prévia do cliente', ['Veja feed, stories e calendário do jeito que o cliente vê.']),
        p('Enviar o link de aprovação ao cliente', ['É o mesmo link do planejamento: agora ele também vê as artes, na aba Feed, Stories e Calendário.']),
        p('Aguardar a aprovação ou o pedido de ajuste', ['Aprovou: a peça vai para Aprovado.', 'Pediu alteração: a peça vai para Ajustes, e o pedido aparece no cartão e no sino.']),
        p('Fazer os ajustes pedidos', ['Refaça a arte e use “Substituir arquivo existente” no Drive, para o arquivo manter o mesmo código.', 'Depois, botão Reenviar para aprovação.']),
      ],
      avisos: ['Se apagar o arquivo e subir de novo, o código muda e a peça precisa ser atualizada no painel.'],
    },
    {
      titulo: 'Agendamento e publicação',
      descricao: 'Com a arte aprovada, agendamos a publicação.',
      passos: [
        p('Conferir as peças em “Aprovado”', ['Use o calendário do mês para ver o que está pronto para ir ao ar.']),
        p('Agendar a publicação', ['Agende na ferramenta de agendamento, na data e no horário combinados da peça.']),
        p('Marcar como publicado', ['Botão Marcar como publicado: a peça fica concluída sozinha.']),
        p('Fechar o mês', ['Confira o calendário: peças atrasadas ou em aberto precisam de uma data nova ou de uma decisão.']),
      ],
      avisos: ['O painel ainda não publica sozinho no Instagram: a publicação é manual ou agendada em outra ferramenta.'],
    },
  ],
};

// Processos que vêm prontos. Cada um pode ser editado (vira um processo salvo, com o mesmo código) ou excluído.
const PADROES = [PADRAO, PADRAO_CONTEUDO];

export function listaProcessos() {
  const regs = store.todos('processo').sort((a, b) => (a.criadoEm || '').localeCompare(b.criadoEm || ''));
  const cfg = store.cfg('processos', {});
  const ocultos = new Set(cfg.ocultos || []);
  const proprios = new Set(regs.map((r) => r.id));
  // Cada processo pronto vale por conta própria: aparece se não foi editado (aí vale o salvo) nem excluído.
  // Estado antigo (antes da lista de excluídos): quem já tinha mexido nos processos e não tinha a Estratégia salva a tinha excluído.
  const estrategiaExcluidaAntes = (d) => d.id === PADRAO.id && !cfg.ocultos && !!cfg.iniciado;
  const prontos = PADROES
    .filter((d) => !proprios.has(d.id) && !ocultos.has(d.id) && !estrategiaExcluidaAntes(d));
  const doBanco = [...regs].sort((a, b) => (PADROES.findIndex((d) => d.id === a.id) + 1 || 99) - (PADROES.findIndex((d) => d.id === b.id) + 1 || 99));
  const ordem = (x) => { const i = PADROES.findIndex((d) => d.id === x.id); return i < 0 ? 99 : i; };
  return [...prontos, ...doBanco].sort((a, b) => ordem(a) - ordem(b));
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

// Guarda que as sócias já mexeram nos processos; se for um dos prontos que foi excluído, ele não volta sozinho.
async function marcarIniciado(excluidoId = '') {
  const cfg = store.cfg('processos', {});
  const ocultos = new Set(cfg.ocultos || []);
  // Se a Estratégia já estava excluída no estado antigo, continua excluída ao passar para a lista nova.
  if (!cfg.ocultos && cfg.iniciado && !store.obter('processo', PADRAO.id)) ocultos.add(PADRAO.id);
  if (excluidoId && PADROES.some((d) => d.id === excluidoId)) ocultos.add(excluidoId);
  await store.salvarCfg('processos', { ...cfg, iniciado: true, ocultos: [...ocultos] });
}

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
      await marcarIniciado(proc.id);
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
