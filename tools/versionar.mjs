// Uso: node tools/versionar.mjs        (sobe sozinho para a próxima versão; é o jeito certo de usar)
//      node tools/versionar.mjs 14     (força um número específico)
// Coloca o mesmo número de versão em TODOS os imports do site, para o navegador nunca misturar arquivos velhos e novos
// (o GitHub Pages guarda cada arquivo em cache por alguns minutos).
// Sem número, lê a versão atual do index.html e soma 1. Assim duas pessoas nunca escolhem o mesmo número por engano.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const raiz = join(fileURLToPath(import.meta.url), '..', '..');
let versao = process.argv[2];
if (!versao) {
  const atual = (await readFile(join(raiz, 'index.html'), 'utf8')).match(/js\/main\.js\?v=(\d+)/)?.[1];
  if (!atual) { console.error('Não achei a versão atual no index.html.'); process.exit(1); }
  versao = String(Number(atual) + 1);
}
if (!/^\d+$/.test(versao)) { console.error('Informe só o número da versão, por exemplo: node tools/versionar.mjs 14 (ou deixe sem número para subir sozinho).'); process.exit(1); }

async function arquivosJs(dir) {
  const itens = await readdir(dir, { withFileTypes: true });
  const lista = await Promise.all(itens.map((i) => (i.isDirectory() ? arquivosJs(join(dir, i.name)) : /\.js$/.test(i.name) ? [join(dir, i.name)] : [])));
  return lista.flat();
}

let alterados = 0;
for (const arq of await arquivosJs(join(raiz, 'js'))) {
  const antes = await readFile(arq, 'utf8');
  const depois = antes
    .replace(/(\bfrom\s+['"])(\.{1,2}\/[^'"?]+\.js)(\?v=\d+)?(['"])/g, `$1$2?v=${versao}$4`)
    .replace(/(\bimport\(\s*['"])(\.{1,2}\/[^'"?]+\.js)(\?v=\d+)?(['"])/g, `$1$2?v=${versao}$4`);
  if (depois !== antes) { await writeFile(arq, depois, 'utf8'); alterados += 1; }
}
for (const pagina of ['index.html', 'aprovar.html']) {
  const html = join(raiz, pagina);
  await writeFile(html, (await readFile(html, 'utf8')).replace(/(css\/app\.css|js\/main\.js|js\/aprovar\.js)(\?v=\d+)?/g, `$1?v=${versao}`), 'utf8');
}
console.log(`Versão ${versao} aplicada (${alterados} arquivos de código, index.html e aprovar.html).`);
