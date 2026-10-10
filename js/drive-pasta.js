// "Importar da pasta": lê uma pasta do Google Drive (compartilhada como "qualquer pessoa com o link") e transforma
// os arquivos com o nome padrão em peças, no mesmo formato do "Adicionar em lote".
//   AAAA-MM-DD_formato_titulo-curto[_NN | _capa].extensão   (veja a skill painel-conteudo)
// A chave do Google é pública por desenho: só vale para a API do Drive e só para o endereço do painel.

const API = 'https://www.googleapis.com/drive/v3/files';
const norm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
// O formato no nome do arquivo é reels, carrossel, estatico ou story ("feed" também vale, dos arquivos antigos).
const NOME = /^(?:(\d{4}-\d{2}-\d{2})_)?(estatico|feed|carrossel|reels|story)_(.+?)(?:_(capa|\d{1,2}))?\.([A-Za-z0-9]+)$/i;
const MES = /^\d{4}-\d{2}$/;

// Aceita o link da pasta (…/folders/CODIGO ou …?id=CODIGO) ou o próprio código. Devolve o código ou ''.
export function idPasta(entrada) {
  const t = String(entrada || '').trim();
  if (/^[\w-]{20,}$/.test(t)) return t;
  try {
    const u = new URL(t);
    if (!/(^|\.)google\.com$/.test(u.hostname)) return '';
    return u.pathname.match(/\/folders\/([\w-]{20,})/)?.[1] || (u.searchParams.get('id') || '').match(/^[\w-]{20,}$/)?.[0] || '';
  } catch { return ''; }
}

async function chamar(buscar, url, texto = false) {
  let r;
  try { r = await buscar(url); } catch { throw new Error('Não consegui falar com o Google. Confira a internet e tente de novo.'); }
  if (r.ok) return texto ? r.text() : r.json();
  if (r.status === 404) throw new Error('Não encontrei essa pasta. Confira o link e se ela está compartilhada como “qualquer pessoa com o link”.');
  if (r.status === 403 || r.status === 400) throw new Error('O Google recusou o pedido. A leitura só funciona pelo endereço painel.bodhi.marketing e com a pasta compartilhada como “qualquer pessoa com o link”.');
  throw new Error(`O Google respondeu com erro (${r.status}). Tente de novo em instantes.`);
}

const dados = (buscar, chave, id, campos) => chamar(buscar, `${API}/${encodeURIComponent(id)}?${new URLSearchParams({ fields: campos, key: chave })}`);

async function filhos(buscar, chave, id) {
  const saida = [];
  let token = '';
  do {
    const p = new URLSearchParams({ q: `'${id}' in parents and trashed=false`, fields: 'nextPageToken,files(id,name,mimeType)', pageSize: '1000', key: chave });
    if (token) p.set('pageToken', token);
    const r = await chamar(buscar, `${API}?${p}`);
    saida.push(...(r.files || []));
    token = r.nextPageToken || '';
  } while (token);
  return saida;
}

const capitalizar = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

