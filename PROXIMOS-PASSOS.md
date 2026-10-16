# Próximos passos do painel

Lista combinada entre Érika e Milena (15/10/2026). Quem for mexer no painel (com o Claude Code) deve ler `CLAUDE.md` antes e marcar aqui o que for concluído.

## 1. Financeiro: despesas e lucro (responsável: Milena)

Hoje só existe a receita mapeada. Objetivo: subir todos os extratos e gastos da empresa para entender para onde vai o dinheiro e ter despesa e lucro por mês.
- Milena sobe os extratos (começando pelos últimos 12 meses) e o Claude Code dela monta a tela: categorias de despesa, despesa por mês, lucro (receita menos despesa), gasto fixo x variável.
- Dados de despesa são sensíveis: ficam no Supabase (kind próprio, ex. `despesa`), só para sócias. Nunca em arquivo público nem no repositório (`seed/` é ignorado pelo git).
- Depois do Asaas conectado, a receita real entra sozinha e a despesa fica como entrada manual ou por arquivo do banco (OFX ou CSV).

## 2. Relatório do cliente com Instagram (em andamento, por partes)

Objetivo: relatório mensal de cada cliente dentro do painel, com os resultados do Instagram, no estilo do relatório do Reportei (referência da Érika: relatório da PTE Smart) e com insights a mais. Teste feito com o Instagram da Bôdhi (@bodhi.mkt), conectado em 16/10/2026.

Como funciona hoje (feito):
- App da Meta "Painel Bodhi Marketing" (API do Instagram com login do Instagram, só leitura: perfil e insights). O dono do Instagram autoriza uma vez; o token fica só no Supabase (tabela `ig_conexoes`, função `instagram`), renova sozinho a cada 60 dias.
- Painel, aba Relatório: botões Conectar Instagram, Link para o cliente (link de autorização, vale 7 dias), Atualizar do Instagram (busca o mês mostrado), Importar dados (JSON) e Imprimir ou salvar PDF.
- Layout (`js/relatorio-html.js`): capa com período de análise e de comparação, números com variação (alcance, visualizações, interações, visitas, contas engajadas, seguidores, taxa de engajamento), evolução de 6 meses, publicações do mês com tabela completa, o que funcionou melhor (formato e dia da semana), entregas da Bôdhi e leitura do mês.

Partes que faltam, em ordem:
1. Link do cliente só para o relatório (página pública `relatorio.html#codigo`, igual ao link de aprovação: tabela de links + função `relatorio_ver` que entrega só os números daquele cliente).
2. Stories, seguidores por gênero/idade/cidade e melhor horário. Stories só ficam disponíveis por 24 horas na API, então precisa de uma leitura automática diária (agendada no Supabase) que guarde cada story.
3. Insights de estratégia que o Reportei não tem: cruzar tarefas do Conteúdo (funil topo/meio/fundo, formato, data) com o alcance de cada publicação; metas mensais por cliente; "leitura do mês" sugerida pelo Claude a partir dos números.
4. Atualização automática mensal (hoje é pelo botão) e aviso no sino quando a autorização de um cliente estiver para vencer.
5. Outras redes (TikTok, YouTube, LinkedIn), uma de cada vez.

Limites já conhecidos: o Instagram só entrega 30 dias por consulta de insights (em mês de 31 dias o último dia fica de fora); seguidores ao fim do mês não existem para meses passados (guardamos a data da leitura); modo de teste do app permite só contas adicionadas como testadoras (Funções do app, Testador do Instagram).

## 3. Propostas e contratos automatizados

Cada proposta e cada contrato têm particularidades; a automação precisa deixar espaço para elas. Decisão: o texto é montado conversando com o Claude (Claude Code, com as skills de proposta e marca da Bôdhi), e o painel guarda e organiza o resultado.
- Botão no lead/cliente "Montar com o Claude" que copia um pedido já preenchido (nome, serviço, valores já conhecidos) para colar no Claude Code.
- Importação direta no painel do resultado (igual ao planejamento de conteúdo): o Claude Code sobe a proposta ou o contrato já em Propostas ou Contratos, com PDF.
- Mini chat do Claude dentro do painel: só se, depois de usar o fluxo acima por um tempo, ainda fizer falta. Exige chave da API da Anthropic (cobrança por uso, separada da assinatura) e um servidor (Edge Function).

## 4. Nível de acesso (editora só de Conteúdo)

Objetivo: dar acesso a alguém de fora (ex.: Gabs, da TRE Clinic) para criar e editar tarefas de Conteúdo, sem ver Financeiro, Propostas, Contratos, valores nem dados de clientes.
Desenho:
- Nova tabela `editoras` (e-mail) e função `eh_editora()`. Sócias continuam com poder total.
- Políticas do banco: editora lê, cria, edita e apaga só linhas com `kind = 'conteudo'`. Nada de `cliente`, `proposta`, `contrato`, financeiro.
- Os clientes têm dados sensíveis dentro do mesmo registro, então a editora recebe uma lista mínima (só id e nome) por função do banco, nunca o registro completo.
- No painel: ao entrar como editora, só aparece a área Conteúdo (menu, busca, atalhos e rotas das outras áreas ficam fora).
- Opcional: limitar a editora a um ou mais clientes (ex.: só TRE Clinic).
- Testar com uma conta de teste antes de convidar a Gabs, tentando abrir as outras áreas e consultar o banco direto.

## 5. Aba "Feed" em Conteúdo (ideia da Érika, 16/10/2026)

Hoje a aba Conteúdo tem Status e Calendário. Incluir uma terceira visão, **Feed**, que mostra como o perfil do cliente fica com os conteúdos, sem precisar abrir a Prévia do cliente.
- Simular a página do Instagram do cliente: foto, nome, bio, destaques, grade de publicações (3 colunas), com as tarefas do planejamento e aprovadas nas posições em que vão sair. Reaproveitar `js/instagram.js` (já usado na Prévia e na página de aprovação).
- Bio, foto e destaques vêm da ficha do cliente (campos novos) ou, depois, direto do Instagram pelo app da Meta.
- LEMBRAR a Érika desta ideia assim que a configuração do Instagram (app da Meta e relatório) estiver concluída.
