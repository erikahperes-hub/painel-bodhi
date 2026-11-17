// Conteúdo do link na bio da Bôdhi Marketing (links.html).
// Tudo aqui é público (aparece para quem abre a página). Nunca coloque dado de cliente.
// Para mudar textos, links, perguntas ou indicações, edite este arquivo (depois vira uma aba do painel).

const SITE = 'https://bodhi.marketing';

export const pagina = {
  id: 'bodhi', // identifica a página nos contatos e cliques (cada cliente terá o seu)
  nome: 'Bôdhi Marketing',
  frase: 'Estratégia com alma. Presença com propósito.',
  sub: 'Do diagnóstico ao digital: marketing que faz sentido para o seu negócio.',
  // Número com DDI e DDD, só números (ex.: 5511999999999). Vazio = botões de WhatsApp escondidos.
  whatsapp: '',

  redes: [
    { tipo: 'instagram', rotulo: 'Instagram', url: 'https://www.instagram.com/bodhi.mkt/' },
    { tipo: 'tiktok', rotulo: 'TikTok', url: 'https://tiktok.com/@bodhi.mkt' },
    { tipo: 'linkedin', rotulo: 'LinkedIn', url: 'https://www.linkedin.com/in/b%C3%B4dhimktdigital/' },
    { tipo: 'site', rotulo: 'Site', url: SITE },
  ],

  chamada: {
    titulo: 'Como podemos ajudar seu negócio?',
    texto: 'Responda 5 perguntas rápidas e receba uma indicação feita para o seu momento.',
  },

  metodo: {
    titulo: 'Método Consolidar',
    texto: 'Antes de comunicar, entendemos. Antes de agir, planejamos. Só depois, executamos com sentido.',
    fases: [
      { nome: 'Diagnosticar', texto: 'Entender o negócio, o público e o que já existe antes de agir.', cor: 'verde' },
      { nome: 'Direcionar', texto: 'Planejar com propósito: posicionamento, linhas editoriais e metas.', cor: 'coral' },
      { nome: 'Consolidar', texto: 'Executar com consistência e acompanhar o resultado todo mês.', cor: 'petroleo' },
    ],
  },

  servicos: [
    { id: 'estrategia', titulo: 'Estratégia Digital', texto: 'Diagnóstico e plano de comunicação', url: `${SITE}/estrategia-digital`, cor: 'verde' },
    { id: 'gestao', titulo: 'Gestão de Redes Sociais', texto: 'Conteúdo completo, do roteiro à publicação', url: `${SITE}/gestao-de-redes-sociais`, cor: 'coral' },
    { id: 'videos', titulo: 'Vídeos Personalizados', texto: 'Captação e edição de reels', url: `${SITE}/videos-personalizados`, cor: 'petroleo' },
    { id: 'branding', titulo: 'Branding', texto: 'Marca com identidade e propósito', url: `${SITE}/branding`, cor: 'grafite' },
    { id: 'conteudo', titulo: 'Marketing de Conteúdo', texto: 'Linha editorial que gera autoridade', url: `${SITE}/marketing-de-conteudo`, cor: 'verde' },
    { id: 'design', titulo: 'Design Gráfico', texto: 'Peças e materiais da sua marca', url: `${SITE}/design-grafico`, cor: 'coral' },
  ],

  links: [
    { rotulo: 'Conheça a Bôdhi Marketing', texto: 'Quem somos e como trabalhamos', url: `${SITE}/about` },
    { rotulo: 'Fale com a gente pelo site', texto: 'Formulário de contato', url: `${SITE}/contact` },
  ],
};

