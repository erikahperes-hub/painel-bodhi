# Painel Bôdhi

Sistema interno da Bôdhi Marketing: clientes, comercial, propostas, contratos e financeiro (com Asaas), em um só lugar.
Endereço final: **https://painel.bodhi.marketing**

## Como ele funciona (em uma frase)

O site (pasta `painel-bodhi`) fica no GitHub Pages e **não guarda nenhum dado de cliente**. Os dados ficam no Supabase, protegidos por login. Só quem tem e-mail e senha vê as informações. A chave do Asaas fica guardada no servidor do Supabase, nunca no site.

> Por que não colocar os dados dentro do site? Porque o GitHub Pages é público: qualquer pessoa com o link conseguiria ler CNPJs, valores e contratos.

## Editar as informações no dia a dia

Tudo se edita dentro do próprio painel, sem precisar do Claude:

- **Clientes:** botão “Editar ficha” (inclui logo ou imagem, contato, escopo, dados da empresa).
- **Propostas:** “Nova proposta” ou “Editar”, depois “Gerar PDF”.
- **Contratos:** “Novo contrato” ou “Editar”, depois “Gerar contrato em PDF”.
- **Comercial:** lápis nos cartões (canais, perfil-alvo, motivos de saída) e lista de pendências.
- **Configurações:** dados da Bôdhi, modelo de contrato (cláusulas editáveis) e backup.
- A **busca** do topo (atalho `/` ou `Ctrl+K`) encontra clientes, propostas, contratos, pendências e textos do comercial.

## Passo 1: testar no computador (opcional)

Precisa do Node instalado. Na pasta `painel-bodhi`:

```bash
node tools/serve.mjs
```

Abra http://localhost:5173. Nesse modo os dados vêm do arquivo `seed/seed.json` e ficam só no seu navegador. A pasta `seed` **não vai para o GitHub** (está no `.gitignore`).

## Passo 2: banco de dados e login (Supabase, plano gratuito)

1. Crie uma conta em supabase.com e um novo projeto (região South America, São Paulo). Guarde a senha do banco.
2. Menu **Authentication** > **Sign In / Providers** > desligue **Allow new users to sign up** (assim ninguém de fora cria conta). Faça isto primeiro.
3. Menu **SQL Editor** > New query > cole o conteúdo de `supabase/schema.sql` > **Run**. (Antes de rodar, na parte `insert into public.socias`, tire o `--` da linha da Milena e troque pelo e-mail dela. Só e-mails dessa lista enxergam os dados.)
4. Menu **Authentication** > **Users** > **Add user** > **Create new user**: crie o acesso da Érika e da Milena (e-mail, senha e marque “Auto Confirm User”).
5. Menu **Authentication** > **URL Configuration**: em Site URL coloque `https://painel.bodhi.marketing` (usado no “Esqueci minha senha”).
6. Menu **Project Settings** > **API**: copie a **Project URL** e a chave **anon public**.
7. Abra `js/config.js` e preencha `supabaseUrl` e `supabaseKey` com esses dois valores (já feito para o projeto atual). A chave anon é pública por desenho: quem protege os dados é o login mais a lista de sócias.
8. Para importar os dados já validados: no computador rode `node tools/seed-para-sql.mjs`, abra `seed/seed.sql`, copie tudo, cole em um novo SQL Editor e clique em **Run**.

## Passo 3: colocar no ar (GitHub Pages + domínio)

O DNS já está feito na Hostinger: `painel.bodhi.marketing` aponta (CNAME) para `erikahperes-hub.github.io`.

1. No GitHub (conta `erikahperes-hub`), crie um repositório **público** chamado `painel-bodhi`, vazio.
2. Na pasta `painel-bodhi`:

```bash
git remote add origin https://github.com/erikahperes-hub/painel-bodhi.git
git push -u origin main
```

3. No repositório: **Settings** > **Pages** > Source: **Deploy from a branch** > Branch `main`, pasta `/ (root)` > Save.
4. Ainda em Pages, em **Custom domain** confirme `painel.bodhi.marketing` (o arquivo `CNAME` já traz isso) e marque **Enforce HTTPS** quando a opção liberar (pode levar alguns minutos).
5. Depois, cada mudança no código é publicada com `git push`. Antes de publicar, rode `node tools/versionar.mjs N` (N = próximo número): ele coloca a mesma versão em todos os arquivos, para o navegador nunca misturar arquivos velhos e novos. Mudanças de **dados** não precisam de push: são feitas no painel.

## Passo 4: conectar o Asaas

