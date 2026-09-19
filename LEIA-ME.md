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
5. Depois, cada mudança no código é publicada com `git push`. Mudanças de **dados** não precisam de push: são feitas no painel.

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

## Processo

A aba **Processo** (ícone de fluxo na lateral) guarda o passo a passo da Bôdhi Marketing, começando por “Fechei uma estratégia, e agora?”. Use **Editar** para mudar etapas e passos e **Novo processo** para documentar outros fluxos.

## Modelo de contrato

O modelo padrão é uma **minuta em revisão**. Edite as cláusulas em **Configurações > Modelo de contrato** (permanência mínima, multa e reajuste só aparecem no contrato quando preenchidas). Recomenda-se revisão jurídica antes de usar com clientes.

## Backup

**Configurações > Baixar backup** salva um arquivo `.json` com tudo. Guarde uma cópia de vez em quando.

## Estrutura da pasta

```
index.html           entrada do site
css/app.css          visual (paleta, fontes e formas da marca)
js/                  telas, busca, geração de PDF, ligação com Supabase e Asaas
assets/              fontes e logo oficiais da Bôdhi
supabase/            schema.sql (banco) e função do Asaas
tools/               servidor local e conversor de dados
seed/                dados validados (fica só no seu computador)
CNAME                domínio do painel
```