// Conversa de perguntas. Cada opção soma pontos para uma indicação (ver "indicacoes").
export const conversa = {
  boasVindas: 'Oi! Que bom te ver por aqui. Responda algumas perguntas rápidas e eu te indico o melhor caminho para o seu negócio.',
  perguntas: [
    { id: 'nome', tipo: 'texto', texto: 'Para começar, como você se chama?', placeholder: 'Seu nome' },
    {
      id: 'momento', texto: 'Prazer, {nome}! Em que momento está o seu negócio?',
      opcoes: [
        { rotulo: 'Estou começando agora', pontos: { estrategia: 2 } },
        { rotulo: 'Já vendo, mas as redes estão paradas', pontos: { gestao: 2 } },
        { rotulo: 'Estou crescendo e quero profissionalizar', pontos: { gestao: 1, estrategia: 1 } },
      ],
    },
    {
      id: 'desafio', texto: 'E qual é o maior desafio hoje?',
      opcoes: [
        { rotulo: 'Não sei o que postar', pontos: { estrategia: 2 } },
        { rotulo: 'Não tenho tempo para produzir', pontos: { gestao: 2 } },
        { rotulo: 'Posto, mas não vira cliente', pontos: { estrategia: 1, conteudo: 2 } },
        { rotulo: 'Minha marca não mostra o valor que eu entrego', pontos: { branding: 2, videos: 1 } },
      ],
    },
    {
      id: 'segmento', texto: 'Qual é o seu segmento?',
      opcoes: [
        { rotulo: 'Saúde e estética', pontos: { videos: 1 } },
        { rotulo: 'Gastronomia ou negócio local', pontos: { videos: 1 } },
        { rotulo: 'Moda', pontos: { branding: 1 } },
        { rotulo: 'Educação ou consultoria', pontos: { conteudo: 1 } },
        { rotulo: 'Outro' },
      ],
    },
    {
      id: 'historico', texto: 'Última: como vocês cuidam do marketing hoje?',
      opcoes: [
        { rotulo: 'Eu mesmo(a) faço', pontos: { gestao: 1 } },
        { rotulo: 'Já tivemos agência e não deu certo', pontos: { estrategia: 2 } },
        { rotulo: 'Ainda ninguém cuida', pontos: { estrategia: 1, gestao: 1 } },
      ],
    },
  ],
  contato: {
    titulo: 'Quase lá! Deixe seu contato',
    texto: 'Assim liberamos a sua indicação e, se quiser, a Bôdhi Marketing te chama para uma conversa sem compromisso.',
  },
};

export const indicacoes = {
  estrategia: {
    titulo: 'Diagnóstico e Estratégia',
    servico: 'estrategia',
    texto: 'Antes de postar mais, o seu negócio precisa de direção. Começamos pelo diagnóstico: entendemos o seu público, o que já funciona e o que trava. Daí sai um plano claro, com posicionamento, linhas editoriais e o que publicar em cada canal.',
  },
  gestao: {
    titulo: 'Gestão de Redes Sociais',
    servico: 'gestao',
    texto: 'Você já sabe o que entrega, falta constância. Cuidamos do conteúdo de ponta a ponta: planejamento, roteiro, captação, edição, legenda e agendamento, com aprovação simples pelo celular e relatório todo mês.',
  },
  conteudo: {
    titulo: 'Conteúdo que gera autoridade',
    servico: 'conteudo',
    texto: 'Seguidor não paga conta: o conteúdo precisa levar a pessoa até a compra. Montamos uma linha editorial que mostra o seu método, responde objeções e conduz para o contato, medindo o que de fato traz cliente.',
  },
  branding: {
    titulo: 'Branding e posicionamento',
    servico: 'branding',
    texto: 'Quando a marca não traduz o seu valor, o cliente compara só preço. Trabalhamos posicionamento, identidade e tom de voz para que o seu perfil mostre, logo de cara, por que você é a escolha certa.',
  },
  videos: {
    titulo: 'Vídeos que mostram o seu trabalho',
    servico: 'videos',
    texto: 'No seu segmento, ver é o que convence. Captamos e editamos reels que mostram o seu trabalho, o ambiente e as pessoas por trás dele, com roteiro pensado para prender nos primeiros segundos.',
  },
};