// Agrupa arquivos [{ id, name, mimeType, caminho: ['TRE Clinic', '2026-10'] }] em peças. Função pura (testável sem rede).
export function montarPecas(arquivos, clientes = []) {
  const nomesClientes = new Map(clientes.map((c) => [norm(c), c]));
  const grupos = new Map();
  const ignorados = [];
  for (const a of arquivos) {
    const m = String(a.name || '').match(NOME);
    const mime = String(a.mimeType || '');
    const tipo = mime.startsWith('image/') ? 'imagem' : mime.startsWith('video/') ? 'video' : (mime === 'text/plain' ? 'texto' : '');
    if (!m || !tipo) { if (!mime.includes('folder')) ignorados.push(a.name); continue; }
    const [, data = '', formatoNome, titulo, sufixo = ''] = m;
    const formato = formatoNome.toLowerCase() === 'estatico' ? 'feed' : formatoNome; // o código interno do estático é "feed"
    const cliente = (a.caminho || []).map((s) => nomesClientes.get(norm(s))).find(Boolean) || [...(a.caminho || [])].reverse().find((s) => !MES.test(s)) || '';
    const chave = [norm(cliente), data, formato.toLowerCase(), norm(titulo)].join('|');
    if (!grupos.has(chave)) grupos.set(chave, { cliente, data, formato: formato.toLowerCase(), titulo, arquivos: [] });
    grupos.get(chave).arquivos.push({ ...a, tipo, sufixo: sufixo.toLowerCase() });
  }
  const pecas = [];
  for (const g of grupos.values()) {
    const num = (x) => (/^\d+$/.test(x.sufixo) ? Number(x.sufixo) : 0);
    const imagens = g.arquivos.filter((x) => x.tipo === 'imagem').sort((x, y) => num(x) - num(y));
    const videos = g.arquivos.filter((x) => x.tipo === 'video');
    const textos = g.arquivos.filter((x) => x.tipo === 'texto');
    // Reels e story em vídeo: a imagem do grupo é a capa (com ou sem "_capa" no nome).
    const capa = videos.length ? (imagens.find((x) => x.sufixo === 'capa') || imagens[0]) : imagens.find((x) => x.sufixo === 'capa');
    const slides = videos.length ? [] : imagens.filter((x) => x !== capa);
    const midias = [...videos.map((x) => ({ tipo: 'video', id: x.id })), ...slides.map((x) => ({ tipo: 'imagem', id: x.id }))];
    const peca = { clienteNome: g.cliente, titulo: capitalizar(g.titulo.replace(/-+/g, ' ').trim()), formato: g.formato, publicar: g.data, midias };
    if (capa) peca.capa = capa.id;
    if (textos.length) peca._legendaId = textos[0].id;
    pecas.push(peca);
  }
  pecas.sort((x, y) => (x.publicar || '9').localeCompare(y.publicar || '9') || x.titulo.localeCompare(y.titulo));
  return { pecas, ignorados };
}

// Lê a pasta (e as subpastas, até 3 níveis) e devolve { pecas, ignorados }.
export async function lerPasta(entrada, { chave, clientes = [], buscar = (u) => fetch(u) } = {}) {
  if (!chave) throw new Error('A chave do Google não está configurada (js/config.js, driveKey).');
  const id = idPasta(entrada);
  if (!id) throw new Error('Cole o link da pasta do Drive (o que termina em /folders/…).');
  const raiz = await dados(buscar, chave, id, 'id,name,mimeType,parents');
  if (raiz.mimeType !== 'application/vnd.google-apps.folder') throw new Error('Esse link é de um arquivo, não de uma pasta.');
  let caminhoRaiz = [raiz.name];
  // Pasta do mês (AAAA-MM): o cliente é a pasta de cima.
  if (MES.test(raiz.name) && raiz.parents?.[0]) {
    try { caminhoRaiz = [(await dados(buscar, chave, raiz.parents[0], 'name')).name, raiz.name]; } catch { /* sem acesso à pasta de cima: segue só com o mês */ }
  }
  const arquivos = [];
  let lidas = 0;
  const descer = async (pastaId, caminho, nivel) => {
    if (++lidas > 60) throw new Error('A pasta tem subpastas demais. Escolha a pasta de um cliente ou de um mês.');
    for (const f of await filhos(buscar, chave, pastaId)) {
      if (f.mimeType === 'application/vnd.google-apps.folder') { if (nivel < 3 && !f.name.startsWith('_')) await descer(f.id, [...caminho, f.name], nivel + 1); }
      else arquivos.push({ ...f, caminho });
    }
  };
  await descer(id, caminhoRaiz, 0);
  const r = montarPecas(arquivos, clientes);
  // Legendas em .txt com o mesmo nome do arquivo.
  for (const p of r.pecas) {
    if (!p._legendaId) continue;
    try { p.legenda = (await chamar(buscar, `${API}/${encodeURIComponent(p._legendaId)}?${new URLSearchParams({ alt: 'media', key: chave })}`, true)).replace(/^﻿/, '').trim().slice(0, 5000); } catch { /* sem legenda: segue */ }
    delete p._legendaId;
  }
  return r;
}