1. No Asaas: **Integrações** > **Chave de API** > gere uma chave. (Para testar antes, use o Sandbox do Asaas.)
2. No Supabase: **Edge Functions** > **Deploy a new function** > **Via Editor**. Nome: `asaas`. Cole o conteúdo de `supabase/functions/asaas/index.ts` e faça o deploy.
3. **Edge Functions** > **Secrets** > adicione `ASAAS_API_KEY` com a chave (e `ASAAS_ENV` com o valor `sandbox` se for teste; em produção não precisa criar).
4. No painel, abra **Financeiro**: o cartão “Cobranças no Asaas” passa a mostrar pago, pendente e atrasado, e o botão **Nova cobrança** cria a cobrança direto no Asaas.

## Liberar o acesso de mais uma pessoa (ou da Milena, se ela não conseguir editar)

Quem está na lista de sócias tem exatamente os mesmos poderes: ver e editar tudo. Para liberar um e-mail, no Supabase abra **SQL Editor**, cole e clique em Run (troque pelo e-mail real, o mesmo do login):

```sql
insert into public.socias (email) values ('email-da-pessoa@exemplo.com') on conflict do nothing;
```

Para ver quem está liberado: `select * from public.socias;`

## Importar os clientes anteriores (ou qualquer lote de clientes)

No painel: **Configurações > Restaurar de um backup** e escolha o arquivo `seed/clientes-inativos.json`. Ele só **acrescenta ou atualiza** os clientes daquele arquivo, sem mexer nos outros dados.

## Processo

A aba **Processo** (ícone de fluxo na lateral) guarda o passo a passo da Bôdhi Marketing, começando por “Fechei uma estratégia, e agora?”. Use **Editar** para mudar etapas e passos e **Novo processo** para documentar outros fluxos.

## Entrar no painel

Os logins são **erika@bodhi.marketing** e **milena@bodhi.marketing** (o e-mail de login não é o Gmail). Se a senha for recusada no celular, toque em **Mostrar** para conferir o que foi digitado: o painel já desliga a maiúscula automática e tenta sozinho tirar espaços que o teclado do celular deixa sobrando. **Esqueci minha senha** manda um e-mail com um link que abre a tela **Criar nova senha**.

## Conteúdo e aprovação do cliente

A aba **Conteúdo** tem duas visões: **Status** (quadro por etapa) e **Calendário** (mês com as peças nas datas de publicação). No computador, **arraste os cartões entre as colunas** para mudar a etapa (ao soltar em Ajustes, a peça abre para anotar o pedido) e, no Calendário, **arraste uma peça para outro dia** para mudar a data de publicação. No celular valem os botões de cada cartão.

**Como as artes chegam ao cliente:**
1. As artes, carrosséis e vídeos ficam numa **pasta do Google Drive** compartilhada como **“Qualquer pessoa com o link”** (leitor). O espaço usado é o do Drive, não o do Supabase.
2. Na peça (Conteúdo > Nova peça), cole o link de cada arquivo em **Arquivos da peça** (imagem ou vídeo) e o link da **capa**. O painel guarda só o código do arquivo.
3. Coloque a peça na etapa **Aguardando aprovação**. Só as peças dessa etapa em diante aparecem para o cliente.
4. Em Conteúdo, escolha o cliente e use **Prévia do cliente** para ver como ele enxerga, e **Link de aprovação** para copiar o link dele. O link abre sem senha e mostra só as peças daquele cliente. **Gerar novo link** desativa o antigo.
5. O cliente aprova ou pede alteração no próprio link. A peça muda sozinha para **Aprovado** ou **Ajustes** no painel (o pedido aparece no cartão e no sino).

**Adicionar em lote:** em Conteúdo, o botão ao lado de **Nova peça** adiciona várias peças de uma vez a partir de um arquivo `.json` (preparado pelo Claude a partir da pasta do Drive e das legendas). Formato simples, com o cliente pelo **nome**:

```json
{ "pecas": [ { "clienteNome": "TRE Clinic", "titulo": "Reels de teste", "formato": "reels", "publicar": "2026-10-20", "etapa": "aprovacao", "legenda": "Texto da legenda", "capa": "link ou código do arquivo no Drive", "midias": [ { "tipo": "video", "id": "link ou código do arquivo no Drive" } ] } ] }
```

**Adicionar peças (várias de uma vez):** em Conteúdo, o botão **Adicionar peças** (ao lado de **Nova peça**, que cria uma peça só) abre a escolha entre três formas, cada uma com uma explicação: **Colar planejamento** (tabela de ideias do mês), **Importar da pasta do Drive** (artes e vídeos pelo nome do arquivo) e **Arquivo de peças (.json)** (casos especiais, como trazer histórico de outra ferramenta). Os parágrafos abaixo descrevem cada uma.

