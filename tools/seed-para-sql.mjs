// Converte seed/seed.json em seed/seed.sql, para colar no SQL Editor do Supabase (importa os dados de uma vez).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const raiz = join(fileURLToPath(import.meta.url), '..', '..');
const seed = JSON.parse(await readFile(join(raiz, 'seed', 'seed.json'), 'utf8'));
const q = (s) => `'${String(s).replaceAll("'", "''")}'`;

const linhas = seed.registros.map(
  (r) => `(${q(r.kind)}, ${q(r.id)}, $json$${JSON.stringify(r.data)}$json$::jsonb)`,
);
const sql = `insert into public.records (kind, id, data) values\n${linhas.join(',\n')}\non conflict (kind, id) do update set data = excluded.data;\n`;
await writeFile(join(raiz, 'seed', 'seed.sql'), sql, 'utf8');
console.log(`seed/seed.sql gerado com ${linhas.length} registros.`);
