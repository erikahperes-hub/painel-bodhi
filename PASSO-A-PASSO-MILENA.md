# Passo a passo: deixar a Milena mexendo no painel

Este arquivo não tem nenhuma senha nem chave. Quem entrega as chaves é a Érika, por um canal privado (veja a Parte 1, passo 5).

## Parte 1: o que a Érika faz (uma vez, cerca de 10 minutos)

1. **GitHub:** peça à Milena o nome de usuário dela no GitHub (se ela não tiver conta, ela cria uma grátis em github.com). Em https://github.com/erikahperes-hub/painel-bodhi vá em **Settings > Collaborators > Add people**, coloque o usuário dela e envie o convite. Ela aceita pelo e-mail.
2. **Supabase (banco de dados):** em supabase.com abra o projeto do painel, vá em **Organization > Team > Invite** e convide o e-mail dela. Isso serve para ela rodar textos no **SQL Editor** (mudanças no banco) e guardar a chave do Asaas em **Edge Functions > Secrets**. Sem esse convite ela edita o painel, mas não consegue mudanças que mexem no banco.
3. **Login do painel:** o acesso `milena@bodhi.marketing` já existe. Para conferir que ela está na lista de sócias, rode no SQL Editor: `select * from public.socias;`. Se o e-mail dela não aparecer, rode `insert into public.socias (email) values ('milena@bodhi.marketing') on conflict do nothing;`
4. **Chave de importação dela:** o arquivo `chave-milena.txt` já foi preparado, e o banco já a reconhece se o arquivo `instalar-importacao.sql` foi rodado (a LEIA-ME explica). Para conferir: `select nome, ativa from public.importacao_chaves;` deve listar uma linha para ela com `ativa = true`.
5. **Mandar os arquivos para ela** (veja a lista abaixo). Mande a chave por um canal privado, nunca por e-mail aberto nem por grupo, e peça para ela apagar a mensagem depois de salvar o arquivo.

### Arquivos que a Érika envia

| O que | Onde está no computador da Érika | Onde a Milena salva |
|---|---|---|
| Chave de importação dela (SECRETA) | `C:\Users\erika\.bodhi\chave-milena.txt` | `C:\Users\NOME-DELA\.bodhi\chave-painel.txt` (mude o nome do arquivo para `chave-painel.txt`) |
| Skill de conteúdo | `C:\Users\erika\.claude\skills\painel-conteudo\SKILL.md` | `C:\Users\NOME-DELA\.claude\skills\painel-conteudo\SKILL.md` |
| Este passo a passo | `painel-bodhi\PASSO-A-PASSO-MILENA.md` (também vai no GitHub) | qualquer lugar |

Não precisa mandar o código do painel (ela baixa do GitHub) nem a pasta `seed` (tem dados reais de clientes). A pasta `seed` só serve se ela quiser testar em `?local` com dados de exemplo; nesse caso a Érika manda o arquivo `seed\seed.json` direto, por canal privado.

Nunca envie: `chave-painel.txt` da Érika, chave do Asaas, senhas do Supabase.

## Parte 2: o que a Milena faz (uma vez, cerca de 15 minutos)

1. Instale o **Git** (git-scm.com) e o **Node** (nodejs.org), aceitando as opções padrão.
2. Aceite o convite do GitHub que chegou por e-mail e o convite do Supabase.
3. Crie a pasta `C:\Users\SEU-NOME\.bodhi` e salve nela a chave que a Érika mandou, com o nome **`chave-painel.txt`**.
4. Crie a pasta `C:\Users\SEU-NOME\.claude\skills\painel-conteudo` e salve nela o arquivo **`SKILL.md`** que a Érika mandou.
5. Abra o **Claude Code** (app do Claude, aba Code), escolha uma pasta vazia e peça: *"Baixe (clone) o repositório https://github.com/erikahperes-hub/painel-bodhi.git aqui e me deixe pronta para mexer no painel"*. Na primeira vez o Git abre uma janela para entrar no GitHub: entre com a conta dela.
6. Teste: peça ao Claude *"abra o painel em modo local e me mostre"*. Para entrar no painel de verdade, use `milena@bodhi.marketing` em painel.bodhi.marketing.
7. **Asaas (financeiro):** a Milena cola a chave do Asaas sozinha no Supabase, em **Edge Functions > Secrets**, com o nome `ASAAS_API_KEY`. A chave nunca é enviada para a Érika nem para o Claude, e nunca vai para o código.

## Como pedir mudanças no dia a dia

Abra o Claude Code na pasta do painel e peça em português ("quero uma tela de despesas por mês"). O Claude lê o `CLAUDE.md`, edita, testa, confere, publica e atualiza a LEIA-ME. Antes de começar, ele baixa o que a outra sócia publicou, então as duas podem trabalhar sem se atropelar.

## Primeira tarefa da Milena

Financeiro: despesas e lucro (veja o item 1 do arquivo `PROXIMOS-PASSOS.md`). Os extratos e os dados de despesa ficam só no Supabase, nunca no GitHub.