**Concluir tarefa (como no Asana):** cada peça tem um círculo pequeno no cartão (aba Status) e no bloco do calendário. Clique nele para marcar a tarefa como **concluída**: o círculo fica verde com um visto e a peça perde a cor do tipo e fica cinza (sem riscar). Clique de novo para reabrir. Concluir **não muda a etapa** da peça (Planejamento, Criação...), é só o controle de "feito" para vocês se organizarem no calendário; peça concluída **não conta como atrasada**. Ao mover uma peça para **Publicado**, ela é marcada como concluída sozinha. Também dá para marcar no campo "Tarefa" dentro da peça. No arquivo de lote use `"concluida": true`. O círculo do calendário funciona com o teclado (Enter ou Espaço).

**Planejamento direto pelo Claude Code (sem colar nada):** o Claude Code de quem tem uma "chave de importação" sobe as ideias direto no painel (etapa Planejamento), chamando a função `importar_planejamento` do Supabase (`supabase/importacao.sql`, instalada uma vez no SQL Editor). A chave só consegue **adicionar** ideias novas: não lê dados, não altera nem apaga nada, não cria cliente e não manda nada ao cliente. O banco guarda só o hash da chave (tabela `importacao_chaves`); a chave em si fica num arquivo no computador de cada pessoa, em `C:\Users\NOME\.bodhi\chave-painel.txt`, fora do GitHub e fora da skill. Para dar uma chave a alguém: gere 40 caracteres aleatórios, guarde o texto no arquivo da pessoa e rode `insert into public.importacao_chaves (nome, hash) values ('Nome', encode(sha256(convert_to('A-CHAVE','UTF8')),'hex'));` no SQL Editor. Para cancelar: `update public.importacao_chaves set ativa = false where nome = 'Nome';`. Para ver quem importou: as peças criadas ficam com "importação (Nome)" no campo `updated_by` da tabela `records`. A skill `painel-conteudo` (seção 5c) ensina o Claude Code a usar isso.

**Colar planejamento:** em Conteúdo, o botão **Colar planejamento** cria as ideias do mês direto de uma tabela colada, sem arquivo. Cole a tabela inteira que o Claude entregou no chat, com a linha "Cliente: Nome" em cima (o painel reconhece o cliente sozinho; se preferir, escolha na lista), e confirme: antes de adicionar, o painel mostra o resumo das ideias lidas. Também serve uma planilha copiada. Colunas reconhecidas pelo cabeçalho: Data, Formato, Funil, Título, Ideia e roteiro, Legenda e, se quiser, Observações internas ou Cliente. A coluna "Nome final do arquivo" é ignorada. Data sem ano (11/10) vale o ano atual. As peças entram na coluna Planejamento; linhas sem título são ignoradas. Usa o mesmo caminho do lote (pede confirmação, completa só o que está vazio, não apaga nada).

**Importar da pasta:** em Conteúdo, o botão **Importar da pasta** lê direto uma pasta do Drive, sem arquivo `.json`. Cole o link da pasta do cliente (ex.: Aprovação / TRE Clinic) ou de um mês (ex.: 2026-10); as subpastas entram junto (as que começam com `_` são puladas). O painel agrupa os arquivos pelo nome padrão `AAAA-MM-DD_formato_titulo[_NN|_capa].ext` (slides pelo `_NN`, capa pelo `_capa`, legenda num `.txt` com o mesmo nome da peça), identifica o cliente pelo nome da pasta, mostra quantas peças vai criar e só então adiciona, pelo mesmo caminho do lote (completa o que está vazio, não apaga nada). Arquivos fora do padrão são ignorados e o painel avisa quantos. O título sai do nome do arquivo, sem acento (ex.: "Tipos de cicatrizacao"); se a peça já existia no planejamento, ela mantém o título dela. Funciona com a chave do Google em `js/config.js` (`driveKey`), criada no Google Cloud (projeto "My First Project", conta erikahperes@gmail.com, API Drive ativada, sem faturamento). A chave só lê o Drive e só funciona em painel.bodhi.marketing (restrição por site); por isso o botão não funciona em localhost. Se um dia precisar trocar, crie outra chave em APIs e serviços > Credenciais com as mesmas restrições e troque no config.js.

