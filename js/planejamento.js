// "Colar planejamento": transforma uma tabela colada (do chat do Claude, de uma planilha ou do Word) em peças
// na etapa Planejamento, no formato do "Adicionar em lote". Colunas da tabela da skill painel-conteudo:
//   Data | Formato | Funil | Título | Ideia e roteiro | Legenda | Nome final do arquivo
// Aceita colunas separadas por tab (copiado de planilha), por | (tabela do chat) ou por ; e acha as colunas pelo cabeçalho.

const norm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const COLUNAS = [
  ['publicar', /^(data|dia|publicar|publicacao|data de publicacao)$/],
  ['formato', /^(formato|tipo|tipo de conteudo)$/],
  ['funil', /^(funil|etapa do funil|etapa funil)$/],
  ['rede', /^(rede|rede social|plataforma|canal)$/],
  ['titulo', /^(titulo|tema|peca|nome da peca)$/],
  ['roteiro', /^(ideia e roteiro|roteiro|ideia|ideia roteiro|descricao)$/],
  ['legenda', /^(legenda|legenda pode ficar para depois|legenda pode ficar para depois )$/],
  ['observacoes', /^(observacoes|observacoes internas|obs|notas)$/],
  ['clienteNome', /^(cliente)$/],
];
const ORDEM_PADRAO = ['publicar', 'formato', 'funil', 'titulo', 'roteiro', 'legenda'];

// O cabeçalho pode trazer explicações entre parênteses ("Funil (topo, meio ou fundo)") e negrito do chat (**...**).
const colunaDe = (cab) => {
  const n = norm(String(cab).replace(/\([^)]*\)/g, ' '));
  return COLUNAS.find(([, re]) => re.test(n))?.[0] || '';
};

const limpa = (c) => c.trim().replace(/<br\s*\/?>/gi, '\n').trim();

// Tabela do chat: uma linha por linha de texto, colunas entre |.
const linhasPipe = (texto) => texto.split('\n')
  .filter((l) => l.trim() && !/^[\s|:\-+]+$/.test(l))
  .map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(limpa));

// Copiado de planilha (tab) ou ponto e vírgula: aspas protegem células com várias linhas.
function linhasDelimitadas(texto, sep) {
  const linhas = [];
  let linha = [];
  let cel = '';
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { cel += '"'; i++; }
      else if (c === '"') aspas = false;
      else cel += c;
    } else if (c === '"' && !cel.trim()) aspas = true;
    else if (c === sep) { linha.push(limpa(cel)); cel = ''; }
    else if (c === '\n') { linha.push(limpa(cel)); linhas.push(linha); linha = []; cel = ''; }
    else cel += c;
  }
  linha.push(limpa(cel));
  linhas.push(linha);
  return linhas.filter((r) => r.some((c) => c));
}

export function formatoDe(t) {
  const n = norm(t);
  if (/reel/.test(n)) return 'reels';
  if (/carross/.test(n)) return 'carrossel';
  if (/stor/.test(n)) return 'story';
  if (/feed|post|estatic|imagem|foto/.test(n)) return 'feed';
  return '';
}

export function redeDe(t) {
  const n = norm(t).replace(/ /g, '');
  if (/^(instagram|insta|ig)$/.test(n)) return 'instagram';
  if (/^(tiktok|tt)$/.test(n)) return 'tiktok';
  if (/^(facebook|face|fb)$/.test(n)) return 'facebook';
  if (n === 'pinterest') return 'pinterest';
  if (n === 'linkedin') return 'linkedin';
  return '';
}

export function funilDe(t) {
  const n = norm(t);
  if (/topo|tofu/.test(n)) return 'topo';
  if (/meio|mofu/.test(n)) return 'meio';
  if (/fundo|bofu/.test(n)) return 'fundo';
  return '';
}

