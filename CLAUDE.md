# Painel Bôdhi: regras para qualquer sessão do Claude Code

Este é o painel interno da Bôdhi Marketing (painel.bodhi.marketing). Quem pede mudanças aqui (Érika ou Milena) **não é desenvolvedora**: explique em português simples, decida o caminho em vez de oferecer menus e execute. As duas têm o mesmo poder sobre o painel, incluindo mexer no código.

## Como o projeto é feito

- Site estático (GitHub Pages), JavaScript puro em módulos, sem build e sem npm. Rotas por hash. Cada tela fica em `js/views/` e devolve `{titulo, sub, render, montar, acoes}`; ações globais usam `data-act`.
- Dados: Supabase (login + RLS). Todas as sócias lêem, gravam e apagam tudo. O cliente só vê a página `aprovar.html#token`, por funções (RPC) do banco. **Nunca** expor dado de cliente em arquivo público.
- Teste local sem login e sem tocar nos dados reais: `node tools/serve.mjs` e abrir `http://localhost:5173/?local` (dados só no navegador).
- Regras de negócio do conteúdo (formatos, etapas, o que o cliente enxerga) estão no `LEIA-ME.md`, seção "Conteúdo e aprovação do cliente". Leia antes de mexer nessa área.

## Fluxo obrigatório de toda mudança

1. `git pull` antes de começar (a outra pessoa pode ter publicado).
2. Faça a mudança. Se mexer no visual ou numa tela, **abra e teste** com `?local` (navegador do Claude ou Terminal), não basta "parecer certo".
3. `node tools/checar.mjs` (sintaxe, versões, segredos). Só continue se ele disser "Tudo certo".
4. `node tools/versionar.mjs` **sem número**: sobe sozinho a versão `?v=N` de todos os imports (é o que faz o navegador buscar o arquivo novo em vez do cache). Se esquecer, o painel pode abrir com arquivos misturados.
5. Atualize o `LEIA-ME.md` se mudou algo que a Érika ou a Milena precisam saber para usar ou editar.
6. Commit com mensagem curta em português dizendo o que mudou para quem usa, e `git push`. O GitHub Pages publica sozinho em 1 a 2 minutos. O GitHub também roda `checar.mjs` a cada envio.
7. Se der conflito no pull/push (as duas editaram ao mesmo tempo): resolva mantendo as duas mudanças, rode `versionar` de novo e confira no `?local` antes de enviar.

## Nunca

- Commitar a pasta `seed/` (dados reais de clientes), chaves secretas (`service_role`, chave do Asaas, tokens, `chave-painel.txt`), nem backups `.json` de clientes. Só valem no código: a chave `anon` do Supabase e a chave do Drive (públicas por desenho, restritas por domínio).
- Mudar `supabase/*.sql` direto no site. Alterar o banco = editar o arquivo em `supabase/` **e** rodar no SQL Editor do Supabase, e dizer isso à pessoa, passo a passo, com o texto pronto para colar. Nunca rodar `drop`, `truncate` ou `delete` em massa sem a pessoa pedir com todas as letras.
- Apagar dados de clientes por conta própria.
- `git push --force`, reescrever histórico ou usar `--no-verify`.

## Cuidados técnicos

- Arquivos do repositório usam fim de linha LF. Se um editor converter para CRLF, o diff vira o arquivo inteiro: não deixe.
- Todo `import` entre arquivos de `js/` leva `?v=N`. Para arquivo novo, copie o formato dos vizinhos e rode `versionar`.
- Peças de conteúdo: na tela chamam-se **tarefas**; formatos: Reels, Carrossel, Estático (id interno `feed`) e Story. Etapa "Planejamento" tem id interno `briefing`. Não renomeie ids internos, só rótulos.
- Mexeu em algo que o cliente enxerga? Confira `js/instagram.js` (usado pela prévia e pela `aprovar.html`) e a regra de visibilidade em `supabase/aprovacao.sql` (`aprovacao_ver`), que precisam continuar iguais a `js/views/previa.js`.

## Marca e texto

- Identidade Bôdhi em tudo que aparece (paleta, fontes e formas em `css/app.css`; logo e fontes em `assets/`). Não inventar cor nem fonte nova.
- Escreva "Bôdhi Marketing" por extenso nos textos. Sem travessão (—) em textos para clientes e na interface; use vírgula, ponto ou dois-pontos.
- Texto da interface em português do Brasil, direto, sem jargão técnico.