**Aprovação do planejamento pelo cliente (opcional):** para clientes que querem aprovar as ideias antes da produção, em Conteúdo escolha o cliente e clique em **Enviar planejamento**: todas as ideias que estão no Planejamento vão para a aba **Planejamento** do link dele (dia, formato, título e o texto de "Ideia e roteiro"). Ele aprova uma a uma, pede alteração ou aprova o mês todo. No painel a peça mostra "Plano enviado", "Plano aprovado" ou "Plano: ajuste", e o pedido do cliente aparece no cartão e no sino. Atenção: o texto de **Ideia e roteiro** fica visível para o cliente nas peças enviadas; anotações internas vão em "Planejamento e observações internas". Exige rodar a versão 2 do arquivo supabase/aprovacao.sql no Supabase.

**Etapa do funil:** cada peça tem a **Etapa do funil** (topo, meio ou fundo), que aparece como etiqueta no cartão e num resumo "Topo 3, Meio 4, Fundo 2" acima do quadro. Nas peças enviadas para aprovação do planejamento, o cliente também vê a etapa.

**Planejamento primeiro, produção depois:** a peça tem o campo **Ideia e roteiro** (interno enquanto o planejamento não é enviado; depois de enviado, o cliente lê). Dá para adicionar só o planejamento (data, formato, título, roteiro, etapa planejamento) e, depois, adicionar outro lote com os arquivos e a legenda: o painel liga à peça do planejamento pela mesma data e formato (ou pelo título), completa só o que estava vazio e tira a peça do Planejamento. Os cartões mostram "Roteiro", "Sem arte" e "Sem legenda".

Formatos: feed, carrossel, reels, story. Etapas: planejamento, criacao, aprovacao, ajustes, aprovado, publicado (sem etapa, entra em criacao). Notas só da equipe vão no campo `observacoes` ("Observações internas" no painel); os nomes antigos `etapa: "briefing"` e `briefing` continuam funcionando, para backups e dados antigos. Cria só o que ainda não existe, ignora clientes que não estão no painel e não apaga o que vocês editaram. Também aceita o formato de backup.

**Vídeos com player próprio (já ligado):** os vídeos tocam por um Worker gratuito do Cloudflare (`https://bodhi-midia.erikahperes.workers.dev`, conta erikahperes@gmail.com), que busca o arquivo no Drive e entrega com player de verdade, sem faixa preta e sem o botão que abre o Drive. O Worker só atende pedidos vindos de painel.bodhi.marketing. O código está em `cloudflare/worker-midia.js` (legível) e `cloudflare/worker-midia.min.js` (a versão de uma linha que está publicada no Cloudflare, equivalente). O endereço fica em `js/config.js`, campo `midiaProxy`. Se o Worker falhar, a página volta sozinha para o player do Drive. Limite do plano gratuito do Cloudflare: 100 mil pedidos por dia.

**Ativar uma vez (Supabase):** abra o SQL Editor, cole o conteúdo de `supabase/aprovacao.sql` e clique em Run. Sem isso, o botão “Link de aprovação” avisa que falta ativar.

**O que o cliente vê no link (só o que importa agora):** as peças que **aguardam a resposta dele** (aprovação ou pedido de ajuste, mesmo que a data já tenha passado) e as aprovadas ou publicadas **do começo do mês passado em diante** (para o calendário e o feed mostrarem o mês passado inteiro e o atual). Do mês passado, só entra a peça que **tem arte** (sem arquivo não há o que mostrar). Mais antigo que isso não aparece, para a página ficar limpa e leve. O filtro é feito no banco (função `aprovacao_ver`, versão 3 de `supabase/aprovacao.sql`), então vale também para quem tentar ler o link por fora. Isso permite importar o histórico de um cliente (como as tarefas do Asana) sem poluir a página dele.

**Observações:** o título da peça aparece para o cliente na lista do calendário, então use nomes que ele possa ler. Os vídeos tocam no player do Drive. O Google às vezes demora ou recusa uma imagem; a página tenta de novo sozinha.

## Modelo de contrato

O modelo padrão é uma **minuta em revisão**. Edite as cláusulas em **Configurações > Modelo de contrato** (permanência mínima, multa e reajuste só aparecem no contrato quando preenchidas). Recomenda-se revisão jurídica antes de usar com clientes.

## Backup

**Configurações > Baixar backup** salva um arquivo `.json` com tudo. Guarde uma cópia de vez em quando.

## Estrutura da pasta

```
index.html           entrada do painel (com login)
aprovar.html         página pública de aprovação do cliente (sem login, só com o link)
css/app.css          visual (paleta, fontes e formas da marca)
js/                  telas, busca, geração de PDF, ligação com Supabase e Asaas
assets/              fontes e logo oficiais da Bôdhi
supabase/            schema.sql (banco) e função do Asaas
tools/               servidor local e conversor de dados
seed/                dados validados (fica só no seu computador)
CNAME                domínio do painel
```