// "2026-10-11", "11/10/2026", "11/10/26" ou "11/10" (sem ano: o ano atual; se já passou há mais de 6 meses, o próximo).
export function dataDe(t, hoje = new Date()) {
  const s = String(t || '').trim();
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  let a, mes, d;
  if (m) { [, a, mes, d] = m; }
  else if ((m = s.match(/(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/))) {
    [, d, mes, a] = m;
    if (a) a = a.length === 2 ? `20${a}` : a;
    else {
      a = hoje.getFullYear();
      if (new Date(a, Number(mes) - 1, Number(d)) < new Date(hoje.getFullYear(), hoje.getMonth() - 6, hoje.getDate())) a += 1;
    }
  } else return '';
  const dt = new Date(Number(a), Number(mes) - 1, Number(d));
  if (dt.getFullYear() !== Number(a) || dt.getMonth() !== Number(mes) - 1 || dt.getDate() !== Number(d)) return '';
  return `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Tabela copiada da tela do chat: uma célula com quebra de linha (o <br> do roteiro) vira várias linhas de texto, sem aspas.
// Uma linha só começa uma peça nova se a primeira célula for uma data; as outras continuam a célula anterior até completar as colunas.
const ehInicio = (r) => /^\s*(\d{1,2}[/.-]\d{1,2}|\d{4}-\d{2}-\d{2})/.test(r[0] || '');
function juntarLinhas(linhas, colunas) {
  const saida = [];
  let atual = null;
  for (const r of linhas) {
    if (atual && atual.length < colunas && !ehInicio(r)) {
      atual[atual.length - 1] = [atual[atual.length - 1], r[0]].filter((x) => x !== '').join('\n');
      atual.push(...r.slice(1));
    } else { atual = [...r]; saida.push(atual); }
  }
  return saida;
}

// Devolve { pecas, ignoradas } (ignoradas = textos das linhas que não viraram peça).
export function lerTabela(texto, { clienteNome = '', hoje = new Date() } = {}) {
  const bruto = String(texto || '').replace(/\r/g, '');
  const sep = bruto.includes('\t') ? '\t' : (bruto.includes('|') ? '|' : ';');
  const tabela = sep === '|' ? linhasPipe(bruto) : linhasDelimitadas(bruto, sep);
  if (!tabela.length) return { pecas: [], ignoradas: [] };
  // Cabeçalho: a primeira linha que reconhece pelo menos duas colunas (ex.: Data e Título).
  const iCab = tabela.findIndex((r) => r.filter((c) => colunaDe(c)).length >= 2);
  let ordem = ORDEM_PADRAO;
  let dados = tabela;
  if (iCab >= 0) {
    ordem = tabela[iCab].map(colunaDe);
    dados = juntarLinhas(tabela.slice(iCab + 1), ordem.length);
  }
  const pecas = [];
  const ignoradas = [];
  for (const r of dados) {
    const v = {};
    ordem.forEach((col, i) => { if (col && r[i] !== undefined && !(col in v)) v[col] = r[i]; });
    const titulo = String(v.titulo || '').trim();
    if (!titulo || /^[-–—\s]*$/.test(titulo)) { ignoradas.push(r.join(' | ').slice(0, 80)); continue; }
    const peca = {
      clienteNome: String(v.clienteNome || clienteNome || '').trim(),
      titulo,
      formato: formatoDe(v.formato) || 'feed',
      publicar: dataDe(v.publicar, hoje),
      etapa: 'planejamento',
    };
    const funil = funilDe(v.funil);
    if (funil) peca.funil = funil;
    const rede = redeDe(v.rede);
    if (rede) peca.rede = rede;
    if (String(v.roteiro || '').trim()) peca.roteiro = v.roteiro.trim();
    if (String(v.legenda || '').trim() && !/^[-–—\s]*$/.test(v.legenda)) peca.legenda = v.legenda.trim();
    if (String(v.observacoes || '').trim()) peca.observacoes = v.observacoes.trim();
    pecas.push(peca);
  }
  return { pecas, ignoradas };
}
