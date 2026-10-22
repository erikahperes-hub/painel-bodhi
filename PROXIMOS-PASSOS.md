# Próximos passos do painel

Lista combinada entre Érika e Milena (15/10/2026). Quem for mexer no painel (com o Claude Code) deve ler `CLAUDE.md` antes e marcar aqui o que for concluído.

## 1. Financeiro: despesas e lucro (responsável: Milena)

Para a Milena começar, siga o `PASSO-A-PASSO-MILENA.md` (convites, chave, skill e arquivos a enviar).


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

## 5. Aba "Feed" em Conteúdo (pronta em 16/10/2026)

No ar: perfil do cliente simulado (foto, nome, bio, link, seguidores, seguindo e publicações) puxado direto do Instagram quando o cliente está conectado, com as tarefas do painel e os posts que já estão no Instagram misturados por data na grade. Destaques o Instagram não entrega a nenhum app, então os nomes são digitados em "Editar destaques".
- Ainda a conferir com o Instagram real: foto, bio e a grade com os posts do @bodhi.mkt.

## 6. Aparência (pronta em 16/10/2026)

Visual novo opcional, modo noturno e cores areia, rosa e verde, em Configurações > Aparência. Falta só a Érika decidir se o visual novo vira o padrão e se a aprovação do cliente (`aprovar.html`) também ganha o visual.

## 7. Asana dentro do painel (20 e 21/10/2026)

Pronto no código: Ativos/Inativos em Conteúdo, tarefas dos ativos no Status/Calendário (com legenda e comentários), histórico dos inativos em calendário, inicial do responsável no calendário. Anexos (cerca de 2.000 arquivos, uns 10 GB) copiados para o Drive, pasta Histórico Asana (backup).
- Falta: importar os dois arquivos de `seed/` no painel online (passos na LEIA-ME) e conferir os números.
- Falta: conferir que o Google Drive terminou de enviar os arquivos para a nuvem.
- Só cancelar o Asana depois disso.

## 8. Agendamento de posts no Instagram (em pausa desde 22/10/2026)

Nada publica hoje. O painel só LÊ o Instagram. Não rode nada que publique (`media_publish`) sem a Érika pedir com todas as letras.
- **Opções avaliadas:** (A) app próprio da Meta ligado ao painel, grátis, com fila e travas; (B) Metricool pelo conector do Claude (grátis só para 1 marca e 20 posts por mês); (C) Meta Business Suite, grátis e manual; (D) Buffer ou Publer no plano grátis (3 canais). Recomendação: começar pelo Business Suite e deixar o app próprio para depois. Decisão final com a Érika.
- **Análise da Meta:** contas com função no app (admin, desenvolvedor, testador) usam a permissão de publicar sem análise. Só contas sem função (outras agências, no plano de venda) exigem análise (verificação da empresa, política de privacidade, vídeo de demonstração; prazo e aprovação incertos). Dados de blogs, não da documentação da Meta: confirmar antes de prometer.
- **Estado no app da Meta "Painel Bodhi Marketing":** a permissão `instagram_business_content_publish` está adicionada (status "Pronto para teste"), mas ninguém autorizou. O login do @bodhi.mkt travou no código do autenticador, então não existe nenhum token com permissão de publicar. Os tokens dos clientes são só de leitura.
- **Regras da Érika para qualquer teste:** só no @bodhi.mkt, nada de cliente, post totalmente em branco e sem legenda; a fila de publicação precisa de travas (só publica o aprovado pelo cliente, mostra status, avisa se falhar).
- **A API do Instagram não apaga posts.** Para testar sem postar, crie só o "rascunho" da mídia (container) e não chame a publicação; ele expira em 24 horas.
- **Alternativa ao login do Instagram:** conexão pelo login do Facebook, ligada a uma Página (`instagram_content_publish`, `pages_show_list`). Falta conferir se o @bodhi.mkt está ligado a uma Página que a Érika administra.
- Um teste de rascunho foi feito no código e depois removido (a função `instagram` no Supabase deve estar igual a `supabase/functions/instagram/index.ts` do repositório, sem ação `teste-rascunho`).
