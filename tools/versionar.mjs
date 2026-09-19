// Uso: node tools/versionar.mjs 14
// Coloca o mesmo número de versão em TODOS os imports do site, para o navegador nunca misturar arquivos velhos e novos
// (o GitHub Pages guarda cada arquivo em cache por alguns minutos).
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const versao = process.argv[2];
if (!/^\d+$/.test(versao || '')) { console.error('Informe o número da versão, por exemplo: node tools/versionar.mjs 14'); process.exit(1); }
const raiz = join(fileURLToPath(import.meta.url), '..', '..');

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
const html = join(raiz, 'index.html');
await writeFile(html, (await readFile(html, 'utf8')).replace(/(css\/app\.css|js\/main\.js)(\?v=\d+)?/g, `$1?v=${versao}`), 'utf8');
console.log(`Versão ${versao} aplicada (${alterados} arquivos de código e o index.html).`);
