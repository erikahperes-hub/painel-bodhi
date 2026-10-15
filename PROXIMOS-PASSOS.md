# Próximos passos do painel

Lista combinada entre Érika e Milena (15/10/2026). Quem for mexer no painel (com o Claude Code) deve ler `CLAUDE.md` antes e marcar aqui o que for concluído.

## 1. Financeiro: despesas e lucro (responsável: Milena)

Hoje só existe a receita mapeada. Objetivo: subir todos os extratos e gastos da empresa para entender para onde vai o dinheiro e ter despesa e lucro por mês.
- Milena sobe os extratos (começando pelos últimos 12 meses) e o Claude Code dela monta a tela: categorias de despesa, despesa por mês, lucro (receita menos despesa), gasto fixo x variável.
- Dados de despesa são sensíveis: ficam no Supabase (kind próprio, ex. `despesa`), só para sócias. Nunca em arquivo público nem no repositório (`seed/` é ignorado pelo git).
- Depois do Asaas conectado, a receita real entra sozinha e a despesa fica como entrada manual ou por arquivo do banco (OFX ou CSV).

## 2. Relatório do cliente com Instagram (começar pela Arena Pixel)

O relatório para clientes passa a mostrar também insights e resultados do Instagram, no mesmo ambiente. Começa pelo Instagram e pela Arena Pixel como teste.
- Fonte dos dados: API oficial da Meta (Instagram Graph API), que exige conta Instagram profissional ligada a uma Página do Facebook. Tokens ficam como segredo do servidor (Edge Function do Supabase), nunca no código do site.
- Primeiro, descobrir se a Arena Pixel já tem conta profissional ligada a uma Página e quem é administrador.
- O que mostrar: alcance, impressões, seguidores (ganho e perda), visitas ao perfil, melhores publicações do mês, comparação com o mês anterior, e o que foi publicado pelo painel (Conteúdo) ao lado dos números.
- Os resultados guardados no Supabase por cliente e mês (histórico próprio, porque a Meta só guarda parte do passado).

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
