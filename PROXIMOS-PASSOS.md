# Próximos passos do painel

Lista combinada entre Érika e Milena (15/10/2026). Quem for mexer no painel (com o Claude Code) deve ler `CLAUDE.md` antes e marcar aqui o que for concluído.

## 1. Financeiro: despesas e lucro (responsável: Milena)

Hoje só existe a receita mapeada. Objetivo: subir todos os extratos e gastos da empresa para entender para onde vai o dinheiro e ter despesa e lucro por mês.
- Milena sobe os extratos (começando pelos últimos 12 meses) e o Claude Code dela monta a tela: categorias de despesa, despesa por mês, lucro (receita menos despesa), gasto fixo x variável.
- Dados de despesa são sensíveis: ficam no Supabase (kind próprio, ex. `despesa`), só para sócias. Nunca em arquivo público nem no repositório (`seed/` é ignorado pelo git).
- Depois do Asaas conectado, a receita real entra sozinha e a despesa fica como entrada manual ou por arquivo do banco (OFX ou CSV).

## 2. Relatório do cliente com Instagram (partes 1 a 4 prontas em 16/10/2026)

Pronto e no ar (detalhes no LEIA-ME, seção "Relatório do cliente e Instagram"):
- Conexão grátis pelo app da Meta (só leitura), com renovação automática do token; testado com o Instagram da Bôdhi (@bodhi.mkt).
- Relatório no estilo do Reportei com insights a mais: resumo em frases, qualidade do resultado, metas por cliente, evolução de 6 meses, tabela de publicações, melhores formatos/dias/períodos, stories, perfil do público, entregas da Bôdhi, leitura do mês editável e funil (só equipe).
- Link do cliente só para o relatório (`relatorio.html#codigo`), com "Novo link" para desativar o antigo.
- Leitura automática no Supabase: stories de hora em hora e números do mês todo dia; avisos no sino e na tela do Relatório quando falhar, parar ou a autorização estiver perto de vencer.

Ainda a validar com dados reais: stories (a conta da Bôdhi não tinha story ativo no teste; falta postar um e conferir que os números e a navegação chegam).

Próximas ideias:
- Gerar a "leitura do mês" com o Claude a partir dos números (hoje é um rascunho por regras que a equipe edita).
- Comparar com concorrentes ou com a média do segmento (o Metricool e o Supermetrics têm; a API oficial não entrega).
- Outras redes (TikTok, YouTube, LinkedIn), uma de cada vez.
- Abrir o app da Meta para qualquer cliente sem convite exige a análise do app pela Meta (hoje só "testadores").

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
