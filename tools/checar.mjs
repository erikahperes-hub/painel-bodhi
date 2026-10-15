// Uso: node tools/checar.mjs
// Rede de proteção antes de publicar (e roda sozinha no GitHub a cada envio). Sem instalar nada.
// Confere: 1) todo arquivo .js abre sem erro de sintaxe; 2) todos os imports usam o MESMO número de versão
// (o do index.html); 3) nenhum arquivo de código tem chave secreta; 4) a pasta seed/ (dados reais) não está no git.
import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const raiz = join(fileURLToPath(import.meta.url), '..', '..');
const problemas = [];

async function arquivosJs(dir) {
  const itens = await readdir(dir, { withFileTypes: true });
  const lista = await Promise.all(itens.map((i) => (i.isDirectory() ? arquivosJs(join(dir, i.name)) : /\.js$/.test(i.name) ? [join(dir, i.name)] : [])));
  return lista.flat();
}
const arquivos = await arquivosJs(join(raiz, 'js'));

// 1) sintaxe: um único Node lê todos os arquivos como módulo e só confere se abrem (não executa nada). Rápido.
const LER = `const vm = require('node:vm'), fs = require('node:fs');
let erros = [];
for (const f of process.argv.slice(1)) {
  try { new vm.SourceTextModule(fs.readFileSync(f, 'utf8'), { identifier: f }); }
  catch (e) { erros.push({ f, m: String(e.message).split('\\n')[0] }); }
}
process.stdout.write(JSON.stringify(erros));`;
try {
  const saida = execFileSync(process.execPath, ['--no-warnings', '--experimental-vm-modules', '-e', LER, ...arquivos], { stdio: 'pipe', maxBuffer: 1 << 24 }).toString();
  for (const e of JSON.parse(saida || '[]')) problemas.push(`Erro de sintaxe em ${relative(raiz, e.f)}: ${e.m}`);
} catch (e) { problemas.push(`Não consegui conferir a sintaxe: ${String(e.stderr || e.message).split('\n')[0]}`); }

// 2) versões
const indexHtml = await readFile(join(raiz, 'index.html'), 'utf8');
const versaoSite = indexHtml.match(/js\/main\.js\?v=(\d+)/)?.[1];
if (!versaoSite) problemas.push('index.html não tem o número de versão em js/main.js?v=...');
const usadas = new Map();
for (const arq of arquivos) {
  const texto = await readFile(arq, 'utf8');
  for (const m of texto.matchAll(/\.js\?v=(\d+)/g)) {
    if (!usadas.has(m[1])) usadas.set(m[1], new Set());
    usadas.get(m[1]).add(relative(raiz, arq));
  }
}
for (const pagina of ['index.html', 'aprovar.html']) {
  const html = await readFile(join(raiz, pagina), 'utf8');
  for (const m of html.matchAll(/(?:css\/app\.css|js\/(?:main|aprovar)\.js)\?v=(\d+)/g)) {
    if (!usadas.has(m[1])) usadas.set(m[1], new Set());
    usadas.get(m[1]).add(pagina);
  }
}
if (versaoSite && (usadas.size > 1 || !usadas.has(versaoSite))) {
  const resumo = [...usadas].map(([v, arqs]) => `v=${v} em ${arqs.size} arquivo(s), ex.: ${[...arqs][0]}`).join('; ');
  problemas.push(`As versões estão misturadas (${resumo}). Rode: node tools/versionar.mjs`);
}

// 3) segredos no código (a chave "anon" do Supabase e a chave do Drive são públicas por desenho e podem ficar)
const SEGREDOS = [/service_role/i, /sb_secret_[A-Za-z0-9_-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\basaas[_-]?api[_-]?key\s*[:=]\s*['"][^'"]{12,}/i];
for (const arq of arquivos) {
  const texto = await readFile(arq, 'utf8');
  for (const re of SEGREDOS) if (re.test(texto)) problemas.push(`Parece haver uma chave secreta em ${relative(raiz, arq)} (${re.source.slice(0, 30)}). Chaves secretas nunca vão no site.`);
}

// 4) seed/ (dados reais de clientes) nunca vai para o GitHub
try {
  const rastreados = execFileSync('git', ['ls-files', 'seed'], { cwd: raiz, stdio: 'pipe' }).toString().trim();
  if (rastreados) problemas.push('A pasta seed/ (dados reais) está no git. Ela nunca deve ser enviada: git rm -r --cached seed');
} catch { /* fora de um repositório git: ignora */ }

if (problemas.length) {
  console.error(`\nEncontrei ${problemas.length} problema(s) antes de publicar:\n`);
  problemas.forEach((p, i) => console.error(`${i + 1}. ${p}`));
  console.error('\nCorrija e rode de novo: node tools/checar.mjs\n');
  process.exit(1);
}
console.log(`Tudo certo: ${arquivos.length} arquivos de código sem erro, versão ${versaoSite} igual em todo o site, sem segredos e sem seed/ no git.`);
